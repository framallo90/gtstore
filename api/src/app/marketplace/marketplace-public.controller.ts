import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QueryMarketplaceListingsDto } from './dto/query-marketplace-listings.dto';
import { MarketplacePublicService } from './marketplace-public.service';

@ApiTags('Marketplace')
@Controller('marketplace')
export class MarketplacePublicController {
  constructor(
    private readonly marketplacePublicService: MarketplacePublicService,
  ) {}

  @Get('listings')
  list(@Query() query: QueryMarketplaceListingsDto) {
    return this.marketplacePublicService.list(query);
  }

  @Get('listings/:id')
  detail(@Param('id') id: string) {
    return this.marketplacePublicService.detail(id);
  }
}
