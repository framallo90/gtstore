import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductReviewDto } from './dto/create-product-review.dto';
import { QueryProductReviewsDto } from './dto/query-product-reviews.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: QueryProductsDto) {
    const { sort = 'recommended', take = 20, skip = 0 } = query;

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
      where: this.buildListWhere(query),
      orderBy,
      take,
      skip,
    });
  }

  async listFacets(query: QueryProductsDto) {
    const [total, typeRows, languageRows, bindingRows, conditionRows, genreRows, publisherRows] =
      await Promise.all([
        this.prisma.product.count({ where: this.buildListWhere(query) }),
        this.prisma.product.groupBy({
          by: ['type'],
          where: this.buildListWhere(query, { exclude: ['type'] }),
          _count: { _all: true },
        }),
        this.prisma.product.groupBy({
          by: ['language'],
          where: this.buildListWhere(query, { exclude: ['language'] }),
          _count: { _all: true },
        }),
        this.prisma.product.groupBy({
          by: ['binding'],
          where: this.buildListWhere(query, { exclude: ['binding'] }),
          _count: { _all: true },
        }),
        this.prisma.product.groupBy({
          by: ['conditionLabel'],
          where: this.buildListWhere(query, { exclude: ['conditionLabel'] }),
          _count: { _all: true },
        }),
        this.prisma.product.groupBy({
          by: ['genre'],
          where: this.buildListWhere(query, { exclude: ['genre'] }),
          _count: { _all: true },
        }),
        this.prisma.product.groupBy({
          by: ['publisher'],
          where: this.buildListWhere(query, { exclude: ['publisher'] }),
          _count: { _all: true },
        }),
      ]);

    const type = typeRows
      .map((row) => ({ value: row.type, count: row._count._all }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

    return {
      total,
      facets: {
        type,
        language: this.mapStringFacetRows(languageRows, 'language'),
        binding: this.mapStringFacetRows(bindingRows, 'binding'),
        conditionLabel: this.mapStringFacetRows(conditionRows, 'conditionLabel'),
        genre: this.mapStringFacetRows(genreRows, 'genre'),
        publisher: this.mapStringFacetRows(publisherRows, 'publisher'),
      },
    };
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
    const normalized = this.normalizeProductInput(dto);
    return this.prisma.product.create({
      data: {
        ...normalized,
        price: normalized.price,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const normalized = this.normalizeProductInput(dto);

    return this.prisma.product.update({
      where: { id },
      data: normalized,
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

  async listWishlist(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: {
        userId,
        product: { isActive: true },
      },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addWishlist(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
      include: { product: true },
    });
  }

  async removeWishlist(userId: string, productId: string) {
    const result = await this.prisma.wishlistItem.deleteMany({
      where: { userId, productId },
    });
    return { removed: result.count > 0 };
  }

  async listReviews(productId: string, query: QueryProductReviewsDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    const take = Math.max(1, Math.min(100, Math.trunc(query.take ?? 20)));
    const skip = Math.max(0, Math.trunc(query.skip ?? 0));

    const [items, aggregate] = await Promise.all([
      this.prisma.productReview.findMany({
        where: { productId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.productReview.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    return {
      items,
      summary: {
        count: aggregate._count._all,
        avgRating: aggregate._avg.rating ?? null,
      },
    };
  }

  async upsertReview(userId: string, productId: string, dto: CreateProductReviewDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.productReview.upsert({
      where: { userId_productId: { userId, productId } },
      update: {
        rating: dto.rating,
        title: dto.title ?? null,
        comment: dto.comment ?? null,
      },
      create: {
        userId,
        productId,
        rating: dto.rating,
        title: dto.title ?? null,
        comment: dto.comment ?? null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async removeMyReview(userId: string, productId: string) {
    const result = await this.prisma.productReview.deleteMany({
      where: { userId, productId },
    });
    return { removed: result.count > 0 };
  }

  private buildListWhere(
    query: QueryProductsDto,
    opts?: {
      exclude?: Array<'type' | 'publisher' | 'genre' | 'language' | 'binding' | 'conditionLabel'>;
    },
  ): Prisma.ProductWhereInput {
    const exclude = new Set(opts?.exclude ?? []);

    const {
      search,
      type,
      publisher,
      genre,
      language,
      binding,
      seriesName,
      conditionLabel,
      featured,
      inStock,
      minPrice,
      maxPrice,
      minYear,
      maxYear,
      minPages,
      maxPages,
      publicationDateFrom,
      publicationDateTo,
    } = query;

    const price: { gte?: Prisma.Decimal; lte?: Prisma.Decimal } = {};
    if (minPrice !== undefined && Number.isFinite(minPrice)) {
      price.gte = new Prisma.Decimal(minPrice);
    }
    if (maxPrice !== undefined && Number.isFinite(maxPrice)) {
      price.lte = new Prisma.Decimal(maxPrice);
    }

    const publicationYear: { gte?: number; lte?: number } = {};
    if (minYear !== undefined && Number.isInteger(minYear) && minYear >= 0) {
      publicationYear.gte = minYear;
    }
    if (maxYear !== undefined && Number.isInteger(maxYear) && maxYear >= 0) {
      publicationYear.lte = maxYear;
    }

    const pageCount: { gte?: number; lte?: number } = {};
    if (minPages !== undefined && Number.isInteger(minPages) && minPages > 0) {
      pageCount.gte = minPages;
    }
    if (maxPages !== undefined && Number.isInteger(maxPages) && maxPages > 0) {
      pageCount.lte = maxPages;
    }

    const publicationDate: { gte?: Date; lte?: Date } = {};
    if (publicationDateFrom) {
      publicationDate.gte = new Date(publicationDateFrom);
    }
    if (publicationDateTo) {
      publicationDate.lte = new Date(publicationDateTo);
    }

    return {
      isActive: true,
      type: exclude.has('type') ? undefined : type,
      publisher:
        !exclude.has('publisher') && publisher
          ? {
              contains: publisher,
              mode: 'insensitive',
            }
          : undefined,
      genre:
        !exclude.has('genre') && genre
          ? {
              contains: genre,
              mode: 'insensitive',
            }
          : undefined,
      language:
        !exclude.has('language') && language
          ? {
              contains: language,
              mode: 'insensitive',
            }
          : undefined,
      binding:
        !exclude.has('binding') && binding
          ? {
              contains: binding,
              mode: 'insensitive',
            }
          : undefined,
      seriesName: seriesName
        ? {
            contains: seriesName,
            mode: 'insensitive',
          }
        : undefined,
      conditionLabel:
        !exclude.has('conditionLabel') && conditionLabel
          ? {
              contains: conditionLabel,
              mode: 'insensitive',
            }
          : undefined,
      isFeatured: featured,
      stock: inStock ? { gt: 0 } : undefined,
      price: Object.keys(price).length > 0 ? price : undefined,
      pageCount: Object.keys(pageCount).length > 0 ? pageCount : undefined,
      publicationYear: Object.keys(publicationYear).length > 0 ? publicationYear : undefined,
      publicationDate: Object.keys(publicationDate).length > 0 ? publicationDate : undefined,
      OR: search
        ? [
            { title: { contains: search, mode: 'insensitive' } },
            { subtitle: { contains: search, mode: 'insensitive' } },
            { author: { contains: search, mode: 'insensitive' } },
            { publisher: { contains: search, mode: 'insensitive' } },
            { genre: { contains: search, mode: 'insensitive' } },
            { seriesName: { contains: search, mode: 'insensitive' } },
            { language: { contains: search, mode: 'insensitive' } },
            { binding: { contains: search, mode: 'insensitive' } },
            { translator: { contains: search, mode: 'insensitive' } },
            { illustrator: { contains: search, mode: 'insensitive' } },
            { narrator: { contains: search, mode: 'insensitive' } },
            { editor: { contains: search, mode: 'insensitive' } },
            { isbn: { contains: search, mode: 'insensitive' } },
            { isbn10: { contains: search, mode: 'insensitive' } },
            { isbn13: { contains: search, mode: 'insensitive' } },
            { ean: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
  }

  private mapStringFacetRows<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
    return rows
      .map((row) => {
        const value = row[key];
        if (typeof value !== 'string') {
          return null;
        }
        const trimmed = value.trim();
        if (!trimmed) {
          return null;
        }
        const countRaw = (row as unknown as { _count?: { _all?: number } })._count?._all;
        return {
          value: trimmed,
          count: Number.isFinite(countRaw) ? Number(countRaw) : 0,
        };
      })
      .filter((item): item is { value: string; count: number } => !!item)
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
      .slice(0, 20);
  }

  private normalizeProductInput<T extends CreateProductDto | UpdateProductDto>(dto: T): T {
    const normalized: Record<string, unknown> = { ...dto };

    const minEta = normalized.shippingEtaMinDays;
    const maxEta = normalized.shippingEtaMaxDays;
    if (
      typeof minEta === 'number' &&
      typeof maxEta === 'number' &&
      Number.isInteger(minEta) &&
      Number.isInteger(maxEta) &&
      maxEta < minEta
    ) {
      throw new BadRequestException(
        'shippingEtaMaxDays debe ser mayor o igual a shippingEtaMinDays',
      );
    }

    const isbn13 = normalized.isbn13;
    const ean = normalized.ean;
    if (
      typeof isbn13 === 'string' &&
      isbn13.length > 0 &&
      typeof ean === 'string' &&
      ean.length > 0 &&
      isbn13 !== ean
    ) {
      throw new BadRequestException('EAN debe coincidir con ISBN-13 cuando ambos se envian');
    }

    if (typeof normalized.publicationDate === 'string' && !normalized.publicationYear) {
      const parsed = new Date(normalized.publicationDate);
      if (!Number.isNaN(parsed.getTime())) {
        normalized.publicationYear = parsed.getUTCFullYear();
      }
    }

    if (typeof normalized.isbn13 === 'string' && normalized.isbn13.length > 0) {
      if (typeof normalized.ean !== 'string' || normalized.ean.length === 0) {
        normalized.ean = normalized.isbn13;
      }
      if (typeof normalized.isbn !== 'string' || normalized.isbn.length === 0) {
        normalized.isbn = normalized.isbn13;
      }
    }

    return normalized as T;
  }
}
