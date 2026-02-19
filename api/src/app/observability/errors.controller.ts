import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ErrorCacheService } from './error-cache.service';
import { ErrorLogService } from './error-log.service';

@ApiTags('Observability')
@ApiBearerAuth()
@Controller('errors')
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN, Role.STAFF)
export class ErrorsController {
  constructor(
    private readonly errorLogs: ErrorLogService,
    private readonly errors: ErrorCacheService,
  ) {}

  @Get('recent')
  async recent(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    const take = Number.isFinite(parsed) ? parsed : 50;

    try {
      return { items: await this.errorLogs.list(take) };
    } catch {
      // Best-effort fallback if DB is temporarily unavailable.
      return { items: this.errors.list(take) };
    }
  }
}
