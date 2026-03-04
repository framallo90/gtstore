import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MarketplaceAppealStatus,
  MarketplaceListingStatus,
  MarketplaceReviewDecision,
  SellerStatus,
  SellerVerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResolveMarketplaceAppealDto } from './dto/resolve-marketplace-appeal.dto';
import {
  ReviewSellerApplicationDto,
  SellerApplicationReviewDecision,
} from './dto/review-seller-application.dto';
import { ReviewMarketplaceListingDto } from './dto/review-marketplace-listing.dto';

const REVIEWABLE_LISTING_STATUSES: MarketplaceListingStatus[] = [
  MarketplaceListingStatus.PENDING_REVIEW,
];

function normalizeAdminRequiredText(input: unknown, field: string, maxLen: number) {
  if (typeof input !== 'string') {
    throw new BadRequestException(`${field} is required`);
  }
  const trimmed = input.trim();
  if (!trimmed) {
    throw new BadRequestException(`${field} is required`);
  }
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function normalizeAdminOptionalText(input: unknown, maxLen: number) {
  if (typeof input !== 'string') {
    return undefined;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function joinReasonAndNotes(reason: string, notes?: string) {
  return notes ? `${reason}\n\n${notes}` : reason;
}

@Injectable()
export class MarketplaceAdminService {
  constructor(private readonly prisma: PrismaService) {}

  listSellerApplications(status?: string) {
    return this.prisma.sellerVerificationRequest.findMany({
      where: {
        status: this.parseSellerVerificationStatus(status),
      },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            sellerStatus: true,
            isActive: true,
            country: true,
            province: true,
            city: true,
            postalCode: true,
          },
        },
      },
    });
  }

  async reviewSellerApplication(id: string, dto: ReviewSellerApplicationDto) {
    const application = await this.prisma.sellerVerificationRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            sellerStatus: true,
            isActive: true,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Seller verification request not found');
    }
    if (application.status !== SellerVerificationStatus.PENDING) {
      throw new ConflictException('Seller verification request was already reviewed');
    }
    if (!application.user.isActive) {
      throw new ConflictException('User is inactive');
    }

    const reason = normalizeAdminRequiredText(dto.reason, 'reason', 120);
    const notes = normalizeAdminOptionalText(dto.notes, 1000);
    const reviewNotes = joinReasonAndNotes(reason, notes);

    let nextVerificationStatus: SellerVerificationStatus;
    let nextSellerStatus: SellerStatus;
    switch (dto.decision) {
      case SellerApplicationReviewDecision.APPROVE:
        nextVerificationStatus = SellerVerificationStatus.APPROVED;
        nextSellerStatus = SellerStatus.APPROVED;
        break;
      case SellerApplicationReviewDecision.REJECT:
        nextVerificationStatus = SellerVerificationStatus.REJECTED;
        nextSellerStatus = SellerStatus.REJECTED;
        break;
      case SellerApplicationReviewDecision.SUSPEND:
        nextVerificationStatus = SellerVerificationStatus.SUSPENDED;
        nextSellerStatus = SellerStatus.SUSPENDED;
        break;
      default:
        throw new BadRequestException('Unsupported decision');
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: application.userId },
        data: { sellerStatus: nextSellerStatus },
      }),
      this.prisma.sellerVerificationRequest.update({
        where: { id },
        data: {
          status: nextVerificationStatus,
          reviewNotes,
          reviewedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              sellerStatus: true,
              isActive: true,
              country: true,
              province: true,
              city: true,
              postalCode: true,
            },
          },
        },
      }),
    ]);

    return updated;
  }

  listListings(status?: string) {
    return this.prisma.marketplaceListing.findMany({
      where: {
        status: this.parseMarketplaceListingStatus(status),
      },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        seller: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            sellerStatus: true,
            country: true,
            province: true,
            city: true,
            postalCode: true,
          },
        },
        assets: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        appeals: {
          where: { status: MarketplaceAppealStatus.PENDING },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
        },
      },
    });
  }

  async reviewListing(
    reviewerId: string,
    id: string,
    dto: ReviewMarketplaceListingDto,
  ) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id },
      include: {
        assets: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Marketplace listing not found');
    }

    const reason = normalizeAdminRequiredText(dto.reason, 'reason', 120);
    const notes = normalizeAdminOptionalText(dto.notes, 1000);
    const adminReason = joinReasonAndNotes(reason, notes);

    if (dto.decision === MarketplaceReviewDecision.REMOVE) {
      if (
        listing.status === MarketplaceListingStatus.SOLD ||
        listing.status === MarketplaceListingStatus.ARCHIVED ||
        listing.status === MarketplaceListingStatus.REMOVED_BY_ADMIN
      ) {
        throw new ConflictException(
          'Marketplace listing cannot be removed in its current status',
        );
      }
    } else if (!REVIEWABLE_LISTING_STATUSES.includes(listing.status)) {
      throw new ConflictException('Marketplace listing is not pending review');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.marketplaceReview.create({
        data: {
          listingId: id,
          reviewerId,
          decision: dto.decision,
          reason,
          notes,
        },
      });

      if (dto.decision === MarketplaceReviewDecision.APPROVE) {
        await tx.marketplaceListingAsset.updateMany({
          where: { listingId: id },
          data: { isApproved: true },
        });
      }

      return tx.marketplaceListing.update({
        where: { id },
        data: this.buildListingReviewUpdate(dto.decision, adminReason),
        include: {
          seller: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              sellerStatus: true,
            },
          },
          assets: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
          reviews: {
            orderBy: [{ createdAt: 'desc' }],
            take: 5,
          },
        },
      });
    });
  }

  listAppeals(status?: string) {
    return this.prisma.marketplaceAppeal.findMany({
      where: {
        status: this.parseMarketplaceAppealStatus(status),
      },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        seller: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            sellerStatus: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            status: true,
            appealStatus: true,
            isActive: true,
            adminReason: true,
          },
        },
      },
    });
  }

  async resolveAppeal(id: string, dto: ResolveMarketplaceAppealDto) {
    const appeal = await this.prisma.marketplaceAppeal.findUnique({
      where: { id },
      include: {
        listing: true,
      },
    });

    if (!appeal) {
      throw new NotFoundException('Marketplace appeal not found');
    }
    if (appeal.status !== MarketplaceAppealStatus.PENDING) {
      throw new ConflictException('Marketplace appeal was already resolved');
    }

    const reason = normalizeAdminRequiredText(dto.reason, 'reason', 120);
    const notes = normalizeAdminOptionalText(dto.notes, 1000);
    const resolutionNotes = joinReasonAndNotes(reason, notes);

    const nextAppealStatus =
      dto.status === 'ACCEPTED'
        ? MarketplaceAppealStatus.ACCEPTED
        : MarketplaceAppealStatus.REJECTED;

    const [, updated] = await this.prisma.$transaction([
      this.prisma.marketplaceListing.update({
        where: { id: appeal.listingId },
        data:
          nextAppealStatus === MarketplaceAppealStatus.ACCEPTED
            ? {
                appealStatus: MarketplaceAppealStatus.ACCEPTED,
                status: MarketplaceListingStatus.CHANGES_REQUESTED,
                isActive: false,
                adminReason: resolutionNotes,
              }
            : {
                appealStatus: MarketplaceAppealStatus.REJECTED,
                adminReason: resolutionNotes,
              },
      }),
      this.prisma.marketplaceAppeal.update({
        where: { id },
        data: {
          status: nextAppealStatus,
          resolutionNotes,
          resolvedAt: new Date(),
        },
        include: {
          seller: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              sellerStatus: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              status: true,
              appealStatus: true,
              isActive: true,
              adminReason: true,
            },
          },
        },
      }),
    ]);

    return updated;
  }

  private buildListingReviewUpdate(
    decision: MarketplaceReviewDecision,
    adminReason: string,
  ) {
    if (decision === MarketplaceReviewDecision.APPROVE) {
      return {
        status: MarketplaceListingStatus.PUBLISHED,
        isActive: true,
        publishedAt: new Date(),
        removedAt: null,
        adminReason,
        appealStatus: MarketplaceAppealStatus.NONE,
      };
    }

    if (decision === MarketplaceReviewDecision.REQUEST_CHANGES) {
      return {
        status: MarketplaceListingStatus.CHANGES_REQUESTED,
        isActive: false,
        adminReason,
        appealStatus: MarketplaceAppealStatus.NONE,
      };
    }

    if (decision === MarketplaceReviewDecision.REJECT) {
      return {
        status: MarketplaceListingStatus.REJECTED,
        isActive: false,
        adminReason,
        appealStatus: MarketplaceAppealStatus.NONE,
      };
    }

    return {
      status: MarketplaceListingStatus.REMOVED_BY_ADMIN,
      isActive: false,
      removedAt: new Date(),
      adminReason,
      appealStatus: MarketplaceAppealStatus.NONE,
    };
  }

  private parseSellerVerificationStatus(status?: string) {
    if (typeof status !== 'string' || !status.trim()) {
      return undefined;
    }
    const normalized = status.trim().toUpperCase();
    if (
      !Object.values(SellerVerificationStatus).includes(
        normalized as SellerVerificationStatus,
      )
    ) {
      throw new BadRequestException('Invalid seller verification status');
    }
    return normalized as SellerVerificationStatus;
  }

  private parseMarketplaceListingStatus(status?: string) {
    if (typeof status !== 'string' || !status.trim()) {
      return undefined;
    }
    const normalized = status.trim().toUpperCase();
    if (
      !Object.values(MarketplaceListingStatus).includes(
        normalized as MarketplaceListingStatus,
      )
    ) {
      throw new BadRequestException('Invalid marketplace listing status');
    }
    return normalized as MarketplaceListingStatus;
  }

  private parseMarketplaceAppealStatus(status?: string) {
    if (typeof status !== 'string' || !status.trim()) {
      return undefined;
    }
    const normalized = status.trim().toUpperCase();
    if (
      !Object.values(MarketplaceAppealStatus).includes(
        normalized as MarketplaceAppealStatus,
      )
    ) {
      throw new BadRequestException('Invalid marketplace appeal status');
    }
    return normalized as MarketplaceAppealStatus;
  }
}
