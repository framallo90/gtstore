import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

function normalizeRequiredString(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }
  return value.trim();
}

export class CreateMarketplaceOrderQuoteDto {
  @Transform(({ value }) => normalizeRequiredString(value))
  @IsString()
  listingId!: string;

  @Transform(({ value }) => normalizeRequiredString(value))
  @IsString()
  @MaxLength(120)
  shippingCity!: string;

  @Transform(({ value }) => normalizeRequiredString(value))
  @IsString()
  @MaxLength(24)
  shippingPostalCode!: string;
}
