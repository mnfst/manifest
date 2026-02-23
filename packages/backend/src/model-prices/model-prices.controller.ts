import { Controller, Get, Param, Post, UseInterceptors } from '@nestjs/common';
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

  @Post('model-prices/sync')
  async triggerSync() {
    return this.modelPricesService.triggerSync();
  }

  @Get('model-prices/unresolved')
  async getUnresolved() {
    return this.modelPricesService.getUnresolved();
  }

  @Get('model-prices/:modelName/history')
  async getHistory(@Param('modelName') modelName: string) {
    return this.modelPricesService.getHistory(modelName);
  }
}
