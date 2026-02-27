import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CartItem,
  Order,
  OrderQuote,
  PaymentMethod,
  Product,
  ProductFacets,
  ProductReview,
  StorefrontContent,
  UserProfile,
  WishlistItem,
} from './models';
import type { Product as ProductModel } from './models';

type ProductSort = 'recommended' | 'newest' | 'price_asc' | 'price_desc' | 'title_asc';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  getFeaturedProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/products?featured=true`);
  }

  getSiteContent() {
    return this.http.get<StorefrontContent>(`${this.baseUrl}/site-content/public`);
  }

  getProducts(params?: {
    search?: string;
    type?: ProductModel['type'];
    publisher?: string;
    genre?: string;
    seriesName?: string;
    language?: string;
    binding?: string;
    conditionLabel?: string;
    featured?: boolean;
    inStock?: boolean;
    minPrice?: number;
    maxPrice?: number;
    minYear?: number;
    maxYear?: number;
    minPages?: number;
    maxPages?: number;
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
    if (params?.publisher) {
      qs.set('publisher', params.publisher);
    }
    if (params?.genre) {
      qs.set('genre', params.genre);
    }
    if (params?.seriesName) {
      qs.set('seriesName', params.seriesName);
    }
    if (params?.language) {
      qs.set('language', params.language);
    }
    if (params?.binding) {
      qs.set('binding', params.binding);
    }
    if (params?.conditionLabel) {
      qs.set('conditionLabel', params.conditionLabel);
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
    if (params?.minYear !== undefined && Number.isFinite(params.minYear)) {
      qs.set('minYear', String(params.minYear));
    }
    if (params?.maxYear !== undefined && Number.isFinite(params.maxYear)) {
      qs.set('maxYear', String(params.maxYear));
    }
    if (params?.minPages !== undefined && Number.isFinite(params.minPages)) {
      qs.set('minPages', String(params.minPages));
    }
    if (params?.maxPages !== undefined && Number.isFinite(params.maxPages)) {
      qs.set('maxPages', String(params.maxPages));
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

  getProductFacets(params?: {
    search?: string;
    type?: ProductModel['type'];
    publisher?: string;
    genre?: string;
    seriesName?: string;
    language?: string;
    binding?: string;
    conditionLabel?: string;
    featured?: boolean;
    inStock?: boolean;
    minPrice?: number;
    maxPrice?: number;
    minYear?: number;
    maxYear?: number;
    minPages?: number;
    maxPages?: number;
  }): Observable<ProductFacets> {
    const qs = new URLSearchParams();
    if (params?.search) {
      qs.set('search', params.search);
    }
    if (params?.type) {
      qs.set('type', params.type);
    }
    if (params?.publisher) {
      qs.set('publisher', params.publisher);
    }
    if (params?.genre) {
      qs.set('genre', params.genre);
    }
    if (params?.seriesName) {
      qs.set('seriesName', params.seriesName);
    }
    if (params?.language) {
      qs.set('language', params.language);
    }
    if (params?.binding) {
      qs.set('binding', params.binding);
    }
    if (params?.conditionLabel) {
      qs.set('conditionLabel', params.conditionLabel);
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
    if (params?.minYear !== undefined && Number.isFinite(params.minYear)) {
      qs.set('minYear', String(params.minYear));
    }
    if (params?.maxYear !== undefined && Number.isFinite(params.maxYear)) {
      qs.set('maxYear', String(params.maxYear));
    }
    if (params?.minPages !== undefined && Number.isFinite(params.minPages)) {
      qs.set('minPages', String(params.minPages));
    }
    if (params?.maxPages !== undefined && Number.isFinite(params.maxPages)) {
      qs.set('maxPages', String(params.maxPages));
    }

    const query = qs.toString();
    return this.http.get<ProductFacets>(`${this.baseUrl}/products/facets${query ? `?${query}` : ''}`);
  }

  lookupProducts(ids: string[]): Observable<Product[]> {
    return this.http.post<Product[]>(`${this.baseUrl}/products/lookup`, { ids });
  }

  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${id}`);
  }

  getProductReviews(id: string, params?: { take?: number; skip?: number }) {
    const qs = new URLSearchParams();
    if (params?.take !== undefined) {
      qs.set('take', String(params.take));
    }
    if (params?.skip !== undefined) {
      qs.set('skip', String(params.skip));
    }
    const query = qs.toString();
    return this.http.get<{ items: ProductReview[]; summary: { count: number; avgRating: number | null } }>(
      `${this.baseUrl}/products/${id}/reviews${query ? `?${query}` : ''}`,
    );
  }

  upsertProductReview(id: string, payload: { rating: number; title?: string; comment?: string }) {
    return this.http.post<ProductReview>(`${this.baseUrl}/products/${id}/reviews`, payload);
  }

  removeMyProductReview(id: string) {
    return this.http.delete<{ removed: boolean }>(`${this.baseUrl}/products/${id}/reviews/me`);
  }

  getWishlist() {
    return this.http.get<WishlistItem[]>(`${this.baseUrl}/products/wishlist/me`);
  }

  addWishlist(productId: string) {
    return this.http.post<WishlistItem>(`${this.baseUrl}/products/wishlist/${productId}`, {});
  }

  removeWishlist(productId: string) {
    return this.http.delete<{ removed: boolean }>(`${this.baseUrl}/products/wishlist/${productId}`);
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

  quoteFromCart(payload: { couponCode?: string; shippingCity?: string; shippingPostalCode?: string }) {
    return this.http.post<OrderQuote>(`${this.baseUrl}/orders/quote`, payload);
  }

  quoteGuest(payload: {
    items: Array<{ productId: string; quantity: number }>;
    couponCode?: string;
    shippingCity?: string;
    shippingPostalCode?: string;
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
    shippingCity?: string;
    shippingPostalCode?: string;
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
    payload: {
      couponCode?: string;
      paymentMethod?: PaymentMethod;
      notes?: string;
      shippingCity?: string;
      shippingPostalCode?: string;
    },
    opts?: { idempotencyKey?: string },
  ) {
    const headers = opts?.idempotencyKey
      ? { 'Idempotency-Key': opts.idempotencyKey }
      : undefined;
    return this.http.post<Order>(`${this.baseUrl}/orders/checkout`, payload, headers ? { headers } : undefined);
  }

  checkoutMercadoPago(
    payload: { couponCode?: string; notes?: string; shippingCity?: string; shippingPostalCode?: string },
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
      shippingCity?: string;
      shippingPostalCode?: string;
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
