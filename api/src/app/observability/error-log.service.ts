import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CachedError } from './error-cache.service';

@Injectable()
export class ErrorLogService {
  private static lastCleanupAt = 0;
  private readonly maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7d

  constructor(private readonly prisma: PrismaService) {}

  async add(entry: Omit<CachedError, 'id'>) {
    const occurredAt = Number.isFinite(Date.parse(entry.timestamp))
      ? new Date(entry.timestamp)
      : new Date();

    await this.prisma.apiErrorLog.create({
      data: {
        requestId: entry.requestId,
        occurredAt,
        method: entry.method,
        path: entry.path,
        statusCode: entry.statusCode,
        message: entry.message,
        name: entry.name,
        userId: entry.userId,
      },
    });

    this.scheduleCleanup();
  }

  async list(limit = 50): Promise<CachedError[]> {
    const take = Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 50;
    const rows = await this.prisma.apiErrorLog.findMany({
      take,
      orderBy: { occurredAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      requestId: r.requestId,
      timestamp: r.occurredAt.toISOString(),
      method: r.method,
      path: r.path,
      statusCode: r.statusCode,
      message: r.message,
      name: r.name ?? undefined,
      userId: r.userId ?? undefined,
    }));
  }

  private scheduleCleanup() {
    const now = Date.now();
    const throttleMs = 60 * 60 * 1000;
    if (now - ErrorLogService.lastCleanupAt < throttleMs) {
      return;
    }
    ErrorLogService.lastCleanupAt = now;

    const cutoff = new Date(now - this.maxAgeMs);
    void this.prisma.apiErrorLog
      .deleteMany({ where: { occurredAt: { lt: cutoff } } })
      .catch(() => undefined);
  }
}

