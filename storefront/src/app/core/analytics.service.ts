import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

type AnalyticsPayload = {
  name: string;
  path?: string;
  anonymousId?: string;
  sessionId?: string;
  properties?: Record<string, unknown>;
};

const SENSITIVE_KEY_RE = /(token|password|secret|authorization|cookie|session|refresh)/i;
const JWT_RE = /\beyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\b/;
const HEX_TOKEN_RE = /\b[a-f0-9]{32,}\b/i;

function sanitizePathForAnalytics(input: string | undefined): string | undefined {
  if (typeof input !== 'string') {
    return undefined;
  }

  const raw = input.trim();
  if (!raw) {
    return undefined;
  }

  try {
    const base = typeof location !== 'undefined' ? location.origin : 'http://localhost';
    const parsed = new URL(raw, base);
    return parsed.pathname.slice(0, 300);
  } catch {
    const noHash = raw.split('#', 1)[0] ?? '';
    const noQuery = noHash.split('?', 1)[0] ?? '';
    if (!noQuery.startsWith('/')) {
      return undefined;
    }
    return noQuery.slice(0, 300);
  }
}

function sanitizeReferrerForAnalytics(input: string | undefined): string | undefined {
  if (typeof input !== 'string') {
    return undefined;
  }

  const raw = input.trim();
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 300);
  } catch {
    return undefined;
  }
}

function sanitizeStringValue(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  if (JWT_RE.test(trimmed) || HEX_TOKEN_RE.test(trimmed)) {
    return '<redacted>';
  }

  return trimmed.slice(0, 300);
}

function sanitizeProperties(input: unknown, depth = 0): unknown {
  if (depth > 4) {
    return undefined;
  }

  if (typeof input === 'string') {
    return sanitizeStringValue(input);
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }

  if (Array.isArray(input)) {
    return input
      .slice(0, 30)
      .map((item) => sanitizeProperties(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = '<redacted>';
        continue;
      }
      const sanitized = sanitizeProperties(value, depth + 1);
      if (sanitized !== undefined) {
        out[key] = sanitized;
      }
    }
    return out;
  }

  return undefined;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);

  private readonly anonymousKey = 'gt_anon_id';
  private readonly sessionKey = 'gt_session_id';
  private readonly contextKey = 'gt_analytics_ctx_v1';

  private readonly queue: AnalyticsPayload[] = [];
  private flushTimer: number | null = null;

  private readonly baseContext = this.loadOrCreateContext();

  getAnonymousId(): string {
    const existing = localStorage.getItem(this.anonymousKey);
    if (existing) {
      return existing;
    }
    const id = this.newId();
    localStorage.setItem(this.anonymousKey, id);
    return id;
  }

  getSessionId(): string {
    const existing = sessionStorage.getItem(this.sessionKey);
    if (existing) {
      return existing;
    }
    const id = this.newId();
    sessionStorage.setItem(this.sessionKey, id);
    return id;
  }

  pageView(path: string) {
    this.track('page_view', { path: sanitizePathForAnalytics(path) });
  }

  track(name: string, properties?: Record<string, unknown>) {
    const safeProps = sanitizeProperties(properties) as Record<string, unknown> | undefined;

    const payload: AnalyticsPayload = {
      name,
      path:
        typeof location !== 'undefined'
          ? sanitizePathForAnalytics(location.pathname + location.search)
          : undefined,
      anonymousId: this.getAnonymousId(),
      sessionId: this.getSessionId(),
      properties: {
        ...this.baseContext,
        ...(safeProps ?? {}),
        vw: typeof window !== 'undefined' ? window.innerWidth : undefined,
        vh: typeof window !== 'undefined' ? window.innerHeight : undefined,
        deviceClass:
          typeof window !== 'undefined'
            ? window.innerWidth < 760
              ? 'mobile'
              : window.innerWidth < 1024
                ? 'tablet'
                : 'desktop'
            : undefined,
      },
    };

    this.enqueue(payload);
  }

  flushNow(reason?: string) {
    this.flush({ reason });
  }

  private enqueue(payload: AnalyticsPayload) {
    this.queue.push(payload);
    while (this.queue.length > 50) {
      this.queue.shift();
    }

    if (this.queue.length >= 10) {
      this.flush();
      return;
    }

    if (this.flushTimer) {
      return;
    }

    const g = globalThis as unknown as { setTimeout?: typeof setTimeout };
    this.flushTimer = g.setTimeout?.(() => this.flush(), 900) ?? null;
  }

  private flush(extra?: { reason?: string }) {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, 25);
    const payload = {
      events: batch.map((e) => ({
        ...e,
        properties: {
          ...e.properties,
          flushReason: extra?.reason,
        },
      })),
    };

    this.http
      .post('/api/analytics/events/batch', payload)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private loadOrCreateContext(): Record<string, unknown> {
    try {
      const existing = sessionStorage.getItem(this.contextKey);
      if (existing) {
        const parsed = JSON.parse(existing) as unknown;
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, unknown>;
        }
      }

      const url = typeof location !== 'undefined' ? new URL(location.href) : null;
      const qp = url ? url.searchParams : null;

      const ctx: Record<string, unknown> = {
        landingPath: url ? sanitizePathForAnalytics(url.pathname + url.search) : undefined,
        referrer:
          typeof document !== 'undefined'
            ? sanitizeReferrerForAnalytics(document.referrer)
            : undefined,
        utm_source: qp?.get('utm_source')
          ? sanitizeStringValue(qp.get('utm_source') ?? '')
          : undefined,
        utm_medium: qp?.get('utm_medium')
          ? sanitizeStringValue(qp.get('utm_medium') ?? '')
          : undefined,
        utm_campaign: qp?.get('utm_campaign')
          ? sanitizeStringValue(qp.get('utm_campaign') ?? '')
          : undefined,
        utm_term: qp?.get('utm_term')
          ? sanitizeStringValue(qp.get('utm_term') ?? '')
          : undefined,
        utm_content: qp?.get('utm_content')
          ? sanitizeStringValue(qp.get('utm_content') ?? '')
          : undefined,
      };

      sessionStorage.setItem(this.contextKey, JSON.stringify(ctx));
      return ctx;
    } catch {
      return {};
    }
  }

  private newId(): string {
    const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
    if (g.crypto?.randomUUID) {
      return g.crypto.randomUUID();
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }
}
