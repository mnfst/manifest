import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ModelPricing } from '../entities/model-pricing.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { PricingHistoryService } from './pricing-history.service';
import { UnresolvedModelTrackerService } from '../model-prices/unresolved-model-tracker.service';
import { sqlNow } from '../common/utils/sql-dialect';

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
};

const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

const FRESHNESS_HOURS = 12;

@Injectable()
export class PricingSyncService implements OnModuleInit {
  private readonly logger = new Logger(PricingSyncService.name);

  constructor(
    @InjectRepository(ModelPricing)
    private readonly pricingRepo: Repository<ModelPricing>,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly pricingHistory: PricingHistoryService,
    private readonly unresolvedTracker: UnresolvedModelTrackerService,
  ) {}

  async onModuleInit(): Promise<void> {
    const cutoff = new Date(Date.now() - FRESHNESS_HOURS * 3600_000);
    const recent = await this.pricingRepo.count({
      where: { updated_at: MoreThan(cutoff) },
    });
    if (recent > 0) {
      this.logger.log('Pricing data is fresh — skipping startup sync');
      return;
    }
    this.syncPricing().catch((err) => {
      this.logger.error(`Startup pricing sync failed: ${err}`);
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async syncPricing(): Promise<number> {
    this.logger.log('Starting daily model pricing sync from OpenRouter...');

    const data = await this.fetchOpenRouterModels();
    if (!data) return 0;

    const updated = await this.syncAllModels(data);
    await this.resolveUnresolvedModels(data);

    this.logger.log(`Pricing sync complete: ${updated} models updated`);
    if (updated > 0) {
      await this.pricingCache.reload();
    }
    return updated;
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

  private async syncAllModels(data: OpenRouterModel[]): Promise<number> {
    let updated = 0;
    let failed = 0;
    const now = new Date(sqlNow());

    for (const model of data) {
      try {
        const prompt = Number(model.pricing?.prompt ?? 0);
        const completion = Number(model.pricing?.completion ?? 0);
        if (prompt === 0 && completion === 0) continue;
        if (!Number.isFinite(prompt) || !Number.isFinite(completion)) {
          this.logger.warn(`Skipping ${model.id}: non-finite pricing`);
          failed++;
          continue;
        }

        const { canonical, provider } = this.deriveNames(model.id);
        const existing = await this.pricingRepo.findOneBy({
          model_name: canonical,
        });

        const incoming = {
          model_name: canonical,
          provider,
          input_price_per_token: prompt,
          output_price_per_token: completion,
        };

        await this.pricingHistory.recordChange(existing, incoming, 'sync');
        await this.pricingRepo.upsert(
          { ...incoming, updated_at: now },
          ['model_name'],
        );
        updated++;
      } catch (err) {
        failed++;
        this.logger.warn(
          `Failed to sync model ${model.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (failed > 0) {
      this.logger.warn(`Pricing sync: ${failed} models failed`);
    }
    return updated;
  }

  deriveNames(openRouterId: string): {
    canonical: string;
    provider: string;
  } {
    const slashIndex = openRouterId.indexOf('/');
    if (slashIndex === -1) {
      return { canonical: openRouterId, provider: 'Unknown' };
    }

    const prefix = openRouterId.substring(0, slashIndex);
    const canonical = openRouterId.substring(slashIndex + 1);
    const provider = PROVIDER_DISPLAY_NAMES[prefix] ?? this.titleCase(prefix);

    return { canonical, provider };
  }

  private titleCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private async resolveUnresolvedModels(
    data: OpenRouterModel[],
  ): Promise<void> {
    const unresolved = await this.unresolvedTracker.getUnresolved();
    if (unresolved.length === 0) return;

    const knownNames = new Set<string>();
    for (const model of data) {
      const { canonical } = this.deriveNames(model.id);
      knownNames.add(canonical);
    }

    for (const entry of unresolved) {
      const resolvedName = this.tryResolve(entry.model_name, knownNames);
      if (resolvedName) {
        await this.unresolvedTracker.markResolved(
          entry.model_name,
          resolvedName,
        );
      }
    }
  }

  private tryResolve(
    modelName: string,
    knownNames: Set<string>,
  ): string | null {
    if (knownNames.has(modelName)) return modelName;

    const stripped = this.stripPrefix(modelName);
    if (knownNames.has(stripped)) return stripped;

    const noDate = stripped.replace(/-\d{4}-\d{2}-\d{2}$/, '');
    if (noDate !== stripped && knownNames.has(noDate)) return noDate;

    return null;
  }

  private stripPrefix(name: string): string {
    const slashIndex = name.indexOf('/');
    return slashIndex === -1 ? name : name.substring(slashIndex + 1);
  }
}
