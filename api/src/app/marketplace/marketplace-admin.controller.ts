import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { ResolveMarketplaceAppealDto } from './dto/resolve-marketplace-appeal.dto';
import { ReviewMarketplaceListingDto } from './dto/review-marketplace-listing.dto';
import { ReviewSellerApplicationDto } from './dto/review-seller-application.dto';
import { MarketplaceAdminService } from './marketplace-admin.service';

@ApiTags('Marketplace Admin')
@ApiBearerAuth()
@Controller('marketplace/admin')
@UseGuards(JwtAuthGuard)
export class MarketplaceAdminController {
  constructor(
    private readonly marketplaceAdminService: MarketplaceAdminService,
    private readonly audit: AuditService,
  ) {}

  @Get('seller-applications')
  @Roles(Role.ADMIN, Role.STAFF)
  listSellerApplications(@Query('status') status?: string) {
    return this.marketplaceAdminService.listSellerApplications(status);
  }

  @Patch('seller-applications/:id')
  @Roles(Role.ADMIN, Role.STAFF)
  async reviewSellerApplication(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Param('id') id: string,
    @Body() dto: ReviewSellerApplicationDto,
  ) {
    const updated = await this.marketplaceAdminService.reviewSellerApplication(
      id,
      dto,
    );
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'MARKETPLACE_SELLER_APPLICATION_REVIEW',
        entityType: 'SellerVerificationRequest',
        entityId: id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
        meta: { decision: dto.decision, reason: dto.reason },
      })
      .catch(() => undefined);
    return updated;
  }

  @Get('listings')
  @Roles(Role.ADMIN, Role.STAFF)
  listListings(@Query('status') status?: string) {
    return this.marketplaceAdminService.listListings(status);
  }

  @Patch('listings/:id/review')
  @Roles(Role.ADMIN, Role.STAFF)
  async reviewListing(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Param('id') id: string,
    @Body() dto: ReviewMarketplaceListingDto,
  ) {
    const updated = await this.marketplaceAdminService.reviewListing(
      actor.sub,
      id,
      dto,
    );
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'MARKETPLACE_LISTING_REVIEW',
        entityType: 'MarketplaceListing',
        entityId: id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
        meta: { decision: dto.decision, reason: dto.reason },
      })
      .catch(() => undefined);
    return updated;
  }

  @Get('appeals')
  @Roles(Role.ADMIN, Role.STAFF)
  listAppeals(@Query('status') status?: string) {
    return this.marketplaceAdminService.listAppeals(status);
  }

  @Patch('appeals/:id')
  @Roles(Role.ADMIN, Role.STAFF)
  async resolveAppeal(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Param('id') id: string,
    @Body() dto: ResolveMarketplaceAppealDto,
  ) {
    const updated = await this.marketplaceAdminService.resolveAppeal(id, dto);
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'MARKETPLACE_APPEAL_RESOLVE',
        entityType: 'MarketplaceAppeal',
        entityId: id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
        meta: { status: dto.status, reason: dto.reason },
      })
      .catch(() => undefined);
    return updated;
  }
}
