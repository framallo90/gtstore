import { ApiProperty } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCouponDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  type!: DiscountType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  discount!: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;
}