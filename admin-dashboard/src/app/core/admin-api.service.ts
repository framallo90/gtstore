import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  AdminDashboardSummary,
  AdminAnalyticsSummary,
  AdminSiteContent,
  CachedError,
  AuditLog,
  AdminOrder,
  AdminProduct,
  AdminUser,
  OrderStatus,
  ProductType,
  Role,
} from './models';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  login(payload: { email: string; password: string }) {
    return this.http.post<{ user: AdminUser; accessToken: string }>(
      `${this.baseUrl}/auth/admin/login`,
      payload,
    );
  }

  logout() {
    return this.http.post<{ success: true }>(`${this.baseUrl}/auth/logout`, {});
  }

  dashboard() {
    return this.http.get<AdminDashboardSummary>(
      `${this.baseUrl}/orders/admin/dashboard-summary`,
    );
  }

  analyticsSummary(days = 7) {
    return this.http.get<AdminAnalyticsSummary>(
      `${this.baseUrl}/analytics/admin/summary?days=${encodeURIComponent(String(days))}`,
    );
  }

  listProducts() {
    return this.http.get<AdminProduct[]>(`${this.baseUrl}/products/admin/all`);
  }

  createProduct(payload: {
    title: string;
    subtitle?: string;
    description: string;
    author: string;
    publisher?: string;
    genre?: string;
    seriesName?: string;
    seriesNumber?: number;
    language?: string;
    binding?: string;
    edition?: string;
    translator?: string;
    illustrator?: string;
    narrator?: string;
    editor?: string;
    originCountry?: string;
    isbn?: string;
    isbn10?: string;
    isbn13?: string;
    ean?: string;
    sku: string;
    type: ProductType;
    publicationYear?: number;
    publicationDate?: string;
    pageCount?: number;
    dimensions?: string;
    heightCm?: number;
    widthCm?: number;
    thicknessCm?: number;
    weightGrams?: number;
    conditionLabel?: string;
    shippingEtaMinDays?: number;
    shippingEtaMaxDays?: number;
    price: number;
    stock: number;
    coverUrl?: string;
    isFeatured?: boolean;
    isActive?: boolean;
  }) {
    return this.http.post<AdminProduct>(`${this.baseUrl}/products`, payload);
  }

  updateProduct(
    id: string,
    payload: Partial<{
      title: string;
      subtitle?: string;
      description: string;
      author: string;
      publisher?: string;
      genre?: string;
      seriesName?: string;
      seriesNumber?: number;
      language?: string;
      binding?: string;
      edition?: string;
      translator?: string;
      illustrator?: string;
      narrator?: string;
      editor?: string;
      originCountry?: string;
      isbn?: string;
      isbn10?: string;
      isbn13?: string;
      ean?: string;
      sku: string;
      type: ProductType;
      publicationYear?: number;
      publicationDate?: string;
      pageCount?: number;
      dimensions?: string;
      heightCm?: number;
      widthCm?: number;
      thicknessCm?: number;
      weightGrams?: number;
      conditionLabel?: string;
      shippingEtaMinDays?: number;
      shippingEtaMaxDays?: number;
      price: number;
      stock: number;
      coverUrl?: string;
      isFeatured: boolean;
      isActive: boolean;
    }>,
  ) {
    return this.http.patch<AdminProduct>(`${this.baseUrl}/products/${id}`, payload);
  }

  deleteProduct(id: string) {
    return this.http.delete(`${this.baseUrl}/products/${id}`);
  }

  listOrders() {
    return this.http.get<AdminOrder[]>(`${this.baseUrl}/orders/admin/all`);
  }

  updateOrderStatus(id: string, status: OrderStatus) {
    return this.http.patch<AdminOrder>(`${this.baseUrl}/orders/${id}/status`, { status });
  }

  listUsers() {
    return this.http.get<AdminUser[]>(`${this.baseUrl}/users`);
  }

  updateUserRole(id: string, role: Role) {
    return this.http.patch<AdminUser>(`${this.baseUrl}/users/${id}/role`, { role });
  }

  updateUser(
    id: string,
    payload: Partial<{
      email: string;
      firstName: string;
      lastName: string;
      role: Role;
      password: string;
    }>,
  ) {
    return this.http.patch<AdminUser>(`${this.baseUrl}/users/${id}`, payload);
  }

  deleteUser(id: string) {
    return this.http.delete<{ success: boolean; deactivatedUser: AdminUser }>(
      `${this.baseUrl}/users/${id}`,
    );
  }

  reactivateUser(id: string) {
    return this.http.patch<{ success: boolean; reactivatedUser: AdminUser }>(
      `${this.baseUrl}/users/${id}/reactivate`,
      {},
    );
  }

  recentErrors(limit = 20) {
    const safe = Math.max(1, Math.min(200, Math.trunc(limit)));
    return this.http.get<{ items: CachedError[] }>(
      `${this.baseUrl}/errors/recent?limit=${encodeURIComponent(String(safe))}`,
    );
  }

  recentAuditLogs(limit = 20) {
    const safe = Math.max(1, Math.min(200, Math.trunc(limit)));
    return this.http.get<{ items: AuditLog[] }>(
      `${this.baseUrl}/audit/recent?limit=${encodeURIComponent(String(safe))}`,
    );
  }

  getSiteContent() {
    return this.http.get<AdminSiteContent>(`${this.baseUrl}/site-content/admin`);
  }

  updateSiteContent(payload: Partial<AdminSiteContent>) {
    return this.http.put<AdminSiteContent>(`${this.baseUrl}/site-content/admin`, payload);
  }
}
