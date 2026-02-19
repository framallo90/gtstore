import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type MercadoPagoPreferenceInput = {
  orderId: string;
  payerEmail?: string;
  items: Array<{ title: string; quantity: number; unitPrice: number }>;
  currencyId?: string;
  notificationUrl?: string;
  backUrls?: { success: string; pending: string; failure: string };
};

export type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

export type MercadoPagoPaymentResponse = {
  id: number;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  preference_id?: string;
  merchant_order_id?: number;
  transaction_amount?: number;
  currency_id?: string;
  metadata?: unknown;
};

@Injectable()
export class MercadoPagoService {
  private readonly apiBase = 'https://api.mercadopago.com';

  constructor(private readonly config: ConfigService) {}

  isSandbox() {
    const raw = (this.config.get<string>('MP_ENV') ?? '').toLowerCase().trim();
    return raw === 'sandbox';
  }

  pickRedirectUrl(input: {
    initPoint?: string | null;
    sandboxInitPoint?: string | null;
  }): string | undefined {
    const candidates = this.isSandbox()
      ? [input.sandboxInitPoint, input.initPoint]
      : [input.initPoint, input.sandboxInitPoint];

    for (const candidate of candidates) {
      const safe = this.sanitizeRedirectUrl(candidate);
      if (safe) {
        return safe;
      }
    }

    return undefined;
  }

  async createPreference(
    input: MercadoPagoPreferenceInput,
    opts?: { idempotencyKey?: string },
  ): Promise<MercadoPagoPreferenceResponse> {
    const currencyId =
      input.currencyId ??
      (this.config.get<string>('MP_CURRENCY_ID') ?? 'USD').trim();

    const body = {
      external_reference: input.orderId,
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      items: input.items.map((i) => ({
        title: i.title,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        currency_id: currencyId,
      })),
      notification_url: input.notificationUrl,
      back_urls: input.backUrls,
      auto_return: input.backUrls ? 'approved' : undefined,
      metadata: { orderId: input.orderId },
    };

    const res = await this.request<MercadoPagoPreferenceResponse>(
      'POST',
      '/checkout/preferences',
      body,
      { idempotencyKey: opts?.idempotencyKey },
    );

    if (!res?.id) {
      throw new BadRequestException('Mercado Pago: respuesta invalida al crear preferencia');
    }

    return res;
  }

  getPayment(paymentId: string) {
    return this.request<MercadoPagoPaymentResponse>(
      'GET',
      `/v1/payments/${encodeURIComponent(paymentId)}`,
    );
  }

  private getAccessToken() {
    const token = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!token) {
      throw new ServiceUnavailableException('Mercado Pago no esta configurado');
    }
    return token;
  }

  private sanitizeRedirectUrl(input: string | null | undefined): string | undefined {
    if (!input) {
      return undefined;
    }

    try {
      const parsed = new URL(input);
      if (parsed.protocol !== 'https:') {
        return undefined;
      }

      const hostname = parsed.hostname.toLowerCase();
      // Restrict payment redirects to Mercado Pago owned domains only.
      if (!/(^|\.)mercadopago\.(com(\.[a-z]{2})?|[a-z]{2,3})$/i.test(hostname)) {
        return undefined;
      }

      return parsed.toString();
    } catch {
      return undefined;
    }
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    opts?: { idempotencyKey?: string },
  ): Promise<T> {
    const token = this.getAccessToken();
    const url = `${this.apiBase}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (opts?.idempotencyKey) {
      headers['X-Idempotency-Key'] = opts.idempotencyKey.slice(0, 120);
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ServiceUnavailableException('Mercado Pago: no se pudo conectar');
    }

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        // ignore
      }
    }

    if (!res.ok) {
      const status = res.status;
      const mpMessage =
        typeof parsed === 'object' &&
        parsed &&
        'message' in parsed &&
        typeof (parsed as { message?: unknown }).message === 'string'
          ? (parsed as { message: string }).message
          : undefined;

      const suffix = mpMessage ? ` (${mpMessage})` : '';
      throw new BadRequestException(`Mercado Pago: request fallo con status ${status}${suffix}`);
    }

    return (parsed as T) ?? ({} as T);
  }
}
