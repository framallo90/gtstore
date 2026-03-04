import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum SellerApplicationReviewDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  SUSPEND = 'SUSPEND',
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class ReviewSellerApplicationDto {
  @IsEnum(SellerApplicationReviewDecision)
  decision!: SellerApplicationReviewDecision;

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
