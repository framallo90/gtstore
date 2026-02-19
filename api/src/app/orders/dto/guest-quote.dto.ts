import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
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
  @IsString()
  couponCode?: string;
}

