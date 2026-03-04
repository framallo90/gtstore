import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { ApplySellerDto } from './dto/apply-seller.dto';
import { ReapplySellerDto } from './dto/reapply-seller.dto';
import { SellerVerificationService } from './seller-verification.service';

@ApiTags('Marketplace Seller')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace/seller')
export class SellerVerificationController {
  constructor(private readonly sellerVerificationService: SellerVerificationService) {}

  @Get('application')
  current(@CurrentUser() user: JwtPayload) {
    return this.sellerVerificationService.getCurrentApplication(user.sub);
  }

  @Post('apply')
  apply(@CurrentUser() user: JwtPayload, @Body() dto: ApplySellerDto) {
    return this.sellerVerificationService.apply(user.sub, dto);
  }

  @Put('application')
  reapply(@CurrentUser() user: JwtPayload, @Body() dto: ReapplySellerDto) {
    return this.sellerVerificationService.reapply(user.sub, dto);
  }
}