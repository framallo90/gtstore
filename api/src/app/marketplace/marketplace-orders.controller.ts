import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
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
import { CreateMarketplaceOrderDto } from './dto/create-marketplace-order.dto';
import { CreateMarketplaceOrderQuoteDto } from './dto/create-marketplace-order-quote.dto';
import { UpdateMarketplaceOrderStatusDto } from './dto/update-marketplace-order-status.dto';
import { MarketplaceOrdersService } from './marketplace-orders.service';

@ApiTags('Marketplace Orders')
@ApiBearerAuth()
@Controller('marketplace/orders')
@UseGuards(JwtAuthGuard)
export class MarketplaceOrdersController {
  constructor(
    private readonly marketplaceOrdersService: MarketplaceOrdersService,
    private readonly audit: AuditService,
  ) {}

  @Post('quote')
  quote(@CurrentUser() user: JwtPayload, @Body() dto: CreateMarketplaceOrderQuoteDto) {
    return this.marketplaceOrdersService.quote(user.sub, dto);
  }

  @Post('checkout')
  checkout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMarketplaceOrderDto,
    @Headers('idempotency-key') _idempotencyKey?: string,
  ) {
    return this.marketplaceOrdersService.checkout(user.sub, dto);
  }

  @Get('me')
  myOrders(@CurrentUser() user: JwtPayload) {
    return this.marketplaceOrdersService.myOrders(user.sub);
  }

  @Get('admin/all')
  @Roles(Role.ADMIN, Role.STAFF)
  allOrders() {
    return this.marketplaceOrdersService.adminAllOrders();
  }

  @Patch('admin/:id/status')
  @Roles(Role.ADMIN, Role.STAFF)
  async updateStatus(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Param('id') id: string,
    @Body() dto: UpdateMarketplaceOrderStatusDto,
  ) {
    const updated = await this.marketplaceOrdersService.updateStatus(id, dto);
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'MARKETPLACE_ORDER_STATUS_UPDATE',
        entityType: 'MarketplaceOrder',
        entityId: id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
        meta: { status: dto.status },
      })
      .catch(() => undefined);
    return updated;
  }

  @Patch('admin/:id/payout/release')
  @Roles(Role.ADMIN, Role.STAFF)
  async releasePayout(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Param('id') id: string,
  ) {
    const updated = await this.marketplaceOrdersService.releasePayout(id);
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'MARKETPLACE_PAYOUT_RELEASE',
        entityType: 'MarketplaceOrder',
        entityId: id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
      })
      .catch(() => undefined);
    return updated;
  }
}
