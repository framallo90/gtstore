import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CartItem, Order, OrderQuote, PaymentMethod, Product, UserProfile } from './models';
import type { Product as ProductModel } from './models';

type ProductSort = 'recommended' | 'newest' | 'price_asc' | 'price_desc' | 'title_asc';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  getFeaturedProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/products?featured=true`);
  }

  getProducts(params?: {
    search?: string;
    type?: ProductModel['type'];
    featured?: boolean;
    inStock?: boolean;
    minPrice?: number;
    maxPrice?: number;
    sort?: ProductSort;
    take?: number;
    skip?: number;
  }): Observable<Product[]> {
    const qs = new URLSearchParams();
    if (params?.search) {
      qs.set('search', params.search);
    }
    if (params?.type) {
      qs.set('type', params.type);
    }
    if (params?.featured !== undefined) {
      qs.set('featured', String(params.featured));
    }
    if (params?.inStock !== undefined) {
      qs.set('inStock', String(params.inStock));
    }
    if (params?.minPrice !== undefined && Number.isFinite(params.minPrice)) {
      qs.set('minPrice', String(params.minPrice));
    }
    if (params?.maxPrice !== undefined && Number.isFinite(params.maxPrice)) {
      qs.set('maxPrice', String(params.maxPrice));
    }
    if (params?.sort) {
      qs.set('sort', params.sort);
    }
    if (params?.take !== undefined) {
      qs.set('take', String(params.take));
    }
    if (params?.skip !== undefined) {
      qs.set('skip', String(params.skip));
    }

    const query = qs.toString();
    return this.http.get<Product[]>(`${this.baseUrl}/products${query ? `?${query}` : ''}`);
  }

  lookupProducts(ids: string[]): Observable<Product[]> {
    return this.http.post<Product[]>(`${this.baseUrl}/products/lookup`, { ids });
  }

  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${id}`);
  }

  register(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    return this.http.post<{ user: UserProfile; accessToken: string }>(
      `${this.baseUrl}/auth/register`,
      payload,
    );
  }

  login(payload: { email: string; password: string }) {
    return this.http.post<{ user: UserProfile; accessToken: string }>(
      `${this.baseUrl}/auth/login`,
      payload,
    );
  }

  me() {
    return this.http.get<UserProfile>(`${this.baseUrl}/auth/me`);
  }

  refresh() {
    return this.http.post<{ user: UserProfile; accessToken: string }>(
      `${this.baseUrl}/auth/refresh`,
      {},
    );
  }

  verifyEmail(token: string) {
    return this.http.post<{ success: true }>(`${this.baseUrl}/auth/verify-email`, { token });
  }

  requestPasswordReset(email: string) {
    return this.http.post<{ success: true }>(`${this.baseUrl}/auth/password/forgot`, { email });
  }

  resetPassword(token: string, password: string) {
    return this.http.post<{ success: true }>(`${this.baseUrl}/auth/password/reset`, { token, password });
  }

  logout() {
    return this.http.post<{ success: true }>(`${this.baseUrl}/auth/logout`, {});
  }

  getCart() {
    return this.http.get<{ items: CartItem[]; total: number }>(`${this.baseUrl}/cart`);
  }

  upsertCartItem(productId: string, quantity: number) {
    return this.http.post(`${this.baseUrl}/cart/items`, { productId, quantity });
  }

  removeCartItem(productId: string) {
    return this.http.delete(`${this.baseUrl}/cart/items/${productId}`);
  }

  clearCart() {
    return this.http.delete(`${this.baseUrl}/cart`);
  }

  syncCart(items: Array<{ productId: string; quantity: number }>) {
    return this.http.post<{ items: CartItem[]; total: number }>(
      `${this.baseUrl}/cart/sync`,
      { items },
    );
  }

  quoteFromCart(payload: { couponCode?: string }) {
    return this.http.post<OrderQuote>(`${this.baseUrl}/orders/quote`, payload);
  }

  quoteGuest(payload: {
    items: Array<{ productId: string; quantity: number }>;
    couponCode?: string;
  }) {
    return this.http.post<OrderQuote>(`${this.baseUrl}/orders/guest/quote`, payload);
  }

  guestCheckout(payload: {
    items: Array<{ productId: string; quantity: number }>;
    couponCode?: string;
    paymentMethod?: PaymentMethod;
    notes?: string;
    guestEmail: string;
    guestFirstName: string;
    guestLastName: string;
  }, opts?: { idempotencyKey?: string }) {
    const headers = opts?.idempotencyKey
      ? { 'Idempotency-Key': opts.idempotencyKey }
      : undefined;

    return this.http.post<Order>(
      `${this.baseUrl}/orders/guest/checkout`,
      payload,
      headers ? { headers } : undefined,
    );
  }

  checkout(
    payload: { couponCode?: string; paymentMethod?: PaymentMethod; notes?: string },
    opts?: { idempotencyKey?: string },
  ) {
    const headers = opts?.idempotencyKey
      ? { 'Idempotency-Key': opts.idempotencyKey }
      : undefined;
    return this.http.post<Order>(`${this.baseUrl}/orders/checkout`, payload, headers ? { headers } : undefined);
  }

  checkoutMercadoPago(
    payload: { couponCode?: string; notes?: string },
    opts?: { idempotencyKey?: string },
  ) {
    const headers = opts?.idempotencyKey
      ? { 'Idempotency-Key': opts.idempotencyKey }
      : undefined;
    return this.http.post<{ orderId: string; redirectUrl: string }>(
      `${this.baseUrl}/payments/mercadopago/checkout`,
      payload,
      headers ? { headers } : undefined,
    );
  }

  guestCheckoutMercadoPago(
    payload: {
      items: Array<{ productId: string; quantity: number }>;
      couponCode?: string;
      notes?: string;
      guestEmail: string;
      guestFirstName: string;
      guestLastName: string;
    },
    opts?: { idempotencyKey?: string },
  ) {
    const headers = opts?.idempotencyKey
      ? { 'Idempotency-Key': opts.idempotencyKey }
      : undefined;

    return this.http.post<{ orderId: string; redirectUrl: string }>(
      `${this.baseUrl}/payments/mercadopago/guest/checkout`,
      payload,
      headers ? { headers } : undefined,
    );
  }

  myOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.baseUrl}/orders/me`);
  }
}
