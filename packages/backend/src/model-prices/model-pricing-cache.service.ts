import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelPricing } from '../entities/model-pricing.entity';
import { buildAliasMap, resolveModelName } from './model-name-normalizer';

@Injectable()
export class ModelPricingCacheService implements OnModuleInit {
  private readonly logger = new Logger(ModelPricingCacheService.name);
  private readonly cache = new Map<string, ModelPricing>();
  private aliasMap = new Map<string, string>();

  constructor(
    @InjectRepository(ModelPricing)
    private readonly pricingRepo: Repository<ModelPricing>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    const rows = await this.pricingRepo.find();
    this.cache.clear();
    for (const row of rows) {
      this.cache.set(row.model_name, row);
    }
    this.aliasMap = buildAliasMap([...this.cache.keys()]);
    this.logger.log(`Loaded ${this.cache.size} model pricing entries`);
  }

  getByModel(modelName: string): ModelPricing | undefined {
    const exact = this.cache.get(modelName);
    if (exact) return exact;

    const resolved = resolveModelName(modelName, this.aliasMap);
    return resolved ? this.cache.get(resolved) : undefined;
  }
}
