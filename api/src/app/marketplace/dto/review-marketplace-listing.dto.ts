import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MarketplaceReviewDecision } from '@prisma/client';

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class ReviewMarketplaceListingDto {
  @IsEnum(MarketplaceReviewDecision)
  decision!: MarketplaceReviewDecision;

  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(120)
  reason!: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
