import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

