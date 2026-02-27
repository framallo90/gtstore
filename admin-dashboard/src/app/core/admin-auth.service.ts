import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, map, Observable, of, shareReplay, tap } from 'rxjs';
import type { Role } from './models';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly sessionHintKey = 'gt_admin_has_session_v1';

  // Keep access token in-memory only (reduces blast radius if storage is compromised).
  private readonly tokenSignal = signal<string | null>(null);
  private restoreInFlight: Observable<boolean> | null = null;

  isLoggedIn() {
    const token = this.tokenSignal();
    return !!token && !this.isTokenExpired(token);
  }

  getToken() {
    return this.tokenSignal();
  }

  getRole(): Role | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }
    return this.decodeJwt(token)?.role ?? null;
  }

  getUserId(): string | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }
    return this.decodeJwt(token)?.sub ?? null;
  }

  hasAdminAccess() {
    const role = this.getRole();
    return role === 'ADMIN' || role === 'STAFF';
  }

  hasUserManagementAccess() {
    return this.getRole() === 'ADMIN';
  }

  isTokenAdminOrStaff(token: string) {
    const payload = this.decodeJwt(token);
    const role = payload?.role ?? null;
    return (
      !!role &&
      (role === 'ADMIN' || role === 'STAFF') &&
      !this.isTokenExpired(token)
    );
  }

  setToken(token: string) {
    this.tokenSignal.set(token);
    this.markSessionHint();
  }

  clearToken() {
    this.tokenSignal.set(null);
  }

  logout() {
    this.clearToken();
    this.clearSessionHint();
    this.router.navigateByUrl('/login');
  }

  restoreSessionFromHint(): Observable<boolean> {
    if (!this.hasSessionHint()) {
      return of(false);
    }
    return this.ensureSession();
  }

  ensureSession(): Observable<boolean> {
    if (this.isLoggedIn()) {
      return of(true);
    }

    if (!this.restoreInFlight) {
      this.restoreInFlight = this.http
        .post<{ accessToken: string }>('/api/auth/refresh', {}, { withCredentials: true })
        .pipe(
          tap((res) => this.setToken(res.accessToken)),
          map(() => true),
          catchError(() => {
            this.clearToken();
            this.clearSessionHint();
            return of(false);
          }),
          finalize(() => {
            this.restoreInFlight = null;
          }),
          shareReplay({ bufferSize: 1, refCount: true }),
        );
    }

    return this.restoreInFlight;
  }

  private hasSessionHint(): boolean {
    try {
      return localStorage.getItem(this.sessionHintKey) === '1';
    } catch {
      return false;
    }
  }

  private markSessionHint() {
    try {
      localStorage.setItem(this.sessionHintKey, '1');
    } catch {
      // ignore
    }
  }

  private clearSessionHint() {
    try {
      localStorage.removeItem(this.sessionHintKey);
    } catch {
      // ignore
    }
  }

  private isTokenExpired(token: string): boolean {
    const payload = this.decodeJwt(token);
    if (!payload?.exp) {
      return false;
    }
    return Date.now() >= payload.exp * 1000;
  }

  private decodeJwt(token: string): { exp?: number; role?: Role; sub?: string } | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) {
        return null;
      }
      const json = this.base64UrlDecode(parts[1]);
      return JSON.parse(json) as { exp?: number; role?: Role; sub?: string };
    } catch {
      return null;
    }
  }

  private base64UrlDecode(input: string): string {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = base64.length % 4;
    const padded = padLength ? base64 + '='.repeat(4 - padLength) : base64;
    return atob(padded);
  }
}
