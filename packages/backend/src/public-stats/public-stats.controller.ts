import { Controller, Get, Logger } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PUBLIC_STATS_CACHE_TTL_MS } from '../common/constants/cache.constants';
import { PublicStatsService, TopModel, FreeModel } from './public-stats.service';

interface StatsResponse {
  total_messages: number;
  top_models: TopModel[];
  cached_at: string;
}

interface CatalogResponse {
  models: FreeModel[];
  total_models: number;
  cached_at: string;
}

let cachedStats: StatsResponse | null = null;
let statsTimestamp = 0;
let statsInflight: Promise<StatsResponse> | null = null;

let cachedCatalog: CatalogResponse | null = null;
let catalogTimestamp = 0;
let catalogInflight: Promise<CatalogResponse> | null = null;

@Controller('api/v1')
export class PublicStatsController {
  private readonly logger = new Logger(PublicStatsController.name);

  constructor(private readonly service: PublicStatsService) {}

  @Public()
  @Get('public-stats')
  async getStats(): Promise<StatsResponse> {
    if (cachedStats && Date.now() - statsTimestamp < PUBLIC_STATS_CACHE_TTL_MS) {
      return cachedStats;
    }

    if (!statsInflight) {
      statsInflight = this.refreshStats().finally(() => {
        statsInflight = null;
      });
    }

    return statsInflight;
  }

  @Public()
  @Get('public-stats/models')
  async getModelCatalog(): Promise<CatalogResponse> {
    if (cachedCatalog && Date.now() - catalogTimestamp < PUBLIC_STATS_CACHE_TTL_MS) {
      return cachedCatalog;
    }

    if (!catalogInflight) {
      catalogInflight = this.refreshCatalog().finally(() => {
        catalogInflight = null;
      });
    }

    return catalogInflight;
  }

  private async refreshStats(): Promise<StatsResponse> {
    try {
      const stats = await this.service.getUsageStats();
      cachedStats = {
        total_messages: stats.total_messages,
        top_models: stats.top_models,
        cached_at: new Date().toISOString(),
      };
      statsTimestamp = Date.now();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to fetch usage stats: ${msg}`);
    }

    return (
      cachedStats ?? { total_messages: 0, top_models: [], cached_at: new Date().toISOString() }
    );
  }

  private async refreshCatalog(): Promise<CatalogResponse> {
    try {
      const stats = await this.service.getUsageStats();
      const models = this.service.getFreeModels(stats.token_map);
      cachedCatalog = {
        models,
        total_models: models.length,
        cached_at: new Date().toISOString(),
      };
      catalogTimestamp = Date.now();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to fetch model catalog: ${msg}`);
    }

    return cachedCatalog ?? { models: [], total_models: 0, cached_at: new Date().toISOString() };
  }
}
