import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MarketplaceAppealStatus,
  MarketplaceAssetType,
  MarketplaceListingStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddMarketplaceListingAssetDto } from './dto/add-marketplace-listing-asset.dto';
import { CreateMarketplaceAppealDto } from './dto/create-marketplace-appeal.dto';
import { CreateMarketplaceListingDto } from './dto/create-marketplace-listing.dto';
import { SetMarketplaceListingCoverDto } from './dto/set-marketplace-listing-cover.dto';
import { UpdateMarketplaceListingDto } from './dto/update-marketplace-listing.dto';
import {
  normalizeOptionalText,
  normalizeRequiredText,
} from './listing-text-sanitizer';

const EDITABLE_STATUSES: MarketplaceListingStatus[] = [
  MarketplaceListingStatus.DRAFT,
  MarketplaceListingStatus.CHANGES_REQUESTED,
];

@Injectable()
export class SellerListingsService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(userId: string) {
    return this.prisma.marketplaceListing.findMany({
      where: { sellerId: userId },
      include: {
        assets: { orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async detailMine(userId: string, id: string) {
    return this.findOwnedListing(userId, id);
  }

  async create(userId: string, dto: CreateMarketplaceListingDto) {
    await this.ensureSellerApproved(userId);

    return this.prisma.marketplaceListing.create({
      data: this.buildCreateData(userId, dto),
      include: {
        assets: { orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateMarketplaceListingDto) {
    const listing = await this.findOwnedEditableListing(userId, id);
    const data = this.buildUpdateData(dto);

    if (Object.keys(data).length === 0) {
      return listing;
    }

    return this.prisma.marketplaceListing.update({
      where: { id: listing.id },
      data,
      include: {
        assets: { orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  }

  async addAsset(userId: string, listingId: string, dto: AddMarketplaceListingAssetDto) {
    const listing = await this.findOwnedEditableListing(userId, listingId);
    const normalizedPath = dto.path.trim();

    const created = await this.prisma.marketplaceListingAsset.create({
      data: {
        listingId: listing.id,
        type: dto.type,
        path: normalizedPath,
        isEvidence: dto.isEvidence ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    if (!listing.coverAssetId && created.type === MarketplaceAssetType.IMAGE) {
      await this.prisma.$transaction([
        this.prisma.marketplaceListingAsset.update({
          where: { id: created.id },
          data: { isCover: true },
        }),
        this.prisma.marketplaceListing.update({
          where: { id: listing.id },
          data: { coverAssetId: created.id },
        }),
      ]);
      return this.prisma.marketplaceListingAsset.findUnique({ where: { id: created.id } });
    }

    return created;
  }

  async removeAsset(userId: string, listingId: string, assetId: string) {
    const listing = await this.findOwnedEditableListing(userId, listingId);
    const asset = await this.prisma.marketplaceListingAsset.findFirst({
      where: { id: assetId, listingId: listing.id },
    });

    if (!asset) {
      throw new NotFoundException('Marketplace listing asset not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.marketplaceListingAsset.delete({ where: { id: asset.id } });
      if (listing.coverAssetId === asset.id) {
        await tx.marketplaceListing.update({
          where: { id: listing.id },
          data: { coverAssetId: null },
        });
      }
    });

    return { success: true };
  }

  async setCover(userId: string, listingId: string, dto: SetMarketplaceListingCoverDto) {
    const listing = await this.findOwnedEditableListing(userId, listingId);
    const asset = await this.prisma.marketplaceListingAsset.findFirst({
      where: {
        id: dto.assetId,
        listingId: listing.id,
        type: MarketplaceAssetType.IMAGE,
      },
    });

    if (!asset) {
      throw new NotFoundException('Image asset not found for this listing');
    }

    await this.prisma.$transaction([
      this.prisma.marketplaceListingAsset.updateMany({
        where: { listingId: listing.id },
        data: { isCover: false },
      }),
      this.prisma.marketplaceListingAsset.update({
        where: { id: asset.id },
        data: { isCover: true },
      }),
      this.prisma.marketplaceListing.update({
        where: { id: listing.id },
        data: { coverAssetId: asset.id },
      }),
    ]);

    return this.findOwnedListing(userId, listing.id);
  }

  async submit(userId: string, listingId: string, note?: string) {
    const [seller, listing] = await Promise.all([
      this.ensureSellerApproved(userId),
      this.findOwnedEditableListing(userId, listingId),
    ]);

    if (!seller.country || !seller.province || !seller.city || !seller.postalCode) {
      throw new BadRequestException('Seller location is incomplete');
    }

    const imageAssets = listing.assets.filter((asset) => asset.type === MarketplaceAssetType.IMAGE);
    if (imageAssets.length < 6) {
      throw new BadRequestException(
        'At least 6 image assets are required before submitting a marketplace listing',
      );
    }

    if (!listing.coverAssetId) {
      throw new BadRequestException('A cover image must be selected before submitting');
    }

    const cover = listing.assets.find((asset) => asset.id === listing.coverAssetId);
    if (!cover || cover.type !== MarketplaceAssetType.IMAGE) {
      throw new BadRequestException('The selected cover must be an image asset');
    }

    return this.prisma.marketplaceListing.update({
      where: { id: listing.id },
      data: {
        status: MarketplaceListingStatus.PENDING_REVIEW,
        isActive: false,
        adminReason: normalizeOptionalText(note, 'note') ?? null,
        appealStatus: MarketplaceAppealStatus.NONE,
      },
      include: {
        assets: { orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  }

  async createAppeal(
    userId: string,
    listingId: string,
    dto: CreateMarketplaceAppealDto,
  ) {
    const listing = await this.findOwnedListing(userId, listingId);
    if (
      listing.status !== MarketplaceListingStatus.REJECTED &&
      listing.status !== MarketplaceListingStatus.REMOVED_BY_ADMIN
    ) {
      throw new ConflictException(
        'Marketplace listing cannot be appealed in its current status',
      );
    }
    if (listing.appealStatus === MarketplaceAppealStatus.PENDING) {
      throw new ConflictException(
        'Marketplace listing already has a pending appeal',
      );
    }

    const existingAppealCount = await this.prisma.marketplaceAppeal.count({
      where: { listingId },
    });
    if (existingAppealCount > 0) {
      throw new ConflictException(
        'Only one appeal is allowed per marketplace listing',
      );
    }

    const message = normalizeRequiredText(dto.message, 'message');
    const [, created] = await this.prisma.$transaction([
      this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: {
          appealStatus: MarketplaceAppealStatus.PENDING,
        },
      }),
      this.prisma.marketplaceAppeal.create({
        data: {
          listingId,
          sellerId: userId,
          status: MarketplaceAppealStatus.PENDING,
          message,
        },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              status: true,
              appealStatus: true,
              adminReason: true,
            },
          },
        },
      }),
    ]);

    return created;
  }

  private async ensureSellerApproved(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        sellerStatus: true,
        country: true,
        province: true,
        city: true,
        postalCode: true,
      },
    });

    if (!user || !user.isActive) {
      throw new ForbiddenException('User is not allowed to manage marketplace listings');
    }
    if (user.sellerStatus !== 'APPROVED') {
      throw new ForbiddenException('Seller account is not approved');
    }
    return user;
  }

  private async findOwnedListing(userId: string, id: string) {
    const listing = await this.prisma.marketplaceListing.findFirst({
      where: { id, sellerId: userId },
      include: {
        assets: { orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    if (!listing) {
      throw new NotFoundException('Marketplace listing not found');
    }

    return listing;
  }

  private async findOwnedEditableListing(userId: string, id: string) {
    await this.ensureSellerApproved(userId);
    const listing = await this.findOwnedListing(userId, id);
    if (!EDITABLE_STATUSES.includes(listing.status)) {
      throw new ConflictException('Marketplace listing is not editable in its current status');
    }
    return listing;
  }

  private buildCreateData(userId: string, dto: CreateMarketplaceListingDto): Prisma.MarketplaceListingCreateInput {
    return {
      seller: { connect: { id: userId } },
      category: dto.category,
      title: normalizeRequiredText(dto.title, 'title'),
      subtitle: normalizeOptionalText(dto.subtitle, 'subtitle'),
      description: normalizeRequiredText(dto.description, 'description'),
      author: normalizeOptionalText(dto.author, 'author'),
      publisher: normalizeOptionalText(dto.publisher, 'publisher'),
      genre: normalizeOptionalText(dto.genre, 'genre'),
      language: normalizeOptionalText(dto.language, 'language'),
      edition: normalizeOptionalText(dto.edition, 'edition'),
      publicationYear: dto.publicationYear,
      isbn: typeof dto.isbn === 'string' && dto.isbn.trim() ? dto.isbn.trim() : undefined,
      condition: dto.condition,
      conditionNotes: normalizeOptionalText(dto.conditionNotes, 'conditionNotes'),
      declaredDefects: normalizeOptionalText(dto.declaredDefects, 'declaredDefects'),
      price: dto.price,
      stock: 1,
      status: MarketplaceListingStatus.DRAFT,
      appealStatus: MarketplaceAppealStatus.NONE,
      isActive: false,
    };
  }

  private buildUpdateData(dto: UpdateMarketplaceListingDto): Prisma.MarketplaceListingUpdateInput {
    const data: Prisma.MarketplaceListingUpdateInput = {};

    if (dto.category !== undefined) {
      data.category = dto.category;
    }
    if (dto.title !== undefined) {
      data.title = normalizeRequiredText(dto.title, 'title');
    }
    if (dto.subtitle !== undefined) {
      data.subtitle = normalizeOptionalText(dto.subtitle, 'subtitle');
    }
    if (dto.description !== undefined) {
      data.description = normalizeRequiredText(dto.description, 'description');
    }
    if (dto.author !== undefined) {
      data.author = normalizeOptionalText(dto.author, 'author');
    }
    if (dto.publisher !== undefined) {
      data.publisher = normalizeOptionalText(dto.publisher, 'publisher');
    }
    if (dto.genre !== undefined) {
      data.genre = normalizeOptionalText(dto.genre, 'genre');
    }
    if (dto.language !== undefined) {
      data.language = normalizeOptionalText(dto.language, 'language');
    }
    if (dto.edition !== undefined) {
      data.edition = normalizeOptionalText(dto.edition, 'edition');
    }
    if (dto.publicationYear !== undefined) {
      data.publicationYear = dto.publicationYear;
    }
    if (dto.isbn !== undefined) {
      data.isbn = typeof dto.isbn === 'string' && dto.isbn.trim() ? dto.isbn.trim() : null;
    }
    if (dto.condition !== undefined) {
      data.condition = dto.condition;
    }
    if (dto.conditionNotes !== undefined) {
      data.conditionNotes = normalizeOptionalText(dto.conditionNotes, 'conditionNotes') ?? null;
    }
    if (dto.declaredDefects !== undefined) {
      data.declaredDefects = normalizeOptionalText(dto.declaredDefects, 'declaredDefects') ?? null;
    }
    if (dto.price !== undefined) {
      data.price = dto.price;
    }

    return data;
  }
}
