export type Product = {
  id: string;
  title: string;
  description: string;
  author: string;
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
  total: number;
  couponCode?: string;
};
