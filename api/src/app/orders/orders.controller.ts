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
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly audit: AuditService,
  ) {}

  @Post('quote')
  quote(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.quoteFromCart(user.sub, dto);
  }

  @Post('checkout')
  checkout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.createFromCart(user.sub, dto, { idempotencyKey });
  }

  @Get('me')
  myOrders(@CurrentUser() user: JwtPayload) {
    return this.ordersService.myOrders(user.sub);
  }

  @Get('admin/all')
  @Roles(Role.ADMIN, Role.STAFF)
  allOrders() {
    return this.ordersService.allOrders();
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.STAFF)
  async updateStatus(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const updated = await this.ordersService.updateStatus(id, dto);
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'ORDER_STATUS_UPDATE',
        entityType: 'Order',
        entityId: id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
        meta: { status: dto.status },
      })
      .catch(() => undefined);
    return updated;
  }

  @Get('admin/dashboard-summary')
  @Roles(Role.ADMIN, Role.STAFF)
  dashboardSummary() {
    return this.ordersService.dashboardSummary();
  }
}
