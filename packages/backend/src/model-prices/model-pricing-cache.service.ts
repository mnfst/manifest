import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { buildAliasMap, resolveModelName } from './model-name-normalizer';
import { PricingSyncService, OpenRouterPricingEntry } from '../database/pricing-sync.service';
import { MANUAL_PRICING } from '../routing/model-discovery/manual-pricing-reference';

/**
 * Lightweight pricing entry used for cost calculation and provider detection.
 * No longer backed by a database table — reads from OpenRouter cache + manual ref.
 */
export interface PricingEntry {
  model_name: string;
  provider: string;
  input_price_per_token: number | null;
  output_price_per_token: number | null;
}

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  deepseek: 'DeepSeek',
  mistralai: 'Mistral',
  moonshotai: 'Moonshot',
  qwen: 'Alibaba',
  zhipuai: 'Zhipu',
  amazon: 'Amazon',
  'meta-llama': 'Meta',
  cohere: 'Cohere',
  xai: 'xAI',
  minimax: 'MiniMax',
  'z-ai': 'Z.ai',
  openrouter: 'OpenRouter',
};

@Injectable()
export class ModelPricingCacheService implements OnModuleInit {
  private readonly logger = new Logger(ModelPricingCacheService.name);
  private readonly cache = new Map<string, PricingEntry>();
  private aliasMap = new Map<string, string>();

  constructor(private readonly pricingSync: PricingSyncService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.cache.clear();

    // Load from OpenRouter cache
    const orCache = this.pricingSync.getAll();
    for (const [name, entry] of orCache) {
      const provider = this.inferProvider(name);
      this.cache.set(name, {
        model_name: name,
        provider,
        input_price_per_token: entry.input,
        output_price_per_token: entry.output,
      });
    }

    // Load from manual pricing reference
    for (const [name, pricing] of MANUAL_PRICING) {
      if (!this.cache.has(name)) {
        this.cache.set(name, {
          model_name: name,
          provider: pricing.provider,
          input_price_per_token: pricing.input,
          output_price_per_token: pricing.output,
        });
      }
    }

    this.aliasMap = buildAliasMap([...this.cache.keys()]);
    this.logger.log(`Loaded ${this.cache.size} pricing entries`);
  }

  getByModel(modelName: string): PricingEntry | undefined {
    const exact = this.cache.get(modelName);
    if (exact) return exact;

    const resolved = resolveModelName(modelName, this.aliasMap);
    if (resolved) return this.cache.get(resolved);

    return undefined;
  }

  getAll(): PricingEntry[] {
    return [...this.cache.values()];
  }

  private inferProvider(modelName: string): string {
    const slashIdx = modelName.indexOf('/');
    if (slashIdx > 0) {
      const prefix = modelName.substring(0, slashIdx);
      return PROVIDER_DISPLAY_NAMES[prefix] ?? prefix;
    }
    return 'Unknown';
  }
}
