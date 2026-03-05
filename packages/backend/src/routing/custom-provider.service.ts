import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { CustomProvider } from '../entities/custom-provider.entity';
import { ModelPricing } from '../entities/model-pricing.entity';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { RoutingService } from './routing.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { CreateCustomProviderDto, UpdateCustomProviderDto } from './dto/custom-provider.dto';
import { computeQualityScore } from '../database/quality-score.util';

@Injectable()
export class CustomProviderService {
  constructor(
    @InjectRepository(CustomProvider)
    private readonly repo: Repository<CustomProvider>,
    @InjectRepository(ModelPricing)
    private readonly pricingRepo: Repository<ModelPricing>,
    private readonly routingService: RoutingService,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly autoAssign: TierAutoAssignService,
  ) {}

  /** Provider key used in UserProvider and ModelPricing tables. */
  static providerKey(id: string): string {
    return `custom:${id}`;
  }

  /** Unique model name for ModelPricing table. */
  static modelKey(id: string, modelName: string): string {
    return `custom:${id}/${modelName}`;
  }

  /** Strip the custom prefix to get the raw model name for upstream API. */
  static rawModelName(prefixedName: string): string {
    const slash = prefixedName.indexOf('/');
    return slash !== -1 ? prefixedName.substring(slash + 1) : prefixedName;
  }

  /** Check if a provider key is a custom provider. */
  static isCustom(provider: string): boolean {
    return provider.startsWith('custom:');
  }

  /** Extract the custom provider UUID from a provider key. */
  static extractId(providerKey: string): string {
    return providerKey.replace('custom:', '');
  }

  async list(agentId: string): Promise<CustomProvider[]> {
    return this.repo.find({ where: { agent_id: agentId } });
  }

  async create(
    agentId: string,
    userId: string,
    dto: CreateCustomProviderDto,
  ): Promise<CustomProvider> {
    // Check name uniqueness per agent
    const existing = await this.repo.findOne({
      where: { agent_id: agentId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Custom provider "${dto.name}" already exists for this agent`);
    }

    const id = randomUUID();
    const provKey = CustomProviderService.providerKey(id);

    // Create CustomProvider row
    const cp = Object.assign(new CustomProvider(), {
      id,
      agent_id: agentId,
      user_id: userId,
      name: dto.name,
      base_url: dto.base_url,
      models: dto.models.map((m) => ({
        model_name: m.model_name,
        input_price_per_million_tokens: m.input_price_per_million_tokens,
        output_price_per_million_tokens: m.output_price_per_million_tokens,
        context_window: m.context_window ?? 128000,
      })),
      created_at: new Date().toISOString(),
    });
    await this.repo.insert(cp);

    await this.syncPricingRows(provKey, id, cp.models);
    await this.pricingCache.reload();

    // Create UserProvider + trigger tier recalculation
    await this.routingService.upsertProvider(agentId, userId, provKey, dto.apiKey);

    return cp;
  }

  async update(
    agentId: string,
    id: string,
    userId: string,
    dto: UpdateCustomProviderDto,
  ): Promise<CustomProvider> {
    const cp = await this.repo.findOne({ where: { id, agent_id: agentId } });
    if (!cp) {
      throw new NotFoundException('Custom provider not found');
    }

    // Check name uniqueness (excluding self)
    if (dto.name !== undefined && dto.name !== cp.name) {
      const dup = await this.repo.findOne({
        where: { agent_id: agentId, name: dto.name },
      });
      if (dup) {
        throw new ConflictException(`Custom provider "${dto.name}" already exists for this agent`);
      }
      cp.name = dto.name;
    }

    if (dto.base_url !== undefined) {
      cp.base_url = dto.base_url;
    }

    const provKey = CustomProviderService.providerKey(id);

    // Sync models: full replacement
    if (dto.models !== undefined) {
      await this.pricingRepo
        .createQueryBuilder()
        .delete()
        .where('provider = :provider', { provider: provKey })
        .execute();

      cp.models = dto.models.map((m) => ({
        model_name: m.model_name,
        input_price_per_million_tokens: m.input_price_per_million_tokens,
        output_price_per_million_tokens: m.output_price_per_million_tokens,
        context_window: m.context_window ?? 128000,
      }));

      await this.syncPricingRows(provKey, id, cp.models);
    }

    await this.pricingCache.reload();

    // Update API key if explicitly provided
    if ('apiKey' in dto) {
      await this.routingService.upsertProvider(agentId, userId, provKey, dto.apiKey);
    }

    // Recalculate tiers when models changed (even without API key change)
    if (dto.models !== undefined && !('apiKey' in dto)) {
      await this.autoAssign.recalculate(agentId);
    }

    await this.repo.save(cp);

    return cp;
  }

  async remove(agentId: string, id: string): Promise<void> {
    const cp = await this.repo.findOne({ where: { id, agent_id: agentId } });
    if (!cp) {
      throw new NotFoundException('Custom provider not found');
    }

    const provKey = CustomProviderService.providerKey(id);

    // Remove UserProvider + tier overrides
    try {
      await this.routingService.removeProvider(agentId, provKey);
    } catch {
      // Provider may not exist if creation partially failed
    }

    // Delete model_pricing rows
    await this.pricingRepo
      .createQueryBuilder()
      .delete()
      .where('provider = :provider', { provider: provKey })
      .execute();

    // Reload pricing cache
    await this.pricingCache.reload();

    // Delete CustomProvider row
    await this.repo.remove(cp);
  }

  private async syncPricingRows(
    provKey: string,
    cpId: string,
    models: {
      model_name: string;
      input_price_per_million_tokens?: number;
      output_price_per_million_tokens?: number;
      context_window?: number;
    }[],
  ): Promise<void> {
    for (const model of models) {
      const modelKey = CustomProviderService.modelKey(cpId, model.model_name);
      const inputPerToken =
        model.input_price_per_million_tokens != null
          ? model.input_price_per_million_tokens / 1_000_000
          : null;
      const outputPerToken =
        model.output_price_per_million_tokens != null
          ? model.output_price_per_million_tokens / 1_000_000
          : null;

      const pricingRow = Object.assign(new ModelPricing(), {
        model_name: modelKey,
        provider: provKey,
        input_price_per_token: inputPerToken,
        output_price_per_token: outputPerToken,
        context_window: model.context_window ?? 128000,
        capability_reasoning: false,
        capability_code: false,
        quality_score: 1,
      });
      pricingRow.quality_score = computeQualityScore(pricingRow);
      await this.pricingRepo.save(pricingRow);
    }
  }

  async getById(id: string): Promise<CustomProvider | null> {
    return this.repo.findOne({ where: { id } });
  }
}
