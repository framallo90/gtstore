import { ConfigService } from '@nestjs/config';
import { MercadoPagoService } from './mercadopago.service';

function makeConfig(env: 'sandbox' | 'production') {
  return {
    get: jest.fn((key: string) => {
      if (key === 'MP_ENV') {
        return env;
      }
      return undefined;
    }),
  } as unknown as ConfigService;
}

describe('MercadoPagoService', () => {
  it('prefers sandbox URL in sandbox mode', () => {
    const service = new MercadoPagoService(makeConfig('sandbox'));

    const out = service.pickRedirectUrl({
      sandboxInitPoint: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=safe',
      initPoint: 'https://www.mercadopago.com/checkout/v1/redirect?pref_id=prod',
    });

    expect(out).toBe('https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=safe');
  });

  it('falls back to initPoint when sandbox URL is invalid', () => {
    const service = new MercadoPagoService(makeConfig('sandbox'));

    const out = service.pickRedirectUrl({
      sandboxInitPoint: 'https://evil.example/redirect',
      initPoint: 'https://www.mercadopago.com/checkout/v1/redirect?pref_id=prod',
    });

    expect(out).toBe('https://www.mercadopago.com/checkout/v1/redirect?pref_id=prod');
  });

  it('prefers initPoint in production mode', () => {
    const service = new MercadoPagoService(makeConfig('production'));

    const out = service.pickRedirectUrl({
      initPoint: 'https://www.mercadopago.com/checkout/v1/redirect?pref_id=prod',
      sandboxInitPoint: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=safe',
    });

    expect(out).toBe('https://www.mercadopago.com/checkout/v1/redirect?pref_id=prod');
  });

  it('rejects non-https redirects', () => {
    const service = new MercadoPagoService(makeConfig('production'));

    const out = service.pickRedirectUrl({
      initPoint: 'http://www.mercadopago.com/checkout/v1/redirect?pref_id=insecure',
      sandboxInitPoint: null,
    });

    expect(out).toBeUndefined();
  });

  it('rejects lookalike hostnames not owned by Mercado Pago', () => {
    const service = new MercadoPagoService(makeConfig('production'));

    const out = service.pickRedirectUrl({
      initPoint: 'https://mercadopago.com.evil.com/checkout/v1/redirect?pref_id=phishing',
      sandboxInitPoint: null,
    });

    expect(out).toBeUndefined();
  });
});

