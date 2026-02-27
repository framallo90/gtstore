import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSiteContentDto } from './dto/update-site-content.dto';
import {
  DEFAULT_SITE_CONTENT,
  isSiteContentKey,
  SITE_CONTENT_KEYS,
  type SiteContentMap,
} from './site-content.types';

@Injectable()
export class SiteContentService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicContent(): Promise<SiteContentMap> {
    return this.loadMergedContent();
  }

  async getAdminContent(): Promise<SiteContentMap> {
    return this.loadMergedContent();
  }

  async updateContent(dto: UpdateSiteContentDto): Promise<SiteContentMap> {
    const updates = this.extractUpdates(dto);
    if (updates.length === 0) {
      return this.loadMergedContent();
    }

    await this.prisma.$transaction(
      updates.map((item) =>
        this.prisma.siteContent.upsert({
          where: { key: item.key },
          create: { key: item.key, value: item.value },
          update: { value: item.value },
        }),
      ),
    );

    return this.loadMergedContent();
  }

  private async loadMergedContent(): Promise<SiteContentMap> {
    const rows = await this.prisma.siteContent.findMany({
      where: {
        key: {
          in: [...SITE_CONTENT_KEYS],
        },
      },
    });

    const fromDb: Partial<SiteContentMap> = {};
    for (const row of rows) {
      if (!isSiteContentKey(row.key)) {
        continue;
      }
      const value = this.normalizeValue(row.value);
      if (!value) {
        continue;
      }
      fromDb[row.key] = value;
    }

    const merged: SiteContentMap = { ...DEFAULT_SITE_CONTENT };
    for (const key of SITE_CONTENT_KEYS) {
      const value = fromDb[key];
      if (typeof value === 'string' && value.length > 0) {
        merged[key] = value;
      }
    }

    return merged;
  }

  private extractUpdates(dto: UpdateSiteContentDto) {
    const updates: Array<{ key: (typeof SITE_CONTENT_KEYS)[number]; value: string }> = [];

    for (const key of SITE_CONTENT_KEYS) {
      const raw = dto[key];
      if (raw === undefined) {
        continue;
      }

      const normalized = this.normalizeValue(raw);
      if (!normalized) {
        updates.push({ key, value: DEFAULT_SITE_CONTENT[key] });
        continue;
      }

      updates.push({ key, value: normalized });
    }

    return updates;
  }

  private normalizeValue(raw: string): string {
    if (typeof raw !== 'string') {
      return '';
    }

    // Preserve line breaks for longer editorial copy, but normalize surrounding spaces.
    return raw.trim();
  }
}
