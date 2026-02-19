import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelPricing } from '../entities/model-pricing.entity';
import { ModelPricesController } from './model-prices.controller';
import { ModelPricesService } from './model-prices.service';
import { ModelPricingCacheService } from './model-pricing-cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([ModelPricing])],
  controllers: [ModelPricesController],
  providers: [ModelPricesService, ModelPricingCacheService],
  exports: [ModelPricingCacheService],
})
export class ModelPricesModule {}
