import { ApiProperty } from '@nestjs/swagger';
import { ProductType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsString()
  author!: string;

  @ApiProperty({ required: false, description: 'Editorial / publisher' })
  @IsOptional()
  @IsString()
  publisher?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  isbn?: string;

  @ApiProperty()
  @IsString()
  sku!: string;

  @ApiProperty({ enum: ProductType })
  @IsEnum(ProductType)
  type!: ProductType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  stock!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
