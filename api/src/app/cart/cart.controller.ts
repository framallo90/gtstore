import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { SyncCartDto } from './dto/sync-cart.dto';
import { UpsertCartItemDto } from './dto/upsert-cart-item.dto';
import { CartService } from './cart.service';

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user: JwtPayload) {
    return this.cartService.getUserCart(user.sub);
  }

  @Post('items')
  upsertItem(@CurrentUser() user: JwtPayload, @Body() dto: UpsertCartItemDto) {
    return this.cartService.upsertItem(user.sub, dto);
  }

  @Post('sync')
  sync(@CurrentUser() user: JwtPayload, @Body() dto: SyncCartDto) {
    return this.cartService.sync(user.sub, dto);
  }

  @Delete('items/:productId')
  removeItem(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
  ) {
    return this.cartService.removeItem(user.sub, productId);
  }

  @Delete()
  clear(@CurrentUser() user: JwtPayload) {
    return this.cartService.clear(user.sub);
  }
}
