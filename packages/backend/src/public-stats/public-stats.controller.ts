import { Controller, Get, Logger } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PUBLIC_STATS_CACHE_TTL_MS } from '../common/constants/cache.constants';
import {
  PublicStatsService,
  TopModel,
  FreeModel,
  ProviderDailyTokens,
} from './public-stats.service';
import {
  FreeModelsService,
  FreeProviderDto,
} from '../free-models/free-models.service';

interface UsageResponse {
  total_messages: number;
  top_models: TopModel[];
  cached_at: string;
}

interface FreeModelsResponse {
  models: FreeModel[];
  total_models: number;
  cached_at: string;
}

interface ProviderTokensResponse {
  providers: ProviderDailyTokens[];
  cached_at: string;
}

interface FreeProvidersResponse {
  providers: FreeProviderDto[];
  last_synced_at: string | null;
  cached_at: string;
}

let cachedUsage: UsageResponse | null = null;
let usageTimestamp = 0;
let usageInflight: Promise<UsageResponse> | null = null;

let cachedFree: FreeModelsResponse | null = null;
let freeTimestamp = 0;
let freeInflight: Promise<FreeModelsResponse> | null = null;

let cachedProviderTokens: ProviderTokensResponse | null = null;
let providerTokensTimestamp = 0;
let providerTokensInflight: Promise<ProviderTokensResponse> | null = null;

let cachedFreeProviders: FreeProvidersResponse | null = null;
let freeProvidersTimestamp = 0;

@Controller('api/v1/public')
export class PublicStatsController {
  private readonly logger = new Logger(PublicStatsController.name);

  constructor(
    private readonly service: PublicStatsService,
    private readonly freeModelsService: FreeModelsService,
  ) {}

  @Public()
  @Get('usage')
  async getUsage(): Promise<UsageResponse> {
    if (cachedUsage && Date.now() - usageTimestamp < PUBLIC_STATS_CACHE_TTL_MS) {
      return cachedUsage;
    }

    if (!usageInflight) {
      usageInflight = this.refreshUsage().finally(() => {
        usageInflight = null;
      });
    }

    return usageInflight;
  }

  @Public()
  @Get('free-models')
  async getFreeModels(): Promise<FreeModelsResponse> {
    if (cachedFree && Date.now() - freeTimestamp < PUBLIC_STATS_CACHE_TTL_MS) {
      return cachedFree;
    }

    if (!freeInflight) {
      freeInflight = this.refreshFreeModels().finally(() => {
        freeInflight = null;
      });
    }

    return freeInflight;
  }

  @Public()
  @Get('provider-tokens')
  async getProviderTokens(): Promise<ProviderTokensResponse> {
    if (cachedProviderTokens && Date.now() - providerTokensTimestamp < PUBLIC_STATS_CACHE_TTL_MS) {
      return cachedProviderTokens;
    }

    if (!providerTokensInflight) {
      providerTokensInflight = this.refreshProviderTokens().finally(() => {
        providerTokensInflight = null;
      });
    }

    return providerTokensInflight;
  }

  @Public()
  @Get('free-providers')
  getFreeProviders(): FreeProvidersResponse {
    if (cachedFreeProviders && Date.now() - freeProvidersTimestamp < PUBLIC_STATS_CACHE_TTL_MS) {
      return cachedFreeProviders;
    }

    const data = this.freeModelsService.getAll();
    cachedFreeProviders = {
      providers: data.providers,
      last_synced_at: data.last_synced_at,
      cached_at: new Date().toISOString(),
    };
    freeProvidersTimestamp = Date.now();
    return cachedFreeProviders;
  }

  private async refreshUsage(): Promise<UsageResponse> {
    try {
      const stats = await this.service.getUsageStats();
      cachedUsage = {
        total_messages: stats.total_messages,
        top_models: stats.top_models,
        cached_at: new Date().toISOString(),
      };
      usageTimestamp = Date.now();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to fetch usage stats: ${msg}`);
    }

    return (
      cachedUsage ?? { total_messages: 0, top_models: [], cached_at: new Date().toISOString() }
    );
  }

  private async refreshFreeModels(): Promise<FreeModelsResponse> {
    try {
      const stats = await this.service.getUsageStats();
      const models = this.service.getFreeModels(stats.token_map);
      cachedFree = {
        models,
        total_models: models.length,
        cached_at: new Date().toISOString(),
      };
      freeTimestamp = Date.now();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to fetch free models: ${msg}`);
    }

    return cachedFree ?? { models: [], total_models: 0, cached_at: new Date().toISOString() };
  }

  private async refreshProviderTokens(): Promise<ProviderTokensResponse> {
    try {
      const providers = await this.service.getProviderDailyTokens();
      cachedProviderTokens = {
        providers,
        cached_at: new Date().toISOString(),
      };
      providerTokensTimestamp = Date.now();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to fetch provider tokens: ${msg}`);
    }

    return cachedProviderTokens ?? { providers: [], cached_at: new Date().toISOString() };
  }
}
