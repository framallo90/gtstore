import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { AuditService } from '../audit/audit.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { CouponsService } from './coupons.service';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(
    private readonly couponsService: CouponsService,
    private readonly audit: AuditService,
  ) {}

  @Post('validate')
  validate(@Body() dto: ValidateCouponDto) {
    return this.couponsService.validateCode(dto.code);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  list() {
    return this.couponsService.list();
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  async create(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Body() dto: CreateCouponDto,
  ) {
    const created = await this.couponsService.create(dto);
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'COUPON_CREATE',
        entityType: 'Coupon',
        entityId: created.id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
        meta: {
          code: dto.code,
          type: dto.type,
          discount: dto.discount,
          isActive: dto.isActive ?? true,
          startsAt: dto.startsAt,
          expiresAt: dto.expiresAt,
          usageLimit: dto.usageLimit,
        },
      })
      .catch(() => undefined);
    return created;
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  async update(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    const updated = await this.couponsService.update(id, dto);
    const changedFields = Object.entries(dto ?? {})
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k)
      .slice(0, 50);
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'COUPON_UPDATE',
        entityType: 'Coupon',
        entityId: id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
        meta: { changedFields },
      })
      .catch(() => undefined);
    return updated;
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  async remove(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Param('id') id: string,
  ) {
    const res = await this.couponsService.remove(id);
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'COUPON_DELETE',
        entityType: 'Coupon',
        entityId: id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
      })
      .catch(() => undefined);
    return res;
  }
}
