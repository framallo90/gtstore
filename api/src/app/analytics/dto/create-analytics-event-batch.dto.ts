import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { CreateAnalyticsEventDto } from './create-analytics-event.dto';

export class CreateAnalyticsEventBatchDto {
  @ApiProperty({ type: [CreateAnalyticsEventDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateAnalyticsEventDto)
  events!: CreateAnalyticsEventDto[];
}

