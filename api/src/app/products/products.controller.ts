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
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { LookupProductsDto } from './dto/lookup-products.dto';
import { QueryProductReviewsDto } from './dto/query-product-reviews.dto';
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

  @Get('facets')
  listFacets(@Query() query: QueryProductsDto) {
    return this.productsService.listFacets(query);
  }

  // Public helper to load a small set of products (guest cart, etc.)
  @Post('lookup')
  lookup(@Body() dto: LookupProductsDto) {
    return this.productsService.lookup(dto.ids);
  }

  @Get('wishlist/me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  wishlist(@CurrentUser() actor: JwtPayload) {
    return this.productsService.listWishlist(actor.sub);
  }

  @Post('wishlist/:productId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  addWishlist(@CurrentUser() actor: JwtPayload, @Param('productId') productId: string) {
    return this.productsService.addWishlist(actor.sub, productId);
  }

  @Delete('wishlist/:productId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  removeWishlist(@CurrentUser() actor: JwtPayload, @Param('productId') productId: string) {
    return this.productsService.removeWishlist(actor.sub, productId);
  }

  @Get(':id/reviews')
  reviews(@Param('id') id: string, @Query() query: QueryProductReviewsDto) {
    return this.productsService.listReviews(id, query);
  }

  @Post(':id/reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  upsertReview(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateProductReviewDto,
  ) {
    return this.productsService.upsertReview(actor.sub, id, dto);
  }

  @Delete(':id/reviews/me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  removeMyReview(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.productsService.removeMyReview(actor.sub, id);
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
          subtitle: dto.subtitle ?? null,
          type: dto.type,
          publisher: dto.publisher ?? null,
          genre: dto.genre ?? null,
          seriesName: dto.seriesName ?? null,
          seriesNumber: dto.seriesNumber ?? null,
          language: dto.language ?? null,
          binding: dto.binding ?? null,
          publicationYear: dto.publicationYear ?? null,
          publicationDate: dto.publicationDate ?? null,
          pageCount: dto.pageCount ?? null,
          conditionLabel: dto.conditionLabel ?? null,
          isbn13: dto.isbn13 ?? null,
          ean: dto.ean ?? null,
          shippingEtaMinDays: dto.shippingEtaMinDays ?? null,
          shippingEtaMaxDays: dto.shippingEtaMaxDays ?? null,
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
