import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { AddMarketplaceListingAssetDto } from './dto/add-marketplace-listing-asset.dto';
import { CreateMarketplaceAppealDto } from './dto/create-marketplace-appeal.dto';
import { CreateMarketplaceListingDto } from './dto/create-marketplace-listing.dto';
import { SetMarketplaceListingCoverDto } from './dto/set-marketplace-listing-cover.dto';
import { SubmitMarketplaceListingDto } from './dto/submit-marketplace-listing.dto';
import { UpdateMarketplaceListingDto } from './dto/update-marketplace-listing.dto';
import { SellerListingsService } from './seller-listings.service';

@ApiTags('Marketplace Seller')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace/seller')
export class SellerListingsController {
  constructor(private readonly sellerListingsService: SellerListingsService) {}

  @Get('listings')
  listMine(@CurrentUser() user: JwtPayload) {
    return this.sellerListingsService.listMine(user.sub);
  }

  @Post('listings')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMarketplaceListingDto) {
    return this.sellerListingsService.create(user.sub, dto);
  }

  @Get('listings/:id')
  detail(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sellerListingsService.detailMine(user.sub, id);
  }

  @Patch('listings/:id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMarketplaceListingDto,
  ) {
    return this.sellerListingsService.update(user.sub, id, dto);
  }

  @Post('listings/:id/assets')
  addAsset(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddMarketplaceListingAssetDto,
  ) {
    return this.sellerListingsService.addAsset(user.sub, id, dto);
  }

  @Delete('listings/:id/assets/:assetId')
  removeAsset(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('assetId') assetId: string,
  ) {
    return this.sellerListingsService.removeAsset(user.sub, id, assetId);
  }

  @Patch('listings/:id/cover')
  setCover(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetMarketplaceListingCoverDto,
  ) {
    return this.sellerListingsService.setCover(user.sub, id, dto);
  }

  @Post('listings/:id/submit')
  submit(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SubmitMarketplaceListingDto,
  ) {
    return this.sellerListingsService.submit(user.sub, id, dto.note);
  }

  @Post('listings/:id/appeal')
  createAppeal(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateMarketplaceAppealDto,
  ) {
    return this.sellerListingsService.createAppeal(user.sub, id, dto);
  }
}
