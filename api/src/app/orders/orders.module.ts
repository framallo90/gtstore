import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import { OrdersController } from './orders.controller';
import { OrdersPublicController } from './orders-public.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [EmailModule, AuditModule],
  controllers: [OrdersController, OrdersPublicController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
