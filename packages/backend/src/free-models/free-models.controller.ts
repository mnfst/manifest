import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { FreeModelsService } from './free-models.service';
import { FREE_MODELS_CACHE_TTL_MS } from '../common/constants/cache.constants';

@Controller('api/v1')
export class FreeModelsController {
  constructor(private readonly freeModelsService: FreeModelsService) {}

  @Get('free-models')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(FREE_MODELS_CACHE_TTL_MS)
  getFreeModels() {
    return this.freeModelsService.getAll();
  }
}
