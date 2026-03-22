import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelPricesController } from './model-prices.controller';
import { ModelPricesService } from './model-prices.service';
import { ModelPricingCacheService } from './model-pricing-cache.service';
import { PricingSyncService } from '../database/pricing-sync.service';
import { ProviderModelRegistryService } from '../routing/model-discovery/provider-model-registry.service';
import { UserProvider } from '../entities/user-provider.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserProvider])],
  controllers: [ModelPricesController],
  providers: [
    ModelPricesService,
    ModelPricingCacheService,
    PricingSyncService,
    ProviderModelRegistryService,
  ],
  exports: [ModelPricingCacheService, PricingSyncService, ProviderModelRegistryService],
})
export class ModelPricesModule {}
