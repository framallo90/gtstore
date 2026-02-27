import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { UpdateSiteContentDto } from './dto/update-site-content.dto';
import { SITE_CONTENT_KEYS } from './site-content.types';
import { SiteContentService } from './site-content.service';

@ApiTags('Site Content')
@Controller('site-content')
export class SiteContentController {
  constructor(
    private readonly content: SiteContentService,
    private readonly audit: AuditService,
  ) {}

  @Get('public')
  getPublic() {
    return this.content.getPublicContent();
  }

  @Get('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  getAdmin() {
    return this.content.getAdminContent();
  }

  @Put('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  async updateAdminContent(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Body() dto: UpdateSiteContentDto,
  ) {
    const changedFields = SITE_CONTENT_KEYS.filter((key) => dto[key] !== undefined);
    const updated = await this.content.updateContent(dto);

    if (changedFields.length > 0) {
      this.audit
        .log({
          actorUserId: actor.sub,
          actorRole: actor.role,
          action: 'SITE_CONTENT_UPDATE',
          entityType: 'SiteContent',
          requestId: req.requestId,
          ip: req.ip,
          userAgent: String(req.headers['user-agent'] ?? ''),
          meta: { changedFields },
        })
        .catch(() => undefined);
    }

    return updated;
  }
}
