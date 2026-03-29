import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface ModelsDevPricingEntry {
  /** Price per token (converted from per-million). */
  input: number;
  /** Price per token (converted from per-million). */
  output: number;
  contextWindow?: number;
  displayName?: string;
  reasoning?: boolean;
}

interface ModelsDevModel {
  id: string;
  name?: string;
  reasoning?: boolean;
  cost?: { input?: number; output?: number };
  limit?: { context?: number; output?: number };
}

interface ModelsDevProvider {
  id: string;
  models?: Record<string, ModelsDevModel>;
}

const MODELS_DEV_API = 'https://models.dev/api.json';

/** Providers to process from models.dev (extend as needed). */
const SUPPORTED_PROVIDERS = ['google'];

@Injectable()
export class ModelsDevSyncService implements OnModuleInit {
  private readonly logger = new Logger(ModelsDevSyncService.name);
  private cache = new Map<string, ModelsDevPricingEntry>();

  async onModuleInit(): Promise<void> {
    try {
      await this.refreshCache();
    } catch (err) {
      this.logger.error(`Startup models.dev cache refresh failed: ${err}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async refreshCache(): Promise<number> {
    this.logger.log('Refreshing models.dev pricing cache...');
    const data = await this.fetchModelsDevData();
    if (!data) return 0;

    const newCache = new Map<string, ModelsDevPricingEntry>();
    let count = 0;

    for (const providerId of SUPPORTED_PROVIDERS) {
      const provider = data[providerId] as ModelsDevProvider | undefined;
      if (!provider?.models) continue;

      for (const [modelId, model] of Object.entries(provider.models)) {
        if (!model.cost) continue;

        const inputPerMillion = Number(model.cost.input ?? 0);
        const outputPerMillion = Number(model.cost.output ?? 0);
        if (!Number.isFinite(inputPerMillion) || !Number.isFinite(outputPerMillion)) continue;
        if (inputPerMillion < 0 || outputPerMillion < 0) continue;

        const entry: ModelsDevPricingEntry = {
          input: inputPerMillion / 1_000_000,
          output: outputPerMillion / 1_000_000,
          contextWindow: model.limit?.context ?? undefined,
          displayName: model.name || undefined,
          reasoning: model.reasoning ?? undefined,
        };

        newCache.set(modelId, entry);
        count++;
      }
    }

    this.cache = newCache;
    this.logger.log(`models.dev pricing cache loaded: ${count} models`);
    return count;
  }

  lookupPricing(modelId: string): ModelsDevPricingEntry | null {
    return this.cache.get(modelId) ?? null;
  }

  private async fetchModelsDevData(): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(MODELS_DEV_API);
      if (!res.ok) {
        this.logger.error(`models.dev API returned ${res.status}`);
        return null;
      }
      const body = await res.json();
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        this.logger.error('models.dev API returned unexpected format');
        return null;
      }
      return body as Record<string, unknown>;
    } catch (err) {
      this.logger.error(`Failed to fetch models.dev data: ${err}`);
      return null;
    }
  }
}
