import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';

const SENSITIVE_KEY_RE = /(token|password|secret|authorization|cookie|session|refresh)/i;
const JWT_RE = /\beyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\b/;
const HEX_TOKEN_RE = /\b[a-f0-9]{32,}\b/i;

function sanitizeAnalyticsPath(input: string | undefined): string | undefined {
  if (typeof input !== 'string') {
    return undefined;
  }

  const raw = input.trim();
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = new URL(raw, 'http://localhost');
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

function sanitizeString(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }
  if (JWT_RE.test(trimmed) || HEX_TOKEN_RE.test(trimmed)) {
    return '<redacted>';
  }
  return trimmed.slice(0, 300);
}

function sanitizeJson(value: unknown, depth = 0): Prisma.InputJsonValue | undefined {
  if (depth > 4) {
    return undefined;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value as Prisma.InputJsonValue;
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, 40)
      .map((item) => sanitizeJson(item, depth + 1))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined);
    return items;
  }

  if (value && typeof value === 'object') {
    const out: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = '<redacted>';
        continue;
      }
      const sanitized = sanitizeJson(item, depth + 1);
      if (sanitized !== undefined) {
        out[key] = sanitized;
      }
    }
    return out as Prisma.InputJsonObject;
  }

  return undefined;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  createEvent(dto: CreateAnalyticsEventDto, userId?: string) {
    const safeProperties = dto.properties
      ? (sanitizeJson(dto.properties) as Prisma.InputJsonValue | undefined)
      : undefined;

    return this.prisma.analyticsEvent.create({
      data: {
        name: dto.name.trim(),
        path: sanitizeAnalyticsPath(dto.path),
        anonymousId: dto.anonymousId?.trim() || undefined,
        sessionId: dto.sessionId?.trim() || undefined,
        userId,
        properties: safeProperties,
      },
    });
  }

  createEventsBatch(dtos: CreateAnalyticsEventDto[], userId?: string) {
    if (dtos.length === 0) {
      return { count: 0 };
    }

    // createMany is faster and good enough for analytics; we don't need return rows.
    return this.prisma.analyticsEvent.createMany({
      data: dtos.map((dto) => ({
        name: dto.name.trim(),
        path: sanitizeAnalyticsPath(dto.path),
        anonymousId: dto.anonymousId?.trim() || undefined,
        sessionId: dto.sessionId?.trim() || undefined,
        userId,
        properties: dto.properties
          ? (sanitizeJson(dto.properties) as Prisma.InputJsonValue | undefined)
          : undefined,
      })),
    });
  }

  async adminSummary(days: number) {
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    const where = { createdAt: { gte: from, lte: to } } as const;

    const [totalEvents, byName, visitorGroups, sessionGroups, funnel, devices, timeseries, addToCartByProduct, productViewByProduct] =
      await Promise.all([
        this.prisma.analyticsEvent.count({ where }),
        this.prisma.analyticsEvent.groupBy({
          by: ['name'],
          where,
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 20,
        }),
        this.prisma.analyticsEvent.groupBy({
          by: ['anonymousId'],
          where: { ...where, anonymousId: { not: null } },
          _count: { id: true },
        }),
        this.prisma.analyticsEvent.groupBy({
          by: ['sessionId'],
          where: { ...where, sessionId: { not: null } },
          _count: { id: true },
        }),
        this.prisma.analyticsEvent.groupBy({
          by: ['name'],
          where: {
            ...where,
            name: { in: ['add_to_cart', 'begin_checkout', 'purchase_success'] },
          },
          _count: { id: true },
        }),
        this.prisma.$queryRaw<
          Array<{ deviceClass: string; count: number }>
        >(Prisma.sql`
          SELECT
            COALESCE("properties"->>'deviceClass', 'unknown') as "deviceClass",
            COUNT(*)::int as "count"
          FROM "public"."AnalyticsEvent"
          WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
            AND "name" = 'page_view'
          GROUP BY 1
          ORDER BY 2 DESC;
        `),
        this.prisma.$queryRaw<
          Array<{
            day: string;
            pageViews: number;
            addToCart: number;
            beginCheckout: number;
            purchaseSuccess: number;
          }>
        >(Prisma.sql`
          SELECT
            to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') as "day",
            SUM(CASE WHEN "name" = 'page_view' THEN 1 ELSE 0 END)::int as "pageViews",
            SUM(CASE WHEN "name" = 'add_to_cart' THEN 1 ELSE 0 END)::int as "addToCart",
            SUM(CASE WHEN "name" = 'begin_checkout' THEN 1 ELSE 0 END)::int as "beginCheckout",
            SUM(CASE WHEN "name" = 'purchase_success' THEN 1 ELSE 0 END)::int as "purchaseSuccess"
          FROM "public"."AnalyticsEvent"
          WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
          GROUP BY 1
          ORDER BY 1;
        `),
        this.prisma.$queryRaw<Array<{ productId: string; count: number }>>(
          Prisma.sql`
            SELECT
              ("properties"->>'productId') as "productId",
              COUNT(*)::int as "count"
            FROM "public"."AnalyticsEvent"
            WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
              AND "name" = 'add_to_cart'
              AND "properties" ? 'productId'
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 10;
          `,
        ),
        this.prisma.$queryRaw<Array<{ productId: string; count: number }>>(
          Prisma.sql`
            SELECT
              ("properties"->>'productId') as "productId",
              COUNT(*)::int as "count"
            FROM "public"."AnalyticsEvent"
            WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
              AND "name" = 'product_view'
              AND "properties" ? 'productId'
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 10;
          `,
        ),
      ]);

    const funnelByName = new Map(funnel.map((e) => [e.name, e._count.id]));
    const addToCartCount = funnelByName.get('add_to_cart') ?? 0;
    const beginCheckoutCount = funnelByName.get('begin_checkout') ?? 0;
    const purchaseSuccessCount = funnelByName.get('purchase_success') ?? 0;

    const productIds = Array.from(
      new Set([
        ...addToCartByProduct.map((x) => x.productId).filter(Boolean),
        ...productViewByProduct.map((x) => x.productId).filter(Boolean),
      ]),
    );

    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, title: true, type: true },
        })
      : [];

    const productById = new Map(products.map((p) => [p.id, p]));

    const topProductsAddToCart = addToCartByProduct.map((row) => ({
      productId: row.productId,
      count: row.count,
      title: productById.get(row.productId)?.title ?? '(Producto eliminado)',
      type: productById.get(row.productId)?.type ?? null,
    }));

    const topProductsViews = productViewByProduct.map((row) => ({
      productId: row.productId,
      count: row.count,
      title: productById.get(row.productId)?.title ?? '(Producto eliminado)',
      type: productById.get(row.productId)?.type ?? null,
    }));

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      days,
      totalEvents,
      uniqueVisitors: visitorGroups.length,
      uniqueSessions: sessionGroups.length,
      byName: byName.map((row) => ({ name: row.name, count: row._count.id })),
      funnel: {
        addToCart: addToCartCount,
        beginCheckout: beginCheckoutCount,
        purchaseSuccess: purchaseSuccessCount,
        rates: {
          beginCheckoutPerAddToCart:
            addToCartCount > 0 ? beginCheckoutCount / addToCartCount : 0,
          purchasePerBeginCheckout:
            beginCheckoutCount > 0 ? purchaseSuccessCount / beginCheckoutCount : 0,
        },
      },
      devices,
      timeseries,
      topProducts: {
        addToCart: topProductsAddToCart,
        productView: topProductsViews,
      },
    };
  }
}
