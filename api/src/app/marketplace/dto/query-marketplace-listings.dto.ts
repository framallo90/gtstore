import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MarketplaceListingCategory } from '@prisma/client';

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalInt(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : value;
}

export class QueryMarketplaceListingsDto {
  @IsOptional()
  @IsEnum(MarketplaceListingCategory)
  category?: MarketplaceListingCategory;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalInt(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
