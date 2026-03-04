import { IsEnum } from 'class-validator';
import { MarketplaceOrderStatus } from '@prisma/client';

export class UpdateMarketplaceOrderStatusDto {
  @IsEnum(MarketplaceOrderStatus)
  status!: MarketplaceOrderStatus;
}
