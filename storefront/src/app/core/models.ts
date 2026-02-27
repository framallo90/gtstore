export type Product = {
  id: string;
  title: string;
  subtitle?: string | null;
  description: string;
  author: string;
  publisher?: string | null;
  genre?: string | null;
  seriesName?: string | null;
  seriesNumber?: number | null;
  language?: string | null;
  binding?: string | null;
  edition?: string | null;
  translator?: string | null;
  illustrator?: string | null;
  narrator?: string | null;
  editor?: string | null;
  originCountry?: string | null;
  publicationYear?: number | null;
  publicationDate?: string | null;
  pageCount?: number | null;
  dimensions?: string | null;
  heightCm?: number | null;
  widthCm?: number | null;
  thicknessCm?: number | null;
  weightGrams?: number | null;
  conditionLabel?: string | null;
  isbn?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  ean?: string | null;
  shippingEtaMinDays?: number | null;
  shippingEtaMaxDays?: number | null;
  price: number;
  stock: number;
  type: 'BOOK' | 'COMIC';
  isFeatured: boolean;
  coverUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CartItem = {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
};

export type FacetCount<TValue extends string = string> = {
  value: TValue;
  count: number;
};

export type ProductFacets = {
  total: number;
  facets: {
    type: FacetCount<'BOOK' | 'COMIC'>[];
    language: FacetCount[];
    binding: FacetCount[];
    conditionLabel: FacetCount[];
    genre: FacetCount[];
    publisher: FacetCount[];
  };
};

export type WishlistItem = {
  id: string;
  productId: string;
  createdAt: string;
  product: Product;
};

export type ProductReview = {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
};

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELED';

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'MERCADOPAGO';

export type OrderItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number | string;
  productName: string;
};

export type Order = {
  id: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod | null;
  shippingProvider?: string | null;
  shippingCity?: string | null;
  shippingPostalCode?: string | null;
  shippingCost?: number | string | null;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  couponCode?: string | null;
  notes?: string | null;
  createdAt: string;
  items: OrderItem[];
};

export type OrderQuote = {
  subtotal: number;
  discount: number;
  shippingCost?: number;
  shippingProvider?: string;
  shippingCity?: string;
  shippingPostalCode?: string;
  total: number;
  couponCode?: string;
};

export type StorefrontContent = {
  homeHeroTag: string;
  homeHeroTitle: string;
  homeHeroCopy: string;
  homeFlashTitle: string;
  homeFlashCopy: string;
  homeRecoTitle: string;
  homeRecoCopy: string;
  catalogTitle: string;
  catalogCopy: string;
};
