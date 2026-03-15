import { Module } from '@nestjs/common';
import { ModelPricesController } from './model-prices.controller';
import { ModelPricesService } from './model-prices.service';
import { ModelPricingCacheService } from './model-pricing-cache.service';
import { PricingSyncService } from '../database/pricing-sync.service';

@Module({
  controllers: [ModelPricesController],
  providers: [ModelPricesService, ModelPricingCacheService, PricingSyncService],
  exports: [ModelPricingCacheService, PricingSyncService],
})
export class ModelPricesModule {}
