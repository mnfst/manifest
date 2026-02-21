import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelPricing } from '../entities/model-pricing.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';

interface OpenRouterModel {
  id: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

interface ModelMapping {
  canonical: string;
  provider: string;
}

// Map OpenRouter model IDs to our canonical model names + provider
const MODEL_MAP: Record<string, ModelMapping> = {
  // Anthropic
  'anthropic/claude-opus-4': { canonical: 'claude-opus-4-6', provider: 'Anthropic' },
  'anthropic/claude-sonnet-4': { canonical: 'claude-sonnet-4-20250514', provider: 'Anthropic' },
  'anthropic/claude-sonnet-4.5': { canonical: 'claude-sonnet-4-5-20250929', provider: 'Anthropic' },
  'anthropic/claude-haiku-4.5': { canonical: 'claude-haiku-4-5-20251001', provider: 'Anthropic' },
  // OpenAI GPT
  'openai/gpt-4o': { canonical: 'gpt-4o', provider: 'OpenAI' },
  'openai/gpt-4o-mini': { canonical: 'gpt-4o-mini', provider: 'OpenAI' },
  'openai/gpt-4.1': { canonical: 'gpt-4.1', provider: 'OpenAI' },
  'openai/gpt-4.1-mini': { canonical: 'gpt-4.1-mini', provider: 'OpenAI' },
  'openai/gpt-4.1-nano': { canonical: 'gpt-4.1-nano', provider: 'OpenAI' },
  // OpenAI reasoning
  'openai/o3': { canonical: 'o3', provider: 'OpenAI' },
  'openai/o3-mini': { canonical: 'o3-mini', provider: 'OpenAI' },
  'openai/o4-mini': { canonical: 'o4-mini', provider: 'OpenAI' },
  // Google Gemini
  'google/gemini-2.5-pro': { canonical: 'gemini-2.5-pro', provider: 'Google' },
  'google/gemini-2.5-flash': { canonical: 'gemini-2.5-flash', provider: 'Google' },
  'google/gemini-2.5-flash-lite': { canonical: 'gemini-2.5-flash-lite', provider: 'Google' },
  'google/gemini-2.0-flash': { canonical: 'gemini-2.0-flash', provider: 'Google' },
  // DeepSeek
  'deepseek/deepseek-chat-v3-0324': { canonical: 'deepseek-v3', provider: 'DeepSeek' },
  'deepseek/deepseek-r1': { canonical: 'deepseek-r1', provider: 'DeepSeek' },
  // Moonshot (Kimi)
  'moonshotai/kimi-k2': { canonical: 'kimi-k2', provider: 'Moonshot' },
  // Alibaba (Qwen)
  'qwen/qwen-2.5-72b-instruct': { canonical: 'qwen-2.5-72b-instruct', provider: 'Alibaba' },
  'qwen/qwq-32b': { canonical: 'qwq-32b', provider: 'Alibaba' },
  'qwen/qwen-2.5-coder-32b-instruct': { canonical: 'qwen-2.5-coder-32b-instruct', provider: 'Alibaba' },
  // Mistral
  'mistralai/mistral-large': { canonical: 'mistral-large', provider: 'Mistral' },
  'mistralai/mistral-small': { canonical: 'mistral-small', provider: 'Mistral' },
  'mistralai/codestral': { canonical: 'codestral', provider: 'Mistral' },
  // Meta (Llama)
  'meta-llama/llama-4-maverick': { canonical: 'llama-4-maverick', provider: 'Meta' },
  'meta-llama/llama-4-scout': { canonical: 'llama-4-scout', provider: 'Meta' },
  // Cohere
  'cohere/command-r-plus': { canonical: 'command-r-plus', provider: 'Cohere' },
  'cohere/command-r': { canonical: 'command-r', provider: 'Cohere' },
};

const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

@Injectable()
export class PricingSyncService {
  private readonly logger = new Logger(PricingSyncService.name);

  constructor(
    @InjectRepository(ModelPricing)
    private readonly pricingRepo: Repository<ModelPricing>,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly moduleRef: ModuleRef,
  ) {}

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

    const updatedModels = new Set<string>();
    let updated = 0;
    for (const model of data) {
      const mapping = MODEL_MAP[model.id];
      if (!mapping) continue;

      const prompt = Number(model.pricing?.prompt ?? 0);
      const completion = Number(model.pricing?.completion ?? 0);
      if (prompt === 0 && completion === 0) continue;

      await this.pricingRepo.upsert(
        {
          model_name: mapping.canonical,
          provider: mapping.provider,
          input_price_per_token: prompt,
          output_price_per_token: completion,
        },
        ['model_name'],
      );
      updatedModels.add(mapping.canonical);
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
}
