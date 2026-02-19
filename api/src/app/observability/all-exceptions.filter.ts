import {
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCacheService } from './error-cache.service';
import { ErrorLogService } from './error-log.service';

type ApiErrorPayload = {
  statusCode: number;
  message: string | string[];
  error?: string;
  requestId?: string;
  path?: string;
  timestamp?: string;
};

function sanitizePathForLogs(input: string | undefined): string {
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

function sanitizeMessageForCache(message: string): string {
  const collapsed = message.replace(/\s+/g, ' ').trim();

  return collapsed
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<redacted-email>')
    .replace(
      /\beyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\b/g,
      '<redacted-jwt>',
    )
    .replace(/\b[a-f0-9]{32,}\b/gi, '<redacted-token>')
    .replace(/"/g, "'")
    .slice(0, 300);
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly errors: ErrorCacheService,
    private readonly errorLogs: ErrorLogService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { requestId?: string; user?: { sub?: string } }>();
    const res = ctx.getResponse<Response>();

    const requestId = req.requestId;
    const safePath = sanitizePathForLogs(req.originalUrl || req.url);

    const timestamp = new Date().toISOString();
    const method = req.method ?? 'UNKNOWN';

    const { statusCode, message, error } = this.getStatusAndMessage(exception);

    const payload: ApiErrorPayload = {
      statusCode,
      message,
      error,
      requestId,
      path: safePath,
      timestamp,
    };

    if (statusCode >= 500) {
      const name =
        typeof exception === 'object' && exception && 'name' in exception
          ? String((exception as { name?: unknown }).name ?? '')
          : undefined;
      const msgForCache = Array.isArray(message) ? message.join(' | ') : message;
      const safeMessage = sanitizeMessageForCache(msgForCache);

      this.errors.add({
        requestId: requestId ?? 'missing',
        timestamp,
        method,
        path: safePath,
        statusCode,
        message: safeMessage,
        name,
        userId: req.user?.sub,
      });
      void this.errorLogs
        .add({
          requestId: requestId ?? 'missing',
          timestamp,
          method,
          path: safePath,
          statusCode,
          message: safeMessage,
          name,
          userId: req.user?.sub,
        })
        .catch(() => undefined);

      this.logger.error(
        `${method} ${safePath} -> ${statusCode} requestId=${requestId ?? 'missing'} message="${safeMessage}"`,
      );
    }

    res.status(statusCode).json(payload);
  }

  private getStatusAndMessage(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error?: string;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      const raw =
        typeof response === 'object' && response
          ? (response as { message?: unknown; error?: unknown })
          : undefined;

      const message =
        Array.isArray(raw?.message) && raw?.message.every((m) => typeof m === 'string')
          ? (raw?.message as string[])
          : typeof raw?.message === 'string'
            ? raw.message
            : exception.message || 'Request failed';

      const error = typeof raw?.error === 'string' ? raw.error : undefined;
      return { statusCode, message, error };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }
}
