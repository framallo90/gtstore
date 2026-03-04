import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AndreaniQuoteItem = {
  quantity: number;
  weightGrams?: unknown;
  heightCm?: unknown;
  widthCm?: unknown;
  depthCm?: unknown;
};

export type AndreaniQuoteInput = {
  destinationPostalCode: string;
  destinationCity: string;
  declaredValue: number;
  senderProvince?: string;
  senderDistrict?: string;
  senderLocality?: string;
  senderZipCode?: string;
  items: AndreaniQuoteItem[];
};

export type AndreaniQuoteOutput = {
  provider: 'ANDREANI';
  service: string;
  amount: number;
  currency: 'ARS';
};

type AndreaniLoginResponse = {
  token?: unknown;
  jwt?: unknown;
  access_token?: unknown;
};

type AndreaniQuoteResponse = {
  tarifaConIva?: { total?: unknown };
  UltimaMilla?: unknown;
};

@Injectable()
export class AndreaniShippingService {
  private readonly loginUrl = 'https://apis.andreani.com/v2/login';
  private readonly quoteUrl = 'https://apis.andreani.com/cotizador-globallpack/api/v1/Cotizador';
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    const raw = (this.config.get<string>('ANDREANI_ENABLED') ?? '')
      .trim()
      .toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
  }

  async quote(input: AndreaniQuoteInput): Promise<AndreaniQuoteOutput> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException('Andreani shipping is not configured');
    }

    const destinationPostalCode = this.normalizePostalCode(input.destinationPostalCode);
    const destinationCity = this.normalizeCity(input.destinationCity);
    if (!destinationPostalCode || !destinationCity) {
      throw new BadRequestException('Shipping city and postal code are required');
    }

    const senderContract = this.requireEnv('ANDREANI_SENDER_CONTRACT');
    const senderClient = this.requireEnv('ANDREANI_SENDER_CLIENT');
    const senderProvince =
      this.normalizeOptionalText(input.senderProvince) ??
      this.requireEnv('ANDREANI_SENDER_PROVINCE');
    const senderDistrict =
      this.normalizeOptionalText(input.senderDistrict) ??
      this.requireEnv('ANDREANI_SENDER_DISTRICT');
    const senderLocality =
      this.normalizeOptionalText(input.senderLocality) ??
      this.requireEnv('ANDREANI_SENDER_LOCALITY');
    const senderZipCode =
      this.normalizeOptionalText(input.senderZipCode) ??
      this.requireEnv('ANDREANI_SENDER_ZIP_CODE');

    const receiverProvince =
      this.readEnv('ANDREANI_RECEIVER_PROVINCE') || this.readEnv('ANDREANI_SENDER_PROVINCE');
    const receiverDistrict =
      this.readEnv('ANDREANI_RECEIVER_DISTRICT') || destinationCity;
    const receiverLocality =
      this.readEnv('ANDREANI_RECEIVER_LOCALITY') || destinationCity;

    const sourceCountry = this.readEnv('ANDREANI_SOURCE_COUNTRY') || 'AR';
    const receiverCountry = this.readEnv('ANDREANI_RECEIVER_COUNTRY') || 'AR';
    const productType = this.readEnv('ANDREANI_PRODUCT_TYPE') || 'LIBROS';

    const packageMetrics = this.buildPackageMetrics(input.items);
    const declaredValue = this.roundTo2(Math.max(1, input.declaredValue));

    const query = new URLSearchParams();
    query.set('sourceCountry', sourceCountry);
    query.set('senderContract', senderContract);
    query.set('senderClient', senderClient);
    query.set('senderProvince', senderProvince);
    query.set('senderDistrict', senderDistrict);
    query.set('senderLocality', senderLocality);
    query.set('senderZipCode', senderZipCode);
    query.set('receiverCountry', receiverCountry);
    query.set('receiverProvince', receiverProvince || destinationCity);
    query.set('receiverDistrict', receiverDistrict);
    query.set('receiverLocality', receiverLocality);
    query.set('receiverZipCode', destinationPostalCode);
    query.set('packageVolume', String(packageMetrics.volumeCm3));
    query.set('packageHeight', String(packageMetrics.heightCm));
    query.set('packageWidth', String(packageMetrics.widthCm));
    query.set('packageDepth', String(packageMetrics.depthCm));
    query.set('packageWeight', String(packageMetrics.weightKg));
    query.set('packageDeclaredValue', String(declaredValue));
    query.set('productType', productType);

    const token = await this.getToken();
    const timeoutMs = this.getPositiveNumber('ANDREANI_TIMEOUT_MS', 8000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.quoteUrl}?${query.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-authorization-token': token,
        },
        signal: controller.signal,
      });
    } catch {
      throw new ServiceUnavailableException('Andreani quote request failed');
    } finally {
      clearTimeout(timeout);
    }

    const payload = await this.safeJson<AndreaniQuoteResponse>(response);
    if (!response.ok) {
      const message = this.extractApiMessage(payload);
      throw new BadRequestException(
        message
          ? `Andreani quote failed: ${message}`
          : `Andreani quote failed with status ${response.status}`,
      );
    }

    const amountCandidate =
      this.toNumber(payload?.tarifaConIva?.total) ??
      this.toNumber(payload?.UltimaMilla);
    if (
      typeof amountCandidate !== 'number' ||
      !Number.isFinite(amountCandidate) ||
      amountCandidate <= 0
    ) {
      throw new BadRequestException('Andreani quote returned an invalid amount');
    }
    const amount: number = amountCandidate;

    return {
      provider: 'ANDREANI',
      service: 'GlobAllPack',
      amount: this.roundTo2(amount),
      currency: 'ARS',
    };
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now) {
      return this.tokenCache.token;
    }

    const username = this.requireEnv('ANDREANI_USERNAME');
    const password = this.requireEnv('ANDREANI_PASSWORD');
    const timeoutMs = this.getPositiveNumber('ANDREANI_TIMEOUT_MS', 8000);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      const auth = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
      response = await fetch(this.loginUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${auth}`,
        },
        signal: controller.signal,
      });
    } catch {
      throw new ServiceUnavailableException('Andreani auth request failed');
    } finally {
      clearTimeout(timeout);
    }

    const payload = await this.safeJson<AndreaniLoginResponse>(response);
    if (!response.ok) {
      const message = this.extractApiMessage(payload);
      throw new ServiceUnavailableException(
        message
          ? `Andreani auth failed: ${message}`
          : `Andreani auth failed with status ${response.status}`,
      );
    }

    const tokenCandidate =
      (typeof payload?.token === 'string' && payload.token.trim()) ||
      (typeof payload?.jwt === 'string' && payload.jwt.trim()) ||
      (typeof payload?.access_token === 'string' && payload.access_token.trim()) ||
      '';

    if (!tokenCandidate) {
      throw new ServiceUnavailableException('Andreani auth returned no token');
    }

    const ttlMs = this.getPositiveNumber('ANDREANI_TOKEN_TTL_MS', 20 * 60 * 60 * 1000);
    this.tokenCache = {
      token: tokenCandidate,
      expiresAt: now + ttlMs,
    };

    return tokenCandidate;
  }

  private buildPackageMetrics(items: AndreaniQuoteItem[]) {
    const defaultWeightGrams = this.getPositiveNumber('ANDREANI_DEFAULT_WEIGHT_GRAMS', 500);
    const defaultHeightCm = this.getPositiveNumber('ANDREANI_DEFAULT_HEIGHT_CM', 25);
    const defaultWidthCm = this.getPositiveNumber('ANDREANI_DEFAULT_WIDTH_CM', 18);
    const defaultDepthCm = this.getPositiveNumber('ANDREANI_DEFAULT_DEPTH_CM', 4);
    const minWeightKg = this.getPositiveNumber('ANDREANI_MIN_WEIGHT_KG', 0.1);

    let totalWeightGrams = 0;
    let maxHeightCm = 0;
    let maxWidthCm = 0;
    let totalDepthCm = 0;

    for (const raw of items ?? []) {
      const quantity = Number.isFinite(raw.quantity)
        ? Math.max(1, Math.trunc(raw.quantity))
        : 1;
      const weightGrams = this.toNumber(raw.weightGrams) ?? defaultWeightGrams;
      const heightCm = this.toNumber(raw.heightCm) ?? defaultHeightCm;
      const widthCm = this.toNumber(raw.widthCm) ?? defaultWidthCm;
      const depthCm = this.toNumber(raw.depthCm) ?? defaultDepthCm;

      totalWeightGrams += Math.max(1, weightGrams) * quantity;
      maxHeightCm = Math.max(maxHeightCm, Math.max(1, heightCm));
      maxWidthCm = Math.max(maxWidthCm, Math.max(1, widthCm));
      totalDepthCm += Math.max(1, depthCm) * quantity;
    }

    if (totalWeightGrams <= 0) {
      totalWeightGrams = defaultWeightGrams;
    }
    if (maxHeightCm <= 0) {
      maxHeightCm = defaultHeightCm;
    }
    if (maxWidthCm <= 0) {
      maxWidthCm = defaultWidthCm;
    }
    if (totalDepthCm <= 0) {
      totalDepthCm = defaultDepthCm;
    }

    const weightKg = this.roundTo3(Math.max(minWeightKg, totalWeightGrams / 1000));
    const heightCm = this.roundTo2(maxHeightCm);
    const widthCm = this.roundTo2(maxWidthCm);
    const depthCm = this.roundTo2(totalDepthCm);
    const volumeCm3 = this.roundTo2(Math.max(1, heightCm * widthCm * depthCm));

    return { weightKg, heightCm, widthCm, depthCm, volumeCm3 };
  }

  private normalizeCity(input: string | undefined): string | undefined {
    if (!input) {
      return undefined;
    }
    const trimmed = input.trim();
    if (!trimmed) {
      return undefined;
    }
    return trimmed.slice(0, 120);
  }

  private normalizePostalCode(input: string | undefined): string | undefined {
    if (!input) {
      return undefined;
    }
    const trimmed = input.trim().toUpperCase();
    if (!trimmed) {
      return undefined;
    }
    return trimmed.slice(0, 10);
  }

  private readEnv(name: string): string | undefined {
    const raw = this.config.get<string>(name);
    if (typeof raw !== 'string') {
      return undefined;
    }
    const trimmed = raw.trim();
    return trimmed || undefined;
  }

  private normalizeOptionalText(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private requireEnv(name: string): string {
    const value = this.readEnv(name);
    if (!value) {
      throw new ServiceUnavailableException(`${name} is required for Andreani shipping`);
    }
    return value;
  }

  private getPositiveNumber(name: string, fallback: number): number {
    const raw = this.readEnv(name);
    const parsed = raw ? Number(raw) : Number.NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return fallback;
  }

  private toNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.').replace(/[^\d.-]/g, '');
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    if (typeof value === 'object' && value !== null && 'toString' in value) {
      const asString = String(value);
      const parsed = Number(asString);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }

  private roundTo2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundTo3(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  private async safeJson<T>(response: Response): Promise<T | undefined> {
    const text = await response.text();
    if (!text) {
      return undefined;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      return undefined;
    }
  }

  private extractApiMessage(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }
    const p = payload as Record<string, unknown>;
    if (typeof p['message'] === 'string') {
      return p['message'];
    }
    if (typeof p['error'] === 'string') {
      return p['error'];
    }
    return undefined;
  }
}
