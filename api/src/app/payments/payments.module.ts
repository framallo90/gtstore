import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { OrdersModule } from '../orders/orders.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MercadoPagoController } from './mercadopago.controller';
import { MercadoPagoService } from './mercadopago.service';

@Module({
  imports: [PrismaModule, OrdersModule, EmailModule],
  controllers: [MercadoPagoController],
  providers: [MercadoPagoService],
})
export class PaymentsModule {}

