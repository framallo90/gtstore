import { ApiProperty } from '@nestjs/swagger';
import { ProductType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsISBN,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

function normalizeIsbnLike(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/[\s-]/g, '').trim().toUpperCase();
}

function normalizeEan(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/\D/g, '').trim();
}

export class CreateProductDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(220)
  title!: string;

  @ApiProperty({ required: false, description: 'Subtitulo comercial de la obra' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(220)
  subtitle?: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  description!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(140)
  author!: string;

  @ApiProperty({ required: false, description: 'Editorial / publisher' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(140)
  publisher?: string;

  @ApiProperty({ required: false, description: 'Genero o categoria editorial' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(140)
  genre?: string;

  @ApiProperty({ required: false, description: 'Nombre de la serie/coleccion' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(160)
  seriesName?: string;

  @ApiProperty({ required: false, description: 'Numero dentro de la serie/coleccion' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  seriesNumber?: number;

  @ApiProperty({ required: false, description: 'Idioma de la edicion' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(60)
  language?: string;

  @ApiProperty({ required: false, description: 'Encuadernacion (ej: Tapa Blanda)' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  binding?: string;

  @ApiProperty({ required: false, description: 'Edicion (ej: 1ra edicion)' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  edition?: string;

  @ApiProperty({ required: false, description: 'Traductor/a' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  translator?: string;

  @ApiProperty({ required: false, description: 'Ilustrador/a' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  illustrator?: string;

  @ApiProperty({ required: false, description: 'Narrador/a (audiolibro)' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  narrator?: string;

  @ApiProperty({ required: false, description: 'Editor responsable' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  editor?: string;

  @ApiProperty({ required: false, description: 'Pais de origen de la edicion' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  originCountry?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => normalizeIsbnLike(value))
  @IsISBN()
  @IsString()
  @MaxLength(17)
  isbn?: string;

  @ApiProperty({ required: false, description: 'ISBN-10' })
  @IsOptional()
  @Transform(({ value }) => normalizeIsbnLike(value))
  @IsISBN('10')
  @IsString()
  @MaxLength(10)
  isbn10?: string;

  @ApiProperty({ required: false, description: 'ISBN-13' })
  @IsOptional()
  @Transform(({ value }) => normalizeIsbnLike(value))
  @IsISBN('13')
  @IsString()
  @MaxLength(13)
  isbn13?: string;

  @ApiProperty({ required: false, description: 'EAN de 13 digitos' })
  @IsOptional()
  @Transform(({ value }) => normalizeEan(value))
  @Matches(/^\d{13}$/)
  @IsString()
  @MaxLength(13)
  ean?: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(60)
  sku!: string;

  @ApiProperty({ enum: ProductType })
  @IsEnum(ProductType)
  type!: ProductType;

  @ApiProperty({ required: false, description: 'Ano de publicacion/edicion' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  publicationYear?: number;

  @ApiProperty({ required: false, description: 'Fecha completa de publicacion' })
  @IsOptional()
  @IsDateString()
  publicationDate?: string;

  @ApiProperty({ required: false, description: 'Cantidad de paginas' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  pageCount?: number;

  @ApiProperty({ required: false, description: 'Dimensiones fisicas (ej: 23x15 cm)' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  dimensions?: string;

  @ApiProperty({ required: false, description: 'Alto en cm' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  heightCm?: number;

  @ApiProperty({ required: false, description: 'Ancho en cm' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  widthCm?: number;

  @ApiProperty({ required: false, description: 'Espesor en cm' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  thicknessCm?: number;

  @ApiProperty({ required: false, description: 'Peso en gramos' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  weightGrams?: number;

  @ApiProperty({ required: false, description: 'Estado comercial (ej: Nuevo / Usado)' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(40)
  conditionLabel?: string;

  @ApiProperty({ required: false, description: 'ETA minima de entrega (dias)' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  shippingEtaMinDays?: number;

  @ApiProperty({ required: false, description: 'ETA maxima de entrega (dias)' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  shippingEtaMaxDays?: number;

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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1200)
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
