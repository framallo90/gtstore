import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { AnalyticsService } from './analytics.service';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';
import { CreateAnalyticsEventBatchDto } from './dto/create-analytics-event-batch.dto';
import { QueryAnalyticsSummaryDto } from './dto/query-analytics-summary.dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Post('events')
  async createEvent(@Req() req: Request, @Body() dto: CreateAnalyticsEventDto) {
    const userId = this.tryGetUserIdFromAuthHeader(req);

    // Fire-and-forget style: we still await DB write, but we never want analytics to
    // block UX with strict errors.
    try {
      await this.analytics.createEvent(dto, userId);
    } catch {
      // Intentionally swallow analytics errors.
    }

    return { success: true };
  }

  @Post('events/batch')
  async createEventsBatch(
    @Req() req: Request,
    @Body() dto: CreateAnalyticsEventBatchDto,
  ) {
    const userId = this.tryGetUserIdFromAuthHeader(req);
    try {
      await this.analytics.createEventsBatch(dto.events ?? [], userId);
    } catch {
      // Intentionally swallow analytics errors.
    }
    return { success: true };
  }

  @Get('admin/summary')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  adminSummary(@Query() query: QueryAnalyticsSummaryDto) {
    return this.analytics.adminSummary(query.days ?? 7);
  }

  private tryGetUserIdFromAuthHeader(req: Request): string | undefined {
    const header = req.headers['authorization'];
    if (!header || typeof header !== 'string') {
      return undefined;
    }

    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return undefined;
    }

    const secret = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      return undefined;
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(match[1], { secret });
      return payload?.sub;
    } catch {
      return undefined;
    }
  }
}
