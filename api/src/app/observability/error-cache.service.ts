import { Injectable } from '@nestjs/common';

export type CachedError = {
  id: string;
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  message: string;
  name?: string;
  userId?: string;
};

@Injectable()
export class ErrorCacheService {
  private readonly maxEntries = 200;
  private readonly maxAgeMs = 6 * 60 * 60 * 1000; // 6h

  private items: CachedError[] = [];

  add(entry: Omit<CachedError, 'id'>) {
    const now = Date.now();
    this.items = this.items.filter((e) => now - Date.parse(e.timestamp) <= this.maxAgeMs);

    const id = `${entry.timestamp}:${entry.requestId}`;
    this.items.unshift({ id, ...entry });
    if (this.items.length > this.maxEntries) {
      this.items.length = this.maxEntries;
    }
  }

  list(limit = 50) {
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
    return this.items.slice(0, safeLimit);
  }

  clear() {
    this.items = [];
  }
}

