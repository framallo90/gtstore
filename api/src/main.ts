import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { AppModule } from './app/app.module';

type RequestWithId = { requestId?: string };

function isProductionEnv() {
  return (process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
}

function assertRuntimeSecurityConfig() {
  const accessSecret = (process.env.JWT_ACCESS_SECRET ?? '').trim();
  const refreshSecret = (process.env.JWT_REFRESH_SECRET ?? '').trim();

  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required');
  }

  if (!isProductionEnv()) {
    return;
  }

  const mpEnv = (process.env.MP_ENV ?? 'sandbox').trim().toLowerCase();
  const webhookSecret = (process.env.MP_WEBHOOK_SECRET ?? '').trim();
  if (mpEnv === 'production' && !webhookSecret) {
    throw new Error('MP_WEBHOOK_SECRET is required when MP_ENV=production');
  }

  const corsRaw = (process.env.CORS_ORIGINS ?? '').trim();
  if (!corsRaw) {
    throw new Error('CORS_ORIGINS is required in production');
  }

  const weakAdminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase() === 'admin';
  const weakAdminPassword = (process.env.ADMIN_PASSWORD ?? '').trim() === 'admin';
  if (weakAdminEmail && weakAdminPassword) {
    throw new Error(
      'Weak admin credentials are not allowed in production. Set strong ADMIN_EMAIL/ADMIN_PASSWORD.',
    );
  }
}

function getClientIp(req: { ip?: string; socket?: { remoteAddress?: string | null } }) {
  if (typeof req.ip === 'string' && req.ip) {
    return req.ip;
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

function parseTrustProxySetting(raw: string): boolean | number {
  const v = raw.trim();
  if (!v) {
    return 0;
  }
  const lower = v.toLowerCase();
  if (lower === 'true') {
    // Avoid trust-all mode from ambiguous boolean config.
    return 1;
  }
  if (lower === 'false') {
    return 0;
  }
  const n = Number(v);
  if (Number.isFinite(n) && n >= 0) {
    return n;
  }
  return 0;
}

function normalizeRequestId(input: unknown): string | undefined {
  const raw = Array.isArray(input) ? input[0] : input;
  if (typeof raw !== 'string') {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  // Avoid log/header injection and unbounded memory usage via attacker-controlled headers.
  const safe = trimmed
    .replace(/[^a-zA-Z0-9._:-]/g, '')
    .slice(0, 120);
  if (!safe) {
    return undefined;
  }

  return safe;
}

function sanitizePath(input: string | undefined): string {
  if (typeof input !== 'string' || !input.trim()) {
    return '/';
  }

  const raw = input.trim();
  try {
    const parsed = new URL(raw, 'http://localhost');
    return parsed.pathname.slice(0, 260) || '/';
  } catch {
    const noHash = raw.split('#', 1)[0] ?? '';
    const noQuery = noHash.split('?', 1)[0] ?? '';
    if (!noQuery.startsWith('/')) {
      return '/';
    }
    return noQuery.slice(0, 260) || '/';
  }
}

async function bootstrap() {
  assertRuntimeSecurityConfig();

  // Disable Nest default body parser so we can apply explicit limits.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.disable('x-powered-by');
  // Secure default: do not trust X-Forwarded-* unless explicitly configured.
  // Set TRUST_PROXY=1 (or a strict hop count) only when running behind a trusted reverse proxy.
  const trustProxyRaw = process.env.TRUST_PROXY;
  expressApp.set(
    'trust proxy',
    trustProxyRaw === undefined ? 0 : parseTrustProxySetting(trustProxyRaw),
  );

  // Request id for correlation across logs and client error reports.
  app.use((req: Request & RequestWithId, res: Response, next: NextFunction) => {
    const requestId = normalizeRequestId(req.headers?.['x-request-id']) || randomUUID();
    req.requestId = requestId;
    try {
      res.setHeader('X-Request-Id', requestId);
    } catch {
      // ignore
    }
    next();
  });

  // Basic security headers (edge may add more).
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  // Rate limit auth endpoints (best-effort, in-memory).
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const windowMs = 60_000;
  const authMaxPerWindow = 15;
  const analyticsMaxPerWindow = 120;
  const purgeIntervalMs = 5 * 60_000;
  let lastPurge = Date.now();

  app.use((req: Request & RequestWithId, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (now - lastPurge > purgeIntervalMs) {
      lastPurge = now;
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) {
          buckets.delete(k);
        }
      }
    }

    const path = sanitizePath(String(req.originalUrl ?? req.url ?? ''));
    const method = String(req.method ?? 'GET').toUpperCase();
    const isAuth =
      method === 'POST' &&
      (path.startsWith('/api/auth/login') ||
        path.startsWith('/api/auth/register') ||
        path.startsWith('/api/auth/admin/login') ||
        path.startsWith('/api/auth/refresh') ||
        path.startsWith('/api/auth/logout') ||
        path.startsWith('/api/auth/verify-email') ||
        path.startsWith('/api/auth/password/forgot') ||
        path.startsWith('/api/auth/password/reset'));
    const isAnalytics =
      method === 'POST' &&
      (path.startsWith('/api/analytics/events') ||
        path.startsWith('/api/analytics/events/batch'));

    if (!isAuth && !isAnalytics) {
      next();
      return;
    }

    const ip = getClientIp(req);
    const key = `${ip}:${method}:${path}`;
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;
    const maxAllowed = isAuth ? authMaxPerWindow : analyticsMaxPerWindow;
    if (current.count > maxAllowed) {
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests, please try again later.',
        error: 'Too Many Requests',
        requestId: req.requestId,
        path,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  });

  // Body parsers with explicit limits to reduce DoS risk.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb', parameterLimit: 1000 }));

  app.use(cookieParser());
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:4200,http://localhost:4300')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const swaggerFlag = (process.env.SWAGGER_ENABLED ?? '').trim();
  const isProd = process.env.NODE_ENV === 'production';
  const swaggerEnabled =
    swaggerFlag === '1' ||
    swaggerFlag.toLowerCase() === 'true' ||
    (!swaggerFlag && !isProd);

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('GeekyTreasures API')
      .setDescription('E-commerce API for books and comics')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
