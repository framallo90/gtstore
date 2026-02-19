import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN, Role.STAFF)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('recent')
  recent(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    const take = Number.isFinite(parsed) ? parsed : 50;
    return this.audit.list(take).then((items) => ({ items }));
  }
}

