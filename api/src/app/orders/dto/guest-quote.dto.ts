import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { GuestCartItemDto } from './guest-cart-item.dto';

export class GuestQuoteDto {
  @ApiProperty({ type: [GuestCartItemDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GuestCartItemDto)
  items!: GuestCartItemDto[];

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  shippingCity?: string;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MaxLength(10)
  @Matches(/^(?:[A-Za-z]\d{4}[A-Za-z]{0,3}|\d{4,8})$/)
  shippingPostalCode?: string;
}
