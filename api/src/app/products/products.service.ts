import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: QueryProductsDto) {
    const {
      search,
      type,
      featured,
      inStock,
      minPrice,
      maxPrice,
      sort = 'recommended',
      take = 20,
      skip = 0,
    } = query;

    const price: { gte?: Prisma.Decimal; lte?: Prisma.Decimal } = {};
    if (minPrice !== undefined && Number.isFinite(minPrice)) {
      price.gte = new Prisma.Decimal(minPrice);
    }
    if (maxPrice !== undefined && Number.isFinite(maxPrice)) {
      price.lte = new Prisma.Decimal(maxPrice);
    }

    const orderBy = (() => {
      if (sort === 'price_asc') {
        return [{ price: 'asc' as const }, { createdAt: 'desc' as const }];
      }
      if (sort === 'price_desc') {
        return [{ price: 'desc' as const }, { createdAt: 'desc' as const }];
      }
      if (sort === 'title_asc') {
        return [{ title: 'asc' as const }, { createdAt: 'desc' as const }];
      }
      if (sort === 'newest') {
        return [{ createdAt: 'desc' as const }];
      }
      // recommended
      return [
        { isFeatured: 'desc' as const },
        { stock: 'desc' as const },
        { createdAt: 'desc' as const },
      ];
    })();

    return this.prisma.product.findMany({
      where: {
        isActive: true,
        type,
        isFeatured: featured,
        stock: inStock ? { gt: 0 } : undefined,
        price: Object.keys(price).length > 0 ? price : undefined,
        OR: search
          ? [
              { title: { contains: search, mode: 'insensitive' } },
              { author: { contains: search, mode: 'insensitive' } },
              { publisher: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy,
      take,
      skip,
    });
  }

  lookup(ids: string[]) {
    const unique = Array.from(new Set(ids ?? []))
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .slice(0, 200);

    if (unique.length === 0) {
      return [];
    }

    return this.prisma.product.findMany({
      where: { id: { in: unique }, isActive: true },
    });
  }

  async detail(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        ...dto,
        price: dto.price,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  adminList() {
    return this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
