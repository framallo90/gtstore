import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

function normalizeRequiredString(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }
  return value.trim();
}

export class CreateMarketplaceAppealDto {
  @Transform(({ value }) => normalizeRequiredString(value))
  @IsString()
  @MaxLength(1500)
  message!: string;
}
