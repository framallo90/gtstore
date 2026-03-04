import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MarketplaceAssetType,
  MarketplaceListingStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryMarketplaceListingsDto } from './dto/query-marketplace-listings.dto';

@Injectable()
export class MarketplacePublicService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryMarketplaceListingsDto) {
    const take = query.limit ?? 24;
    const where: Prisma.MarketplaceListingWhereInput = {
      status: MarketplaceListingStatus.PUBLISHED,
      isActive: true,
    };

    if (query.category) {
      where.category = query.category;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { subtitle: { contains: query.search, mode: 'insensitive' } },
        { author: { contains: query.search, mode: 'insensitive' } },
        { publisher: { contains: query.search, mode: 'insensitive' } },
        { genre: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const listings = await this.prisma.marketplaceListing.findMany({
      where,
      take,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        category: true,
        title: true,
        subtitle: true,
        price: true,
        condition: true,
        publishedAt: true,
        seller: {
          select: {
            city: true,
            province: true,
            country: true,
          },
        },
        assets: {
          where: { isApproved: true },
          orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            type: true,
            path: true,
            isCover: true,
          },
        },
      },
    });

    return listings.map((listing) => {
      const visibleImages = listing.assets.filter((asset) => asset.type === MarketplaceAssetType.IMAGE);
      const cover = visibleImages.find((asset) => asset.isCover) ?? visibleImages[0] ?? null;
      const hasVideo = listing.assets.some((asset) => asset.type === MarketplaceAssetType.VIDEO);

      return {
        id: listing.id,
        category: listing.category,
        title: listing.title,
        subtitle: listing.subtitle,
        price: listing.price,
        condition: listing.condition,
        publishedAt: listing.publishedAt,
        marketplace: true,
        moderated: true,
        coverAsset: cover
          ? {
              id: cover.id,
              path: cover.path,
            }
          : null,
        visibleImageCount: visibleImages.length,
        hasVideo,
        sellerZone: {
          city: listing.seller.city,
          province: listing.seller.province,
          country: listing.seller.country,
        },
        claimPolicy: {
          claimWindowHours: 48,
          noDirectContact: true,
        },
      };
    });
  }

  async detail(id: string) {
    const listing = await this.prisma.marketplaceListing.findFirst({
      where: {
        id,
        status: MarketplaceListingStatus.PUBLISHED,
        isActive: true,
      },
      select: {
        id: true,
        category: true,
        title: true,
        subtitle: true,
        description: true,
        author: true,
        publisher: true,
        genre: true,
        language: true,
        edition: true,
        publicationYear: true,
        isbn: true,
        condition: true,
        conditionNotes: true,
        declaredDefects: true,
        price: true,
        publishedAt: true,
        seller: {
          select: {
            city: true,
            province: true,
            country: true,
          },
        },
        assets: {
          where: { isApproved: true },
          orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            type: true,
            path: true,
            isCover: true,
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Marketplace listing not found');
    }

    const visibleImages = listing.assets.filter((asset) => asset.type === MarketplaceAssetType.IMAGE);
    const visibleVideos = listing.assets.filter((asset) => asset.type === MarketplaceAssetType.VIDEO);

    return {
      id: listing.id,
      category: listing.category,
      title: listing.title,
      subtitle: listing.subtitle,
      description: listing.description,
      author: listing.author,
      publisher: listing.publisher,
      genre: listing.genre,
      language: listing.language,
      edition: listing.edition,
      publicationYear: listing.publicationYear,
      isbn: listing.isbn,
      condition: listing.condition,
      conditionNotes: listing.conditionNotes,
      declaredDefects: listing.declaredDefects,
      price: listing.price,
      publishedAt: listing.publishedAt,
      marketplace: true,
      moderated: true,
      sellerZone: {
        city: listing.seller.city,
        province: listing.seller.province,
        country: listing.seller.country,
      },
      media: {
        images: visibleImages.map((asset) => ({
          id: asset.id,
          path: asset.path,
          isCover: asset.isCover,
        })),
        videos: visibleVideos.map((asset) => ({
          id: asset.id,
          path: asset.path,
        })),
      },
      claimPolicy: {
        claimWindowHours: 48,
        requiresInPlatformClaim: true,
        noDirectContact: true,
      },
    };
  }
}
