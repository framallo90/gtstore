import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum MarketplaceAppealResolution {
  ACCEPT = 'ACCEPTED',
  REJECT = 'REJECTED',
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class ResolveMarketplaceAppealDto {
  @IsEnum(MarketplaceAppealResolution)
  status!: MarketplaceAppealResolution;

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
