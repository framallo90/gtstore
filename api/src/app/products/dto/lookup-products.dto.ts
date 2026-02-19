import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class LookupProductsDto {
  @ApiProperty({ type: [String], maxItems: 200 })
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids!: string[];
}

