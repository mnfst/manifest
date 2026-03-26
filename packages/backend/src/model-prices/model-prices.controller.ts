import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ModelPricesService } from './model-prices.service';
import { MODEL_PRICES_CACHE_TTL_MS } from '../common/constants/cache.constants';

@Controller('api/v1')
export class ModelPricesController {
  constructor(private readonly modelPricesService: ModelPricesService) {}

  @Get('model-prices')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(MODEL_PRICES_CACHE_TTL_MS)
  async getModelPrices() {
    return this.modelPricesService.getAll();
  }
}
