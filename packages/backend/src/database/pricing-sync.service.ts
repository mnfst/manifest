import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelPricing } from '../entities/model-pricing.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';

interface OpenRouterModel {
  id: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

// Map OpenRouter provider prefixes to our canonical provider names
const PROVIDER_PREFIXES: ReadonlyMap<string, string> = new Map([
  ['anthropic/', 'Anthropic'],
  ['openai/', 'OpenAI'],
  ['google/', 'Google'],
  ['deepseek/', 'DeepSeek'],
  ['mistralai/', 'Mistral'],
  ['x-ai/', 'xAI'],
  ['qwen/', 'Alibaba'],
  ['moonshotai/', 'Moonshot'],
  ['zhipuai/', 'Zhipu'],
  ['amazon/', 'Amazon'],
]);

// OpenRouter variant suffixes to skip (non-standard pricing / duplicates)
const VARIANT_SUFFIXES = [':free', ':extended', ':nitro'];

const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

@Injectable()
export class PricingSyncService implements OnModuleInit {
  private readonly logger = new Logger(PricingSyncService.name);

  constructor(
    @InjectRepository(ModelPricing)
    private readonly pricingRepo: Repository<ModelPricing>,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    // Fire-and-forget: sync prices from OpenRouter on startup to keep
    // the seeded models up-to-date (no new models are added).
    this.syncPricing().catch((err) => {
      this.logger.error(`Startup pricing sync failed: ${err}`);
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async syncPricing(): Promise<number> {
    this.logger.log('Starting daily model pricing sync from OpenRouter...');

    const modelsBefore = new Set(
      this.pricingCache.getAll().map((m) => m.model_name),
    );

    let data: OpenRouterModel[];
    try {
      const res = await fetch(OPENROUTER_API);
      if (!res.ok) {
        this.logger.error(`OpenRouter API returned ${res.status}`);
        return 0;
      }
      const body = (await res.json()) as OpenRouterResponse;
      data = body.data ?? [];
    } catch (err) {
      this.logger.error(`Failed to fetch OpenRouter models: ${err}`);
      return 0;
    }

    const existingModels = new Set(
      this.pricingCache.getAll().map((m) => m.model_name),
    );

    let updated = 0;
    for (const model of data) {
      const match = this.matchProvider(model.id);
      if (!match) continue;

      const prompt = Number(model.pricing?.prompt ?? 0);
      const completion = Number(model.pricing?.completion ?? 0);
      if (prompt === 0 && completion === 0) continue;

      const { canonical, provider } = match;

      // Only update prices for models we already have (seeded).
      // Never insert new models — keep the curated list small.
      if (!existingModels.has(canonical)) continue;

      // Use update (not upsert) to preserve capability flags and quality_score
      const updateFields: Partial<ModelPricing> = {
        input_price_per_token: prompt,
        output_price_per_token: completion,
        provider,
      };
      if (model.context_length) {
        updateFields.context_window = model.context_length;
      }
      await this.pricingRepo.update({ model_name: canonical }, updateFields);
      updated++;
    }

    this.logger.log(`Pricing sync complete: ${updated} models updated`);
    if (updated > 0) {
      await this.pricingCache.reload();
    }

    // Detect models that existed before but were not in this sync
    const modelsAfter = new Set(
      this.pricingCache.getAll().map((m) => m.model_name),
    );
    const removed = [...modelsBefore].filter((m) => !modelsAfter.has(m));

    if (removed.length > 0) {
      this.logger.warn(`Models removed after sync: ${removed.join(', ')}`);
      try {
        // Lazily resolve RoutingService to avoid circular module dependency
        const { RoutingService } = await import(
          '../routing/routing.service'
        );
        const routingService = this.moduleRef.get(RoutingService, {
          strict: false,
        });
        await routingService.invalidateOverridesForRemovedModels(removed);
      } catch (err) {
        this.logger.error(`Failed to invalidate overrides: ${err}`);
      }
    }

    return updated;
  }

  /** Match an OpenRouter model ID to a supported provider, returning canonical name + provider. */
  private matchProvider(
    modelId: string,
  ): { canonical: string; provider: string } | null {
    // Skip OpenRouter variant suffixes
    if (VARIANT_SUFFIXES.some((s) => modelId.endsWith(s))) return null;

    for (const [prefix, provider] of PROVIDER_PREFIXES) {
      if (modelId.startsWith(prefix)) {
        return { canonical: modelId.slice(prefix.length), provider };
      }
    }
    return null;
  }
}
