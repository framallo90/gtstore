import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ValidateCouponDto {
  @ApiProperty()
  @IsString()
  code!: string;
}