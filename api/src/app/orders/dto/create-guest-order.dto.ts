import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { GuestQuoteDto } from './guest-quote.dto';

export class CreateGuestOrderDto extends GuestQuoteDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(200)
  guestEmail!: string;

  @ApiProperty({ required: false, enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiProperty()
  @IsString()
  @MaxLength(60)
  guestFirstName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(60)
  guestLastName!: string;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(800)
  notes?: string;
}
