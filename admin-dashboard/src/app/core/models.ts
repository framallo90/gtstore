export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export type ProductType = 'BOOK' | 'COMIC';

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELED';

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'MERCADOPAGO';

export type AdminDashboardSummary = {
  ordersCount: number;
  revenue: number;
  lowStockProducts: Array<{ id: string; title: string; stock: number }>;
};

export type AdminAnalyticsSummary = {
  from: string;
  to: string;
  days: number;
  totalEvents: number;
  uniqueVisitors: number;
  uniqueSessions: number;
  byName: Array<{ name: string; count: number }>;
  funnel: {
    addToCart: number;
    beginCheckout: number;
    purchaseSuccess: number;
    rates?: {
      beginCheckoutPerAddToCart: number;
      purchasePerBeginCheckout: number;
    };
  };
  devices?: Array<{ deviceClass: string; count: number }>;
  timeseries?: Array<{
    day: string;
    pageViews: number;
    addToCart: number;
    beginCheckout: number;
    purchaseSuccess: number;
  }>;
  topProducts?: {
    addToCart: Array<{ productId: string; title: string; type: string | null; count: number }>;
    productView: Array<{ productId: string; title: string; type: string | null; count: number }>;
  };
};

export type CachedError = {
  id: string;
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  message: string;
  name?: string;
  userId?: string;
};

export type AuditLog = {
  id: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: unknown;
  createdAt: string;
};

export type AdminProduct = {
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
  heightCm?: number | string | null;
  widthCm?: number | string | null;
  thicknessCm?: number | string | null;
  weightGrams?: number | null;
  conditionLabel?: string | null;
  isbn?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  ean?: string | null;
  shippingEtaMinDays?: number | null;
  shippingEtaMaxDays?: number | null;
  sku: string;
  type: ProductType;
  price: number | string;
  stock: number;
  coverUrl?: string | null;
  isFeatured: boolean;
  isActive: boolean;
};

export type AdminOrder = {
  id: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod | null;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  couponCode?: string | null;
  notes?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number | string;
    productName: string;
  }>;
};

export type AdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive?: boolean;
  deactivatedAt?: string | null;
  lastLoginAt?: string | null;
  lastSeenAt?: string | null;
  emailVerifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminSiteContent = {
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
