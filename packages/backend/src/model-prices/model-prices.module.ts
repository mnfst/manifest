import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelPricing } from '../entities/model-pricing.entity';
import { ModelPricingHistory } from '../entities/model-pricing-history.entity';
import { UnresolvedModel } from '../entities/unresolved-model.entity';
import { ModelPricesController } from './model-prices.controller';
import { ModelPricesService } from './model-prices.service';
import { ModelPricingCacheService } from './model-pricing-cache.service';
import { UnresolvedModelTrackerService } from './unresolved-model-tracker.service';
import { PricingHistoryService } from '../database/pricing-history.service';
import { PricingSyncService } from '../database/pricing-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModelPricing, ModelPricingHistory, UnresolvedModel]),
  ],
  controllers: [ModelPricesController],
  providers: [
    ModelPricesService,
    ModelPricingCacheService,
    UnresolvedModelTrackerService,
    PricingHistoryService,
    PricingSyncService,
  ],
  exports: [
    ModelPricingCacheService,
    UnresolvedModelTrackerService,
    PricingHistoryService,
    PricingSyncService,
  ],
})
export class ModelPricesModule {}
