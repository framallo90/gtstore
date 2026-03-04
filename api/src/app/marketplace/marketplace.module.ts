import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AndreaniShippingService } from '../orders/andreani-shipping.service';
import { MercadoPagoService } from '../payments/mercadopago.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketplaceAdminController } from './marketplace-admin.controller';
import { MarketplaceAdminService } from './marketplace-admin.service';
import { MarketplaceOrdersController } from './marketplace-orders.controller';
import { MarketplaceOrdersService } from './marketplace-orders.service';
import { MarketplacePublicController } from './marketplace-public.controller';
import { MarketplacePublicService } from './marketplace-public.service';
import { SellerListingsController } from './seller-listings.controller';
import { SellerListingsService } from './seller-listings.service';
import { SellerVerificationController } from './seller-verification.controller';
import { SellerVerificationService } from './seller-verification.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [
    MarketplacePublicController,
    MarketplaceOrdersController,
    SellerVerificationController,
    SellerListingsController,
    MarketplaceAdminController,
  ],
  providers: [
    MarketplacePublicService,
    MarketplaceOrdersService,
    SellerVerificationService,
    SellerListingsService,
    MarketplaceAdminService,
    AndreaniShippingService,
    MercadoPagoService,
  ],
})
export class MarketplaceModule {}
