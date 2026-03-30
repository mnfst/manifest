import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

export interface OpenRouterPricingEntry {
  input: number;
  output: number;
  contextWindow?: number;
  displayName?: string;
}

const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

@Injectable()
export class PricingSyncService implements OnModuleInit {
  private readonly logger = new Logger(PricingSyncService.name);
  private cache = new Map<string, OpenRouterPricingEntry>();
  private lastFetchedAt: Date | null = null;

  async onModuleInit(): Promise<void> {
    // Await startup fetch so ModelPricingCacheService.reload() has data
    try {
      await this.refreshCache();
    } catch (err) {
      this.logger.error(`Startup OpenRouter cache refresh failed: ${err}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async refreshCache(): Promise<number> {
    this.logger.log('Refreshing OpenRouter pricing cache...');
    const data = await this.fetchOpenRouterModels();
    if (!data) return 0;

    const newCache = new Map<string, OpenRouterPricingEntry>();
    let count = 0;

    for (const model of data) {
      if (!this.isChatCompatible(model)) continue;
      if (!model.pricing) continue;

      const prompt = Number(model.pricing.prompt ?? 0);
      const completion = Number(model.pricing.completion ?? 0);
      if (!Number.isFinite(prompt) || !Number.isFinite(completion)) continue;
      if (prompt < 0 || completion < 0) continue;

      const displayName = this.extractDisplayName(model);
      const entry: OpenRouterPricingEntry = {
        input: prompt,
        output: completion,
        contextWindow: model.context_length ?? undefined,
        displayName: displayName || undefined,
      };

      // Store under full OpenRouter ID only (e.g. "anthropic/claude-opus-4-6")
      // All OpenRouter models are stored under provider "OpenRouter".
      newCache.set(model.id, entry);
      count++;
    }

    this.cache = newCache;
    this.lastFetchedAt = new Date();
    this.logger.log(`OpenRouter pricing cache loaded: ${count} models`);

    return count;
  }

  lookupPricing(modelId: string): OpenRouterPricingEntry | null {
    return this.cache.get(modelId) ?? null;
  }

  getAll(): ReadonlyMap<string, OpenRouterPricingEntry> {
    return this.cache;
  }

  getLastFetchedAt(): Date | null {
    return this.lastFetchedAt;
  }

  private async fetchOpenRouterModels(): Promise<OpenRouterModel[] | null> {
    try {
      const res = await fetch(OPENROUTER_API);
      if (!res.ok) {
        this.logger.error(`OpenRouter API returned ${res.status}`);
        return null;
      }
      const body = (await res.json()) as OpenRouterResponse;
      return body.data ?? [];
    } catch (err) {
      this.logger.error(`Failed to fetch OpenRouter models: ${err}`);
      return null;
    }
  }

  extractDisplayName(model: OpenRouterModel): string {
    if (!model.name) return '';
    const colonIdx = model.name.indexOf(': ');
    if (colonIdx !== -1) return model.name.substring(colonIdx + 2);
    return model.name;
  }

  /**
   * Filter to models that accept text input and can produce text output.
   * Uses "includes text" (not "text-only") so multimodal models that
   * also produce text (e.g. GPT-4o) pass through.
   */
  isChatCompatible(model: OpenRouterModel): boolean {
    const inputModalities = model.architecture?.input_modalities?.map((m) => m.toLowerCase());
    if (inputModalities && inputModalities.length > 0 && !inputModalities.includes('text')) {
      return false;
    }

    const outputModalities = model.architecture?.output_modalities?.map((m) => m.toLowerCase());
    if (outputModalities && outputModalities.length > 0) {
      return outputModalities.includes('text');
    }

    return true;
  }
}
