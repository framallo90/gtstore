import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuditLogInput = {
  actorUserId?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  meta?: unknown;
};

function normalizeString(input: unknown, maxLen: number): string | undefined {
  if (typeof input !== 'string') {
    return undefined;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function safeJson(input: unknown) {
  if (input === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(input)) as unknown;
  } catch {
    return undefined;
  }
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: normalizeString(input.actorUserId, 80),
        actorRole: normalizeString(input.actorRole, 40),
        action: normalizeString(input.action, 80) ?? 'UNKNOWN',
        entityType: normalizeString(input.entityType, 80) ?? 'Unknown',
        entityId: normalizeString(input.entityId, 80),
        requestId: normalizeString(input.requestId, 120),
        ip: normalizeString(input.ip, 80),
        userAgent: normalizeString(input.userAgent, 200),
        meta: safeJson(input.meta) as any,
      },
    });
  }

  list(limit = 50) {
    const take = Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 50;
    return this.prisma.auditLog.findMany({
      take,
      orderBy: { createdAt: 'desc' },
    });
  }
}

