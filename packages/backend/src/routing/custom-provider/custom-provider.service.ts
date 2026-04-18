import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { ProviderService } from '../routing-core/provider.service';
import { RoutingCacheService } from '../routing-core/routing-cache.service';
import { TierAutoAssignService } from '../routing-core/tier-auto-assign.service';
import { CreateCustomProviderDto, UpdateCustomProviderDto } from '../dto/custom-provider.dto';
import { validatePublicUrl } from '../../common/utils/url-validation';

@Injectable()
export class CustomProviderService {
  constructor(
    @InjectRepository(CustomProvider)
    private readonly repo: Repository<CustomProvider>,
    private readonly providerService: ProviderService,
    private readonly routingCache: RoutingCacheService,
    private readonly autoAssign: TierAutoAssignService,
  ) {}

  /** Provider key used in UserProvider tables. */
  static providerKey(id: string): string {
    return `custom:${id}`;
  }

  /** Unique model name for model lookups. */
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
    const cached = this.routingCache.getCustomProviders(agentId);
    if (cached) return cached;

    const result = await this.repo.find({ where: { agent_id: agentId } });
    this.routingCache.setCustomProviders(agentId, result);
    return result;
  }

  async create(
    agentId: string,
    userId: string,
    dto: CreateCustomProviderDto,
  ): Promise<CustomProvider> {
    const existing = await this.repo.findOne({
      where: { agent_id: agentId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Custom provider "${dto.name}" already exists for this agent`);
    }

    try {
      await validatePublicUrl(dto.base_url);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const id = randomUUID();
    const provKey = CustomProviderService.providerKey(id);

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
        capability_reasoning: m.capability_reasoning,
        capability_code: m.capability_code,
      })),
      created_at: new Date().toISOString(),
    });
    await this.repo.insert(cp);

    // Create UserProvider + trigger tier recalculation
    await this.providerService.upsertProvider(agentId, userId, provKey, dto.apiKey);

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
      try {
        await validatePublicUrl(dto.base_url);
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
      cp.base_url = dto.base_url;
    }

    if (dto.models !== undefined) {
      cp.models = dto.models.map((m) => ({
        model_name: m.model_name,
        input_price_per_million_tokens: m.input_price_per_million_tokens,
        output_price_per_million_tokens: m.output_price_per_million_tokens,
        context_window: m.context_window ?? 128000,
        capability_reasoning: m.capability_reasoning,
        capability_code: m.capability_code,
      }));
    }

    // Update API key if explicitly provided
    if ('apiKey' in dto) {
      await this.providerService.upsertProvider(
        agentId,
        userId,
        CustomProviderService.providerKey(id),
        dto.apiKey,
      );
    }

    // Recalculate tiers when models changed (even without API key change)
    if (dto.models !== undefined && !('apiKey' in dto)) {
      await this.autoAssign.recalculate(agentId);
    }

    await this.repo.save(cp);
    this.routingCache.invalidateAgent(agentId);

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
      await this.providerService.removeProvider(agentId, provKey);
    } catch {
      // Provider may not exist if creation partially failed
    }

    // Delete CustomProvider row
    await this.repo.remove(cp);
  }

  async getById(id: string): Promise<CustomProvider | null> {
    return this.repo.findOne({ where: { id } });
  }
}
