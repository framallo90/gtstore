import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  AdminDashboardSummary,
  AdminAnalyticsSummary,
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
    description: string;
    author: string;
    publisher?: string;
    isbn?: string;
    sku: string;
    type: ProductType;
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
      description: string;
      author: string;
      publisher?: string;
      isbn?: string;
      sku: string;
      type: ProductType;
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
}
