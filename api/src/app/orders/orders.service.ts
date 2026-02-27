import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DiscountType, OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateGuestOrderDto } from './dto/create-guest-order.dto';
import { GuestQuoteDto } from './dto/guest-quote.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AndreaniShippingService } from './andreani-shipping.service';

@Injectable()
export class OrdersService {
  private static lastIdempotencyCleanupAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    @Optional()
    private readonly andreaniShipping?: AndreaniShippingService,
  ) {}

  async createFromCart(
    userId: string,
    dto: CreateOrderDto,
    opts?: { idempotencyKey?: string },
  ) {
    const idempotency = this.getIdempotencyContext({
      key: opts?.idempotencyKey,
      scope: `user:${userId}`,
      action: 'orders.checkout',
      request: {
        couponCode: typeof dto.couponCode === 'string' ? dto.couponCode.trim().toUpperCase() : '',
        paymentMethod: dto.paymentMethod ?? '',
        notes: typeof dto.notes === 'string' ? dto.notes : '',
        shippingCity:
          typeof dto.shippingCity === 'string' ? dto.shippingCity.trim() : '',
        shippingPostalCode:
          typeof dto.shippingPostalCode === 'string'
            ? dto.shippingPostalCode.trim().toUpperCase()
            : '',
      },
    });

    if (idempotency) {
      this.scheduleIdempotencyCleanup();
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          scope_key_action: {
            scope: idempotency.scope,
            key: idempotency.key,
            action: idempotency.action,
          },
        },
      });

      if (existing) {
        if (existing.requestHash !== idempotency.requestHash) {
          throw new ConflictException('Idempotency-Key reused with a different request');
        }

        if (existing.orderId) {
          const order = await this.prisma.order.findUnique({
            where: { id: existing.orderId },
            include: { items: true },
          });
          if (order) {
            return order;
          }
        }
      }
    }

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        let idempotencyRowId: string | null = null;
        if (idempotency) {
          const row = await tx.idempotencyKey.create({
            data: {
              scope: idempotency.scope,
              key: idempotency.key,
              action: idempotency.action,
              requestHash: idempotency.requestHash,
            },
          });
          idempotencyRowId = row.id;
        }

        // Prevent double-submit creating duplicate orders for the same cart by locking the cart rows.
        // If a second checkout starts while the first is in progress, it will block until commit and then see an empty cart.
        await tx.$queryRaw(
          Prisma.sql`SELECT 1 FROM "public"."CartItem" WHERE "userId" = ${userId} FOR UPDATE`,
        );

        const cartItems = await tx.cartItem.findMany({
          where: { userId },
          include: { product: true },
        });

        if (cartItems.length === 0) {
          throw new BadRequestException('Cart is empty');
        }

        // Validate availability with current snapshot (final enforcement happens during atomic decrement).
        for (const item of cartItems) {
          if (!item.product.isActive) {
            throw new BadRequestException(
              `Product not available: ${item.product.title}`,
            );
          }
          if (item.product.stock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for product ${item.product.title}`,
            );
          }
        }

        const subtotal = cartItems.reduce(
          (sum, item) => sum + Number(item.product.price) * item.quantity,
          0,
        );

        let discount = 0;
        let couponCode: string | undefined;

        if (dto.couponCode) {
          const coupon = await tx.coupon.findUnique({
            where: { code: dto.couponCode.toUpperCase() },
          });
          if (!coupon || !coupon.isActive) {
            throw new BadRequestException('Invalid coupon');
          }

          const now = new Date();
          if (coupon.startsAt && now < coupon.startsAt) {
            throw new BadRequestException('Coupon not active yet');
          }
          if (coupon.expiresAt && now > coupon.expiresAt) {
            throw new BadRequestException('Coupon expired');
          }

          discount =
            coupon.type === DiscountType.PERCENTAGE
              ? (subtotal * Number(coupon.discount)) / 100
              : Number(coupon.discount);
          discount = Math.min(discount, subtotal);
          couponCode = coupon.code;
        }

        const shippingQuote = await this.quoteShippingFromItems({
          shippingCity: dto.shippingCity,
          shippingPostalCode: dto.shippingPostalCode,
          declaredValue: subtotal - discount,
          items: cartItems.map((item) => ({
            quantity: item.quantity,
            weightGrams: item.product.weightGrams,
            heightCm: item.product.heightCm,
            widthCm: item.product.widthCm,
            depthCm: item.product.thicknessCm,
          })),
        });

        const shippingCost = shippingQuote?.amount ?? 0;
        const total = subtotal - discount + shippingCost;

        // Atomic stock decrement prevents over-selling under concurrent checkouts.
        for (const item of cartItems) {
          const updated = await tx.product.updateMany({
            where: {
              id: item.productId,
              isActive: true,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });
          if (updated.count !== 1) {
            throw new BadRequestException(
              `Insufficient stock for product ${item.product.title}`,
            );
          }
        }

        // Atomic coupon usage increment prevents usageLimit races.
        if (couponCode) {
          const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
          if (!coupon || !coupon.isActive) {
            throw new BadRequestException('Invalid coupon');
          }

          const now = new Date();
          if (coupon.startsAt && now < coupon.startsAt) {
            throw new BadRequestException('Coupon not active yet');
          }
          if (coupon.expiresAt && now > coupon.expiresAt) {
            throw new BadRequestException('Coupon expired');
          }

          if (coupon.usageLimit) {
            const updated = await tx.coupon.updateMany({
              where: { code: couponCode, usedCount: { lt: coupon.usageLimit } },
              data: { usedCount: { increment: 1 } },
            });
            if (updated.count !== 1) {
              throw new BadRequestException('Coupon usage limit reached');
            }
          } else {
            await tx.coupon.update({
              where: { code: couponCode },
              data: { usedCount: { increment: 1 } },
            });
          }
        }

        const order = await tx.order.create({
          data: {
            userId,
            paymentMethod: dto.paymentMethod,
            shippingProvider: shippingQuote?.provider ?? null,
            shippingCity: shippingQuote?.city ?? null,
            shippingPostalCode: shippingQuote?.postalCode ?? null,
            shippingCost,
            subtotal,
            discount,
            total,
            couponCode,
            notes: dto.notes,
            items: {
              create: cartItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.product.price,
                productName: item.product.title,
              })),
            },
          },
          include: { items: true },
        });

        if (idempotencyRowId) {
          await tx.idempotencyKey.update({
            where: { id: idempotencyRowId },
            data: { orderId: order.id },
          });
        }

        await tx.cartItem.deleteMany({ where: { userId } });
        return order;
      });

      // Emails are best-effort and must never block checkout.
      // For Mercado Pago we send the payment link first and confirmation after payment approval.
      if (dto.paymentMethod !== PaymentMethod.MERCADOPAGO) {
        this.sendOrderConfirmationToUser(userId, order).catch(() => undefined);
      }
      return order;
    } catch (err) {
      if (
        idempotency &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.prisma.idempotencyKey.findUnique({
          where: {
            scope_key_action: {
              scope: idempotency.scope,
              key: idempotency.key,
              action: idempotency.action,
            },
          },
        });

        if (existing?.requestHash !== idempotency.requestHash) {
          throw new ConflictException('Idempotency-Key reused with a different request');
        }

        if (existing?.orderId) {
          const order = await this.prisma.order.findUnique({
            where: { id: existing.orderId },
            include: { items: true },
          });
          if (order) {
            return order;
          }
        }

        throw new ConflictException('Checkout already processed');
      }

      throw err;
    }
  }

  async quoteFromCart(userId: string, dto: CreateOrderDto) {
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    for (const item of cartItems) {
      if (!item.product.isActive) {
        throw new BadRequestException(`Product not available: ${item.product.title}`);
      }
      if (item.product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.product.title}`,
        );
      }
    }

    const subtotal = cartItems.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0,
    );

    const { discount, couponCode } = await this.computeDiscount({
      couponCode: dto.couponCode,
      subtotal,
      incrementUsage: false,
    });

    const shippingQuote = await this.quoteShippingFromItems({
      shippingCity: dto.shippingCity,
      shippingPostalCode: dto.shippingPostalCode,
      declaredValue: subtotal - discount,
      items: cartItems.map((item) => ({
        quantity: item.quantity,
        weightGrams: item.product.weightGrams,
        heightCm: item.product.heightCm,
        widthCm: item.product.widthCm,
        depthCm: item.product.thicknessCm,
      })),
    });

    const shippingCost = shippingQuote?.amount ?? 0;

    return {
      subtotal,
      discount,
      shippingCost,
      shippingProvider: shippingQuote?.provider,
      shippingCity: shippingQuote?.city,
      shippingPostalCode: shippingQuote?.postalCode,
      total: subtotal - discount + shippingCost,
      couponCode,
    };
  }

  async quoteGuest(dto: GuestQuoteDto) {
    const merged = this.mergeItems(dto.items);
    if (merged.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: merged.map((i) => i.productId) } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    for (const item of merged) {
      const product = byId.get(item.productId);
      if (!product || !product.isActive) {
        throw new BadRequestException('Product not available');
      }
      if (product.stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for product ${product.title}`);
      }
    }

    const subtotal = merged.reduce((sum, item) => {
      const product = byId.get(item.productId);
      return sum + Number(product?.price ?? 0) * item.quantity;
    }, 0);

    const { discount, couponCode } = await this.computeDiscount({
      couponCode: dto.couponCode,
      subtotal,
      incrementUsage: false,
    });

    const shippingQuote = await this.quoteShippingFromItems({
      shippingCity: dto.shippingCity,
      shippingPostalCode: dto.shippingPostalCode,
      declaredValue: subtotal - discount,
      items: merged.map((item) => {
        const product = byId.get(item.productId);
        return {
          quantity: item.quantity,
          weightGrams: product?.weightGrams,
          heightCm: product?.heightCm,
          widthCm: product?.widthCm,
          depthCm: product?.thicknessCm,
        };
      }),
    });

    const shippingCost = shippingQuote?.amount ?? 0;

    return {
      subtotal,
      discount,
      shippingCost,
      shippingProvider: shippingQuote?.provider,
      shippingCity: shippingQuote?.city,
      shippingPostalCode: shippingQuote?.postalCode,
      total: subtotal - discount + shippingCost,
      couponCode,
    };
  }

  async createGuestOrder(dto: CreateGuestOrderDto, opts?: { idempotencyKey?: string }) {
    const merged = this.mergeItems(dto.items);
    if (merged.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const guestEmail = dto.guestEmail.trim().toLowerCase();
    const guestFirstName = dto.guestFirstName.trim();
    const guestLastName = dto.guestLastName.trim();

    if (!guestFirstName) {
      throw new BadRequestException('Guest first name is required');
    }
    if (!guestLastName) {
      throw new BadRequestException('Guest last name is required');
    }

    const idempotency = this.getIdempotencyContext({
      key: opts?.idempotencyKey,
      scope: `guest:${guestEmail}`,
      action: 'orders.guest_checkout',
      request: {
        guestEmail,
        guestFirstName,
        guestLastName,
        couponCode: typeof dto.couponCode === 'string' ? dto.couponCode.trim().toUpperCase() : '',
        paymentMethod: dto.paymentMethod ?? '',
        notes: typeof dto.notes === 'string' ? dto.notes : '',
        shippingCity:
          typeof dto.shippingCity === 'string' ? dto.shippingCity.trim() : '',
        shippingPostalCode:
          typeof dto.shippingPostalCode === 'string'
            ? dto.shippingPostalCode.trim().toUpperCase()
            : '',
        items: merged
          .slice()
          .sort((a, b) => a.productId.localeCompare(b.productId))
          .map((i) => ({ productId: i.productId, quantity: i.quantity })),
      },
    });

    if (idempotency) {
      this.scheduleIdempotencyCleanup();
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          scope_key_action: {
            scope: idempotency.scope,
            key: idempotency.key,
            action: idempotency.action,
          },
        },
      });

      if (existing) {
        if (existing.requestHash !== idempotency.requestHash) {
          throw new ConflictException('Idempotency-Key reused with a different request');
        }

        if (existing.orderId) {
          const order = await this.prisma.order.findUnique({
            where: { id: existing.orderId },
            include: { items: true },
          });
          if (order) {
            return order;
          }
        }
      }
    }

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        let idempotencyRowId: string | null = null;
        if (idempotency) {
          const row = await tx.idempotencyKey.create({
            data: {
              scope: idempotency.scope,
              key: idempotency.key,
              action: idempotency.action,
              requestHash: idempotency.requestHash,
            },
          });
          idempotencyRowId = row.id;
        }

      const products = await tx.product.findMany({
        where: { id: { in: merged.map((i) => i.productId) } },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      for (const item of merged) {
        const product = byId.get(item.productId);
        if (!product || !product.isActive) {
          throw new BadRequestException('Product not available');
        }
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${product.title}`,
          );
        }
      }

      const subtotal = merged.reduce((sum, item) => {
        const product = byId.get(item.productId);
        return sum + Number(product?.price ?? 0) * item.quantity;
      }, 0);

      const { discount, couponCode } = await this.computeDiscountTx(tx, {
        couponCode: dto.couponCode,
        subtotal,
      });

      const shippingQuote = await this.quoteShippingFromItems({
        shippingCity: dto.shippingCity,
        shippingPostalCode: dto.shippingPostalCode,
        declaredValue: subtotal - discount,
        items: merged.map((item) => {
          const product = byId.get(item.productId);
          return {
            quantity: item.quantity,
            weightGrams: product?.weightGrams,
            heightCm: product?.heightCm,
            widthCm: product?.widthCm,
            depthCm: product?.thicknessCm,
          };
        }),
      });

      const shippingCost = shippingQuote?.amount ?? 0;
      const total = subtotal - discount + shippingCost;

      for (const item of merged) {
        const product = byId.get(item.productId);
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            isActive: true,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) {
          throw new BadRequestException(
            `Insufficient stock for product ${product?.title ?? 'Unknown'}`,
          );
        }
      }

      if (couponCode) {
        await this.incrementCouponUsageTx(tx, couponCode);
      }

      const order = await tx.order.create({
        data: {
          userId: null,
          guestEmail,
          guestFirstName,
          guestLastName,
          paymentMethod: dto.paymentMethod,
          shippingProvider: shippingQuote?.provider ?? null,
          shippingCity: shippingQuote?.city ?? null,
          shippingPostalCode: shippingQuote?.postalCode ?? null,
          shippingCost,
          subtotal,
          discount,
          total,
          couponCode,
          notes: dto.notes,
          items: {
            create: merged.map((item) => {
              const product = byId.get(item.productId);
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: product?.price ?? 0,
                productName: product?.title ?? 'Unknown',
              };
            }),
          },
        },
        include: { items: true },
      });

      if (idempotencyRowId) {
        await tx.idempotencyKey.update({
          where: { id: idempotencyRowId },
          data: { orderId: order.id },
        });
      }

      return order;
      });

      // For Mercado Pago we send the payment link first and confirmation after payment approval.
      if (dto.paymentMethod !== PaymentMethod.MERCADOPAGO) {
        this.sendOrderConfirmationToGuest(order).catch(() => undefined);
      }
      return order;
    } catch (err) {
      if (
        idempotency &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.prisma.idempotencyKey.findUnique({
          where: {
            scope_key_action: {
              scope: idempotency.scope,
              key: idempotency.key,
              action: idempotency.action,
            },
          },
        });

        if (existing?.requestHash !== idempotency.requestHash) {
          throw new ConflictException('Idempotency-Key reused with a different request');
        }

        if (existing?.orderId) {
          const order = await this.prisma.order.findUnique({
            where: { id: existing.orderId },
            include: { items: true },
          });
          if (order) {
            return order;
          }
        }

        throw new ConflictException('Checkout already processed');
      }

      throw err;
    }
  }

  myOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  allOrders() {
    return this.prisma.order.findMany({
      include: {
        items: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const updated =
      dto.status === OrderStatus.CANCELED && order.status !== OrderStatus.CANCELED
        ? await this.prisma.$transaction(async (tx) => {
            const next = await tx.order.update({
              where: { id: orderId },
              data: { status: dto.status },
            });

            // Restock only when canceling an unpaid/pending order to avoid inflating stock on post-fulfillment cancellations.
            if (order.status === OrderStatus.PENDING) {
              for (const item of order.items) {
                await tx.product.updateMany({
                  where: { id: item.productId },
                  data: { stock: { increment: item.quantity } },
                });
              }

              if (order.couponCode) {
                await tx.coupon.updateMany({
                  where: { code: order.couponCode, usedCount: { gt: 0 } },
                  data: { usedCount: { decrement: 1 } },
                });
              }
            }

            return next;
          })
        : await this.prisma.order.update({
            where: { id: orderId },
            data: { status: dto.status },
          });

    this.sendOrderStatusUpdate(updated.id, dto.status).catch(() => undefined);
    return updated;
  }

  dashboardSummary() {
    return this.prisma.$transaction(async (tx) => {
      const [ordersCount, revenueAgg, lowStockProducts] = await Promise.all([
        tx.order.count(),
        tx.order.aggregate({ _sum: { total: true } }),
        tx.product.findMany({
          where: { stock: { lte: 5 }, isActive: true },
          select: { id: true, title: true, stock: true },
          take: 10,
          orderBy: { stock: 'asc' },
        }),
      ]);

      return {
        ordersCount,
        revenue: Number(revenueAgg._sum.total ?? 0),
        lowStockProducts,
      };
    });
  }

  private async quoteShippingFromItems(input: {
    shippingCity?: string;
    shippingPostalCode?: string;
    declaredValue: number;
    items: Array<{
      quantity: number;
      weightGrams?: unknown;
      heightCm?: unknown;
      widthCm?: unknown;
      depthCm?: unknown;
    }>;
  }): Promise<
    | {
        provider: string;
        city: string;
        postalCode: string;
        amount: number;
      }
    | undefined
  > {
    const normalized = this.normalizeShippingInput({
      city: input.shippingCity,
      postalCode: input.shippingPostalCode,
    });
    if (!normalized) {
      return undefined;
    }

    if (!this.andreaniShipping) {
      throw new BadRequestException('Shipping provider unavailable');
    }

    const quote = await this.andreaniShipping.quote({
      destinationCity: normalized.city,
      destinationPostalCode: normalized.postalCode,
      declaredValue: Math.max(0, input.declaredValue),
      items: input.items,
    });

    return {
      provider: quote.provider,
      city: normalized.city,
      postalCode: normalized.postalCode,
      amount: quote.amount,
    };
  }

  private normalizeShippingInput(input: {
    city?: string;
    postalCode?: string;
  }): { city: string; postalCode: string } | undefined {
    const rawCity = typeof input.city === 'string' ? input.city.trim() : '';
    const rawPostal = typeof input.postalCode === 'string' ? input.postalCode.trim().toUpperCase() : '';

    const hasAny = !!rawCity || !!rawPostal;
    if (!hasAny) {
      return undefined;
    }

    if (!rawCity || !rawPostal) {
      throw new BadRequestException('Shipping city and postal code are required');
    }

    if (rawCity.length > 120) {
      throw new BadRequestException('Shipping city is too long');
    }

    if (!/^(?:[A-Z]\d{4}[A-Z]{0,3}|\d{4,8})$/.test(rawPostal)) {
      throw new BadRequestException('Shipping postal code is invalid');
    }

    return { city: rawCity, postalCode: rawPostal };
  }

  private mergeItems(items: Array<{ productId: string; quantity: number }>) {
    const byId = new Map<string, number>();
    for (const item of items ?? []) {
      byId.set(item.productId, (byId.get(item.productId) ?? 0) + item.quantity);
    }

    return Array.from(byId.entries())
      .map(([productId, quantity]) => ({ productId, quantity }))
      .filter((x) => x.productId && x.quantity > 0)
      .slice(0, 200);
  }

  private async computeDiscount(input: {
    couponCode?: string;
    subtotal: number;
    incrementUsage: boolean;
  }): Promise<{ discount: number; couponCode?: string }> {
    if (!input.couponCode) {
      return { discount: 0 };
    }

    // For quotes we don't mutate anything, so we can use the read-only path.
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: input.couponCode.toUpperCase() },
    });
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid coupon');
    }

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) {
      throw new BadRequestException('Coupon not active yet');
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      throw new BadRequestException('Coupon expired');
    }

    let discount =
      coupon.type === DiscountType.PERCENTAGE
        ? (input.subtotal * Number(coupon.discount)) / 100
        : Number(coupon.discount);
    discount = Math.min(discount, input.subtotal);

    return { discount, couponCode: coupon.code };
  }

  private async computeDiscountTx(
    tx: Prisma.TransactionClient,
    input: { couponCode?: string; subtotal: number },
  ) {
    if (!input.couponCode) {
      return { discount: 0, couponCode: undefined as string | undefined };
    }

    const coupon = await tx.coupon.findUnique({
      where: { code: input.couponCode.toUpperCase() },
    });
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid coupon');
    }

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) {
      throw new BadRequestException('Coupon not active yet');
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      throw new BadRequestException('Coupon expired');
    }

    let discount =
      coupon.type === DiscountType.PERCENTAGE
        ? (input.subtotal * Number(coupon.discount)) / 100
        : Number(coupon.discount);
    discount = Math.min(discount, input.subtotal);

    return { discount, couponCode: coupon.code };
  }

  private async incrementCouponUsageTx(
    tx: Prisma.TransactionClient,
    couponCode: string,
  ) {
    const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid coupon');
    }

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) {
      throw new BadRequestException('Coupon not active yet');
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      throw new BadRequestException('Coupon expired');
    }

    if (coupon.usageLimit) {
      const updated = await tx.coupon.updateMany({
        where: { code: couponCode, usedCount: { lt: coupon.usageLimit } },
        data: { usedCount: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Coupon usage limit reached');
      }
    } else {
      await tx.coupon.update({
        where: { code: couponCode },
        data: { usedCount: { increment: 1 } },
      });
    }
  }

  private async sendOrderConfirmationToUser(
    userId: string,
    order: {
      id: string;
      total: unknown;
      paymentMethod?: string | null;
      items: Array<{ productName: string; quantity: number; unitPrice: unknown }>;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });
    if (!user?.email) {
      return;
    }

    const customerName = `${user.firstName} ${user.lastName}`.trim();
    await this.email.sendOrderConfirmation({
      to: user.email,
      customerName,
      order: {
        id: order.id,
        total: order.total,
        paymentMethod: order.paymentMethod,
        items: order.items ?? [],
      },
    });
  }

  private async sendOrderConfirmationToGuest(order: {
    id: string;
    guestEmail?: string | null;
    guestFirstName?: string | null;
    guestLastName?: string | null;
    total: unknown;
    paymentMethod?: string | null;
    items: Array<{ productName: string; quantity: number; unitPrice: unknown }>;
  }) {
    const to = order.guestEmail;
    if (!to) {
      return;
    }
    const customerName = `${order.guestFirstName ?? ''} ${order.guestLastName ?? ''}`.trim();
    await this.email.sendOrderConfirmation({
      to,
      customerName,
      order: {
        id: order.id,
        total: order.total,
        paymentMethod: order.paymentMethod,
        items: order.items ?? [],
      },
    });
  }

  private async sendOrderStatusUpdate(orderId: string, status: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    if (!order) {
      return;
    }

    const to = order.user?.email ?? order.guestEmail;
    if (!to) {
      return;
    }

    const customerName = order.user
      ? `${order.user.firstName} ${order.user.lastName}`.trim()
      : `${order.guestFirstName ?? ''} ${order.guestLastName ?? ''}`.trim();

    await this.email.sendOrderStatusUpdate({
      to,
      customerName,
      orderId,
      status,
    });
  }

  private getIdempotencyContext(input: {
    key?: string;
    scope: string;
    action: string;
    request: unknown;
  }): { key: string; scope: string; action: string; requestHash: string } | null {
    const key = this.normalizeIdempotencyKey(input.key);
    if (!key) {
      return null;
    }

    return {
      key,
      scope: input.scope,
      action: input.action,
      requestHash: this.hashIdempotencyRequest(input.request),
    };
  }

  private normalizeIdempotencyKey(input: unknown): string | undefined {
    if (typeof input !== 'string') {
      return undefined;
    }
    const trimmed = input.trim();
    if (!trimmed) {
      return undefined;
    }
    if (trimmed.length > 200) {
      throw new BadRequestException('Idempotency-Key too long');
    }
    return trimmed;
  }

  private hashIdempotencyRequest(input: unknown): string {
    return createHash('sha256').update(JSON.stringify(input)).digest('hex');
  }

  private scheduleIdempotencyCleanup() {
    const now = Date.now();
    const minIntervalMs = 60 * 60 * 1000; // 1h
    if (now - OrdersService.lastIdempotencyCleanupAt < minIntervalMs) {
      return;
    }

    OrdersService.lastIdempotencyCleanupAt = now;

    const maxAgeMs = 30 * 24 * 60 * 60 * 1000; // 30d
    const cutoff = new Date(now - maxAgeMs);

    const idem = (this.prisma as unknown as {
      idempotencyKey?: {
        deleteMany?: (args: { where: { createdAt: { lt: Date } } }) => Promise<unknown>;
      };
    }).idempotencyKey;
    if (!idem?.deleteMany) {
      return;
    }

    idem.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => undefined);
  }
}
