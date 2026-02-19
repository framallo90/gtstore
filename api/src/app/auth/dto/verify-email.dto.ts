import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  token!: string;
}

