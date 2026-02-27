export const SITE_CONTENT_KEYS = [
  'homeHeroTag',
  'homeHeroTitle',
  'homeHeroCopy',
  'homeFlashTitle',
  'homeFlashCopy',
  'homeRecoTitle',
  'homeRecoCopy',
  'catalogTitle',
  'catalogCopy',
] as const;

export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[number];

export type SiteContentMap = Record<SiteContentKey, string>;

const SITE_CONTENT_KEY_SET = new Set<string>(SITE_CONTENT_KEYS);

export function isSiteContentKey(value: string): value is SiteContentKey {
  return SITE_CONTENT_KEY_SET.has(value);
}

export const DEFAULT_SITE_CONTENT: SiteContentMap = {
  homeHeroTag: 'Geeky Drop de la semana',
  homeHeroTitle: 'Colecciona antes de que desaparezca del stock',
  homeHeroCopy:
    'Catalogo curado, compra rapida en mobile y carrito sincronizado aunque el cliente no inicie sesion. Llevate ediciones limitadas sin friccion.',
  homeFlashTitle: 'Hasta 25% en comics seleccionados',
  homeFlashCopy: 'Solo por tiempo limitado en el catalogo destacado.',
  homeRecoTitle: 'Armamos tu carrito ideal por fandom',
  homeRecoCopy: 'Explora por genero, autor, precio y disponibilidad real.',
  catalogTitle: 'Catalogo',
  catalogCopy:
    'Compra rapida: agrega al carrito sin loguearte. Si despues inicias sesion, se sincroniza automaticamente.',
};
