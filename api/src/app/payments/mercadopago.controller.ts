import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { EmailService } from '../email/email.service';
import { OrdersService } from '../orders/orders.service';
import { CreateGuestOrderDto } from '../orders/dto/create-guest-order.dto';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoService } from './mercadopago.service';

type CheckoutRedirectResponse = {
  orderId: string;
  redirectUrl: string;
};

@ApiTags('Payments')
@Controller('payments/mercadopago')
export class MercadoPagoController {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
    private readonly mp: MercadoPagoService,
    private readonly email: EmailService,
  ) {}

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async checkout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CheckoutRedirectResponse> {
    const order = await this.orders.createFromCart(
      user.sub,
      { ...dto, paymentMethod: PaymentMethod.MERCADOPAGO },
      { idempotencyKey },
    );

    const redirect = await this.ensurePreference(order.id, {
      payerEmail: user.email,
    });

    if (redirect.created) {
      this.email
        .sendMercadoPagoPaymentLink({
          to: user.email,
          orderId: order.id,
          redirectUrl: redirect.redirectUrl,
        })
        .catch(() => undefined);
    }

    return { orderId: order.id, redirectUrl: redirect.redirectUrl };
  }

  @Post('guest/checkout')
  async checkoutGuest(
    @Body() dto: CreateGuestOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CheckoutRedirectResponse> {
    const order = await this.orders.createGuestOrder(
      { ...dto, paymentMethod: PaymentMethod.MERCADOPAGO },
      { idempotencyKey },
    );

    const redirect = await this.ensurePreference(order.id, {
      payerEmail: order.guestEmail ?? undefined,
    });

    if (redirect.created && order.guestEmail) {
      this.email
        .sendMercadoPagoPaymentLink({
          to: order.guestEmail,
          customerName: order.guestFirstName ?? undefined,
          orderId: order.id,
          redirectUrl: redirect.redirectUrl,
        })
        .catch(() => undefined);
    }

    return { orderId: order.id, redirectUrl: redirect.redirectUrl };
  }

  @Post('webhook')
  async webhook(@Req() req: Request, @Body() body: any) {
    if (!this.isWebhookSignatureValid(req, body)) {
      throw new UnauthorizedException('Invalid Mercado Pago webhook signature');
    }

    const typeRaw =
      (typeof body?.type === 'string' ? body.type : undefined) ??
      (typeof (req.query as any)?.type === 'string' ? (req.query as any).type : undefined) ??
      (typeof (req.query as any)?.topic === 'string' ? (req.query as any).topic : undefined);

    const type = String(typeRaw ?? '').toLowerCase().trim();
    if (type !== 'payment') {
      return { ok: true };
    }

    const idCandidate =
      (typeof body?.data?.id === 'string' || typeof body?.data?.id === 'number'
        ? String(body.data.id)
        : undefined) ??
      (typeof (req.query as any)?.['data.id'] === 'string'
        ? (req.query as any)['data.id']
        : undefined) ??
      (typeof (req.query as any)?.id === 'string' ? (req.query as any).id : undefined);

    const paymentId = String(idCandidate ?? '').trim();
    if (!/^\d{1,30}$/.test(paymentId)) {
      return { ok: true };
    }

    const payment = await this.mp.getPayment(paymentId);

    const orderId =
      (typeof payment.external_reference === 'string'
        ? payment.external_reference
        : undefined) ??
      (typeof (payment.metadata as any)?.orderId === 'string'
        ? (payment.metadata as any).orderId
        : undefined);

    if (!orderId || typeof orderId !== 'string' || orderId.length > 80) {
      return { ok: true };
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentMethod !== PaymentMethod.MERCADOPAGO) {
      return { ok: true };
    }

    const expectedCurrency = (process.env.MP_CURRENCY_ID ?? 'USD').trim().toUpperCase();
    if (
      payment.currency_id &&
      String(payment.currency_id).toUpperCase() !== expectedCurrency
    ) {
      return { ok: true };
    }

    const expectedAmount = Number(order.total);
    const paidAmount = Number(payment.transaction_amount);
    if (
      Number.isFinite(expectedAmount) &&
      Number.isFinite(paidAmount) &&
      Math.abs(expectedAmount - paidAmount) > 0.01
    ) {
      return { ok: true };
    }

    if (
      order.mpPreferenceId &&
      payment.preference_id &&
      payment.preference_id !== order.mpPreferenceId
    ) {
      return { ok: true };
    }

    // Record raw payment state on the order (for support/debugging).
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        mpPaymentId: paymentId,
        mpPaymentStatus: payment.status ?? null,
        mpPreferenceId: payment.preference_id ?? order.mpPreferenceId ?? null,
        mpMerchantOrderId: payment.merchant_order_id
          ? String(payment.merchant_order_id)
          : order.mpMerchantOrderId ?? null,
        mpLastWebhookAt: new Date(),
      },
    });

    const status = String(payment.status ?? '').toLowerCase();
    if (status === 'approved') {
      if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.CANCELED) {
        await this.orders.updateStatus(orderId, { status: OrderStatus.PAID });
      }
      return { ok: true };
    }

    if (status === 'rejected' || status === 'cancelled') {
      if (order.status === OrderStatus.PENDING) {
        await this.orders.updateStatus(orderId, { status: OrderStatus.CANCELED });
      }
      return { ok: true };
    }

    return { ok: true };
  }

  private isWebhookSignatureValid(req: Request, body: any): boolean {
    const webhookSecret = (process.env.MP_WEBHOOK_SECRET ?? '').trim();
    if (!webhookSecret) {
      return true;
    }

    const signatureHeader = req.headers['x-signature'];
    const requestIdHeader = req.headers['x-request-id'];
    const signature = this.parseSignatureHeader(
      Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader,
    );
    const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;

    if (!signature?.ts || !signature?.v1 || !requestId || typeof requestId !== 'string') {
      return false;
    }

    const dataIdFromQuery = (req.query as Record<string, unknown>)['data.id'];
    const dataIdRaw =
      (typeof dataIdFromQuery === 'string' ? dataIdFromQuery : undefined) ??
      (typeof body?.data?.id === 'string' || typeof body?.data?.id === 'number'
        ? String(body.data.id)
        : undefined);

    const manifest = this.buildWebhookManifest({
      dataId: dataIdRaw,
      requestId,
      ts: signature.ts,
    });
    if (!manifest) {
      return false;
    }

    const expectedHex = createHmac('sha256', webhookSecret).update(manifest).digest('hex');
    const expected = Buffer.from(expectedHex, 'hex');
    const provided = Buffer.from(signature.v1, 'hex');
    if (expected.length !== provided.length) {
      return false;
    }

    return timingSafeEqual(expected, provided);
  }

  private parseSignatureHeader(
    raw: string | undefined,
  ): { ts?: string; v1?: string } | undefined {
    if (!raw) {
      return undefined;
    }

    const out: { ts?: string; v1?: string } = {};
    for (const part of raw.split(',')) {
      const [kRaw, vRaw] = part.split('=', 2);
      const key = (kRaw ?? '').trim().toLowerCase();
      const value = (vRaw ?? '').trim();
      if (!value) {
        continue;
      }
      if (key === 'ts') {
        out.ts = value;
      }
      if (key === 'v1' && /^[a-f0-9]{64}$/i.test(value)) {
        out.v1 = value.toLowerCase();
      }
    }

    return out;
  }

  private buildWebhookManifest(input: {
    dataId?: string;
    requestId: string;
    ts: string;
  }): string {
    const chunks: string[] = [];
    const dataId = (input.dataId ?? '').trim().toLowerCase();
    const requestId = input.requestId.trim().toLowerCase();
    const ts = input.ts.trim();

    if (dataId) {
      chunks.push(`id:${dataId};`);
    }
    if (requestId) {
      chunks.push(`request-id:${requestId};`);
    }
    if (ts) {
      chunks.push(`ts:${ts};`);
    }

    return chunks.join('');
  }

  private async ensurePreference(orderId: string, input: { payerEmail?: string }): Promise<{
    redirectUrl: string;
    created: boolean;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const existingRedirect = this.mp.pickRedirectUrl({
      initPoint: order.mpInitPoint,
      sandboxInitPoint: order.mpSandboxInitPoint,
    });
    if (order.mpPreferenceId && existingRedirect) {
      return { redirectUrl: existingRedirect, created: false };
    }

    const storeBaseUrl = (process.env.STORE_BASE_URL ?? 'http://localhost:4200').trim();
    const webhookUrl = (process.env.MP_NOTIFICATION_URL ?? '').trim();

    const backUrls =
      storeBaseUrl && storeBaseUrl.startsWith('http')
        ? {
            success: `${storeBaseUrl.replace(/\/+$/, '')}/checkout/mp/success`,
            pending: `${storeBaseUrl.replace(/\/+$/, '')}/checkout/mp/pending`,
            failure: `${storeBaseUrl.replace(/\/+$/, '')}/checkout/mp/failure`,
          }
        : undefined;

    const pref = await this.mp.createPreference(
      {
        orderId: order.id,
        payerEmail: input.payerEmail,
        notificationUrl: webhookUrl || undefined,
        backUrls,
        items: order.items.map((i) => ({
          title: i.productName,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
        })),
      },
      { idempotencyKey: `gt-mp-pref:${order.id}` },
    );

    const redirectUrl = this.mp.pickRedirectUrl({
      initPoint: pref.init_point,
      sandboxInitPoint: pref.sandbox_init_point,
    });
    if (!redirectUrl) {
      throw new BadRequestException('Mercado Pago: no devolvio un link de pago valido');
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        mpPreferenceId: pref.id,
        mpInitPoint: pref.init_point ?? null,
        mpSandboxInitPoint: pref.sandbox_init_point ?? null,
        mpPaymentStatus: order.mpPaymentStatus ?? 'created',
      },
    });

    return { redirectUrl, created: true };
  }
}
