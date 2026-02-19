import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateGuestOrderDto } from './dto/create-guest-order.dto';
import { GuestQuoteDto } from './dto/guest-quote.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersPublicController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('guest/quote')
  quoteGuest(@Body() dto: GuestQuoteDto) {
    return this.ordersService.quoteGuest(dto);
  }

  @Post('guest/checkout')
  checkoutGuest(
    @Body() dto: CreateGuestOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.createGuestOrder(dto, { idempotencyKey });
  }
}
