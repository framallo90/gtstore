import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  MarketplaceListingStatus,
  MarketplaceOrderStatus,
  PaymentMethod,
  PayoutStatus,
} from '@prisma/client';
import { AndreaniShippingService } from '../orders/andreani-shipping.service';
import { MercadoPagoService } from '../payments/mercadopago.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMarketplaceOrderDto } from './dto/create-marketplace-order.dto';
import { CreateMarketplaceOrderQuoteDto } from './dto/create-marketplace-order-quote.dto';
import { UpdateMarketplaceOrderStatusDto } from './dto/update-marketplace-order-status.dto';

const MARKETPLACE_COMMISSION_RATE = 0.15;

function roundTo2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class MarketplaceOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly andreaniShipping?: AndreaniShippingService,
    @Optional()
    private readonly mercadoPago?: MercadoPagoService,
  ) {}

  async quote(userId: string, dto: CreateMarketplaceOrderQuoteDto) {
    const { buyer, listing } = await this.loadBuyerAndListing(userId, dto.listingId);
    const shippingQuote = await this.quoteShipping(listing, dto.shippingCity, dto.shippingPostalCode);
    return this.buildQuotePayload(listing, buyer.id, dto.shippingCity, dto.shippingPostalCode, shippingQuote);
  }

  async checkout(userId: string, dto: CreateMarketplaceOrderDto) {
    const { buyer, listing } = await this.loadBuyerAndListing(userId, dto.listingId);
    const shippingQuote = await this.quoteShipping(listing, dto.shippingCity, dto.shippingPostalCode);
    const totals = this.buildQuotePayload(
      listing,
      buyer.id,
      dto.shippingCity,
      dto.shippingPostalCode,
      shippingQuote,
    );

    const order = await this.prisma.$transaction(async (tx) => {
      const reserved = await tx.marketplaceListing.updateMany({
        where: {
          id: listing.id,
          status: MarketplaceListingStatus.PUBLISHED,
          isActive: true,
          stock: { gte: 1 },
        },
        data: {
          stock: { decrement: 1 },
          status: MarketplaceListingStatus.SOLD,
          isActive: false,
          soldAt: new Date(),
        },
      });

      if (reserved.count !== 1) {
        throw new ConflictException('Marketplace listing is no longer available');
      }

      return tx.marketplaceOrder.create({
        data: {
          buyerId: buyer.id,
          sellerId: listing.sellerId,
          listingId: listing.id,
          status: MarketplaceOrderStatus.PENDING,
          paymentMethod: dto.paymentMethod,
          shippingProvider: shippingQuote.provider,
          shippingCity: totals.shipping.city,
          shippingPostalCode: totals.shipping.postalCode,
          shippingCost: totals.shipping.cost,
          salePrice: totals.salePrice,
          platformCommission: totals.platformCommission,
          sellerNetAmount: totals.sellerNetAmount,
          buyerTotal: totals.buyerTotal,
          payoutStatus: PayoutStatus.ON_HOLD,
          notes: dto.notes ?? null,
        },
        include: {
          listing: { select: { id: true, title: true } },
          buyer: { select: { id: true, email: true } },
          seller: { select: { id: true, email: true } },
        },
      });
    });

    if (dto.paymentMethod !== PaymentMethod.MERCADOPAGO) {
      return { ...order, redirectUrl: undefined };
    }

    if (!this.mercadoPago) {
      throw new BadRequestException('Mercado Pago is not available');
    }

    try {
      const redirectUrl = await this.ensureMercadoPagoPreference(order.id, {
        payerEmail: buyer.email,
        title: order.listing.title,
        buyerTotal: Number(order.buyerTotal),
      });
      return { ...order, redirectUrl };
    } catch (error) {
      await this.cancelAndReopenListing(order.id);
      throw error;
    }
  }

  myOrders(userId: string) {
    return this.prisma.marketplaceOrder.findMany({
      where: { buyerId: userId },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        listing: { select: { id: true, title: true, category: true } },
        seller: { select: { city: true, province: true, country: true } },
      },
    });
  }

  adminAllOrders() {
    return this.prisma.marketplaceOrder.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: {
        listing: { select: { id: true, title: true, category: true } },
        buyer: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        seller: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async updateStatus(id: string, dto: UpdateMarketplaceOrderStatusDto) {
    const existing = await this.prisma.marketplaceOrder.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Marketplace order not found');
    }
    if (
      existing.payoutStatus === PayoutStatus.RELEASED &&
      dto.status === MarketplaceOrderStatus.CANCELED
    ) {
      throw new ConflictException('Released marketplace orders cannot be canceled');
    }

    if (dto.status === MarketplaceOrderStatus.CANCELED) {
      return this.cancelAndReopenListing(id);
    }

    const data: {
      status: MarketplaceOrderStatus;
      deliveredAt?: Date | null;
      disputeOpenedAt?: Date | null;
      payoutStatus?: PayoutStatus;
    } = { status: dto.status };

    if (dto.status === MarketplaceOrderStatus.DELIVERED) {
      data.deliveredAt = new Date();
      data.payoutStatus =
        existing.disputeOpenedAt || existing.payoutStatus === PayoutStatus.RELEASED
          ? existing.payoutStatus
          : PayoutStatus.READY_TO_RELEASE;
    }

    if (dto.status === MarketplaceOrderStatus.DISPUTED) {
      data.disputeOpenedAt = existing.disputeOpenedAt ?? new Date();
      data.payoutStatus = PayoutStatus.ON_HOLD;
    }

    return this.prisma.marketplaceOrder.update({
      where: { id },
      data,
      include: {
        listing: { select: { id: true, title: true } },
        buyer: { select: { id: true, email: true } },
        seller: { select: { id: true, email: true } },
      },
    });
  }

  async releasePayout(id: string) {
    const order = await this.prisma.marketplaceOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Marketplace order not found');
    }
    if (order.payoutStatus === PayoutStatus.RELEASED) {
      throw new ConflictException('Marketplace payout was already released');
    }
    if (order.status !== MarketplaceOrderStatus.DELIVERED || !order.deliveredAt) {
      throw new ConflictException('Marketplace payout requires a delivered order');
    }
    if (order.disputeOpenedAt) {
      throw new ConflictException('Marketplace payout is blocked by an open dispute');
    }

    return this.prisma.marketplaceOrder.update({
      where: { id },
      data: {
        payoutStatus: PayoutStatus.RELEASED,
        payoutReleasedAt: new Date(),
      },
      include: {
        listing: { select: { id: true, title: true } },
        buyer: { select: { id: true, email: true } },
        seller: { select: { id: true, email: true } },
      },
    });
  }

  async markPaidFromWebhook(
    id: string,
    paymentId: string,
    paymentStatus?: string | null,
    preferenceId?: string | null,
  ) {
    const order = await this.prisma.marketplaceOrder.findUnique({ where: { id } });
    if (!order) {
      return null;
    }

    return this.prisma.marketplaceOrder.update({
      where: { id },
      data: {
        status:
          order.status === MarketplaceOrderStatus.CANCELED
            ? order.status
            : MarketplaceOrderStatus.PAID,
        mpPaymentId: paymentId,
        mpPaymentStatus: paymentStatus ?? null,
        mpPreferenceId: preferenceId ?? order.mpPreferenceId ?? null,
      },
    });
  }

  async markCanceledFromWebhook(
    id: string,
    paymentId: string,
    paymentStatus?: string | null,
    preferenceId?: string | null,
  ) {
    const order = await this.prisma.marketplaceOrder.findUnique({ where: { id } });
    if (!order) {
      return null;
    }

    const canceled = await this.cancelAndReopenListing(id);
    return this.prisma.marketplaceOrder.update({
      where: { id: canceled.id },
      data: {
        mpPaymentId: paymentId,
        mpPaymentStatus: paymentStatus ?? null,
        mpPreferenceId: preferenceId ?? canceled.mpPreferenceId ?? null,
      },
    });
  }

  private async loadBuyerAndListing(userId: string, listingId: string) {
    const [buyer, listing] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, isActive: true },
      }),
      this.prisma.marketplaceListing.findFirst({
        where: {
          id: listingId,
          status: MarketplaceListingStatus.PUBLISHED,
          isActive: true,
          stock: { gte: 1 },
        },
        select: {
          id: true,
          sellerId: true,
          title: true,
          price: true,
          seller: {
            select: {
              province: true,
              city: true,
              postalCode: true,
            },
          },
        },
      }),
    ]);

    if (!buyer || !buyer.isActive) {
      throw new ForbiddenException('User is not allowed to create marketplace orders');
    }
    if (!listing) {
      throw new NotFoundException('Marketplace listing not found');
    }
    if (listing.sellerId === buyer.id) {
      throw new BadRequestException('You cannot buy your own marketplace listing');
    }
    if (!listing.seller.province || !listing.seller.city || !listing.seller.postalCode) {
      throw new BadRequestException('Marketplace seller shipping origin is incomplete');
    }

    return { buyer, listing };
  }

  private async quoteShipping(
    listing: {
      price: unknown;
      seller: {
        province: string | null;
        city: string | null;
        postalCode: string | null;
      };
    },
    shippingCity: string,
    shippingPostalCode: string,
  ) {
    if (!this.andreaniShipping) {
      throw new BadRequestException('Andreani shipping is not available');
    }

    return this.andreaniShipping.quote({
      destinationCity: shippingCity,
      destinationPostalCode: shippingPostalCode,
      declaredValue: Number(listing.price),
      senderProvince: listing.seller.province ?? undefined,
      senderDistrict: listing.seller.city ?? undefined,
      senderLocality: listing.seller.city ?? undefined,
      senderZipCode: listing.seller.postalCode ?? undefined,
      items: [{ quantity: 1 }],
    });
  }

  private buildQuotePayload(
    listing: {
      id: string;
      sellerId: string;
      title: string;
      price: unknown;
    },
    buyerId: string,
    shippingCity: string,
    shippingPostalCode: string,
    shippingQuote: {
      provider: string;
      amount: number;
      service?: string;
    },
  ) {
    const salePrice = roundTo2(Number(listing.price));
    const platformCommission = roundTo2(salePrice * MARKETPLACE_COMMISSION_RATE);
    const sellerNetAmount = roundTo2(Math.max(0, salePrice - platformCommission));
    const shippingCost = roundTo2(Number(shippingQuote.amount));
    const buyerTotal = roundTo2(salePrice + shippingCost);

    return {
      listingId: listing.id,
      buyerId,
      sellerId: listing.sellerId,
      title: listing.title,
      salePrice,
      platformCommission,
      sellerNetAmount,
      buyerTotal,
      commissionRate: MARKETPLACE_COMMISSION_RATE,
      shipping: {
        provider: shippingQuote.provider,
        service: shippingQuote.service ?? null,
        cost: shippingCost,
        city: shippingCity.trim(),
        postalCode: shippingPostalCode.trim().toUpperCase(),
      },
    };
  }

  private async ensureMercadoPagoPreference(
    orderId: string,
    input: { payerEmail?: string; title: string; buyerTotal: number },
  ) {
    if (!this.mercadoPago) {
      throw new BadRequestException('Mercado Pago is not available');
    }

    const existing = await this.prisma.marketplaceOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        mpPreferenceId: true,
        mpInitPoint: true,
        mpSandboxInitPoint: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Marketplace order not found');
    }

    const existingRedirect = this.mercadoPago.pickRedirectUrl({
      initPoint: existing.mpInitPoint,
      sandboxInitPoint: existing.mpSandboxInitPoint,
    });
    if (existing.mpPreferenceId && existingRedirect) {
      return existingRedirect;
    }

    const storeBaseUrl = (process.env.STORE_BASE_URL ?? 'http://localhost:4200').trim();
    const webhookUrl = (process.env.MP_NOTIFICATION_URL ?? '').trim();
    const backUrls =
      storeBaseUrl && storeBaseUrl.startsWith('http')
        ? {
            success: `${storeBaseUrl.replace(/\/+$/, '')}/marketplace/checkout/mp/success`,
            pending: `${storeBaseUrl.replace(/\/+$/, '')}/marketplace/checkout/mp/pending`,
            failure: `${storeBaseUrl.replace(/\/+$/, '')}/marketplace/checkout/mp/failure`,
          }
        : undefined;

    const pref = await this.mercadoPago.createPreference(
      {
        orderId,
        payerEmail: input.payerEmail,
        notificationUrl: webhookUrl || undefined,
        backUrls,
        items: [
          {
            title: `Marketplace: ${input.title}`,
            quantity: 1,
            unitPrice: input.buyerTotal,
          },
        ],
      },
      { idempotencyKey: `gt-mp-mkt-pref:${orderId}` },
    );

    const redirectUrl = this.mercadoPago.pickRedirectUrl({
      initPoint: pref.init_point,
      sandboxInitPoint: pref.sandbox_init_point,
    });
    if (!redirectUrl) {
      throw new BadRequestException('Mercado Pago: no devolvio un link de pago valido');
    }

    await this.prisma.marketplaceOrder.update({
      where: { id: orderId },
      data: {
        mpPreferenceId: pref.id,
        mpInitPoint: pref.init_point ?? null,
        mpSandboxInitPoint: pref.sandbox_init_point ?? null,
        mpPaymentStatus: 'created',
      },
    });

    return redirectUrl;
  }

  private async cancelAndReopenListing(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.marketplaceOrder.findUnique({ where: { id } });
      if (!order) {
        throw new NotFoundException('Marketplace order not found');
      }

      if (order.status === MarketplaceOrderStatus.CANCELED) {
        return tx.marketplaceOrder.findUniqueOrThrow({
          where: { id },
          include: {
            listing: { select: { id: true, title: true } },
            buyer: { select: { id: true, email: true } },
            seller: { select: { id: true, email: true } },
          },
        });
      }

      await tx.marketplaceListing.update({
        where: { id: order.listingId },
        data: {
          status: MarketplaceListingStatus.PUBLISHED,
          isActive: true,
          stock: { increment: 1 },
          soldAt: null,
        },
      });

      return tx.marketplaceOrder.update({
        where: { id },
        data: {
          status: MarketplaceOrderStatus.CANCELED,
          payoutStatus: PayoutStatus.CANCELED,
        },
        include: {
          listing: { select: { id: true, title: true } },
          buyer: { select: { id: true, email: true } },
          seller: { select: { id: true, email: true } },
        },
      });
    });
  }
}
