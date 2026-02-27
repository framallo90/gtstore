import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import { AndreaniShippingService } from './andreani-shipping.service';
import { OrdersController } from './orders.controller';
import { OrdersPublicController } from './orders-public.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [EmailModule, AuditModule],
  controllers: [OrdersController, OrdersPublicController],
  providers: [OrdersService, AndreaniShippingService],
  exports: [OrdersService],
})
export class OrdersModule {}
