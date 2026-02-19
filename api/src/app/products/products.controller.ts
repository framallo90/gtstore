import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { CreateProductDto } from './dto/create-product.dto';
import { LookupProductsDto } from './dto/lookup-products.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query() query: QueryProductsDto) {
    return this.productsService.list(query);
  }

  // Public helper to load a small set of products (guest cart, etc.)
  @Post('lookup')
  lookup(@Body() dto: LookupProductsDto) {
    return this.productsService.lookup(dto.ids);
  }

  @Get('admin/all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  adminList() {
    return this.productsService.adminList();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.productsService.detail(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  async create(
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request & { requestId?: string },
    @Body() dto: CreateProductDto,
  ) {
    const created = await this.productsService.create(dto);
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'PRODUCT_CREATE',
        entityType: 'Product',
        entityId: created.id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
        meta: {
          sku: dto.sku,
          title: dto.title,
          type: dto.type,
          price: dto.price,
          stock: dto.stock,
          isFeatured: dto.isFeatured ?? false,
          isActive: dto.isActive ?? true,
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
    @Body() dto: UpdateProductDto,
  ) {
    const updated = await this.productsService.update(id, dto);
    const changedFields = Object.entries(dto ?? {})
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k)
      .slice(0, 50);
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'PRODUCT_UPDATE',
        entityType: 'Product',
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
    const removed = await this.productsService.remove(id);
    this.audit
      .log({
        actorUserId: actor.sub,
        actorRole: actor.role,
        action: 'PRODUCT_DEACTIVATE',
        entityType: 'Product',
        entityId: id,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
      })
      .catch(() => undefined);
    return removed;
  }
}
