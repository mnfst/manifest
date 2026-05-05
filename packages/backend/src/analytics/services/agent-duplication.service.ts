import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Agent } from '../../entities/agent.entity';
import { AgentApiKey } from '../../entities/agent-api-key.entity';
import { UserProvider } from '../../entities/user-provider.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';
import { hashKey, keyPrefix } from '../../common/utils/hash.util';
import { encrypt, getEncryptionSecret } from '../../common/utils/crypto.util';
import { sqlNow } from '../../common/utils/postgres-sql';
import { API_KEY_PREFIX } from '../../common/constants/api-key.constants';
import { RoutingCacheService } from '../../routing/routing-core/routing-cache.service';

export interface DuplicateAgentSummary {
  providers: number;
  customProviders: number;
  tierAssignments: number;
  specificityAssignments: number;
}

export interface DuplicateAgentResult {
  agentId: string;
  agentName: string;
  displayName: string;
  apiKey: string;
  copied: DuplicateAgentSummary;
}

@Injectable()
export class AgentDuplicationService {
  constructor(
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    private readonly dataSource: DataSource,
    private readonly routingCache: RoutingCacheService,
  ) {}

  private static readonly CUSTOM_PREFIX = 'custom:';

  private generateOtlpKey(): string {
    return API_KEY_PREFIX + randomBytes(32).toString('base64url');
  }

  private remapCustomProviderRef(provider: string, idMap: Map<string, string>): string {
    if (!provider.startsWith(AgentDuplicationService.CUSTOM_PREFIX)) return provider;
    const oldId = provider.slice(AgentDuplicationService.CUSTOM_PREFIX.length);
    const newId = idMap.get(oldId);
    return newId ? `${AgentDuplicationService.CUSTOM_PREFIX}${newId}` : provider;
  }

  private async findOwnedAgent(userId: string, agentName: string): Promise<Agent | null> {
    return this.agentRepo
      .createQueryBuilder('a')
      .leftJoin('a.tenant', 't')
      .where('t.name = :userId', { userId })
      .andWhere('a.name = :agentName', { agentName })
      .andWhere('a.deleted_at IS NULL')
      .getOne();
  }

  async getCopySummary(userId: string, sourceName: string): Promise<DuplicateAgentSummary> {
    const source = await this.findOwnedAgent(userId, sourceName);
    if (!source) throw new NotFoundException(`Agent "${sourceName}" not found`);

    const [providers, customProviders, tierAssignments, specificityAssignments] = await Promise.all(
      [
        this.dataSource.getRepository(UserProvider).count({ where: { agent_id: source.id } }),
        this.dataSource.getRepository(CustomProvider).count({ where: { agent_id: source.id } }),
        this.dataSource.getRepository(TierAssignment).count({ where: { agent_id: source.id } }),
        this.dataSource
          .getRepository(SpecificityAssignment)
          .count({ where: { agent_id: source.id } }),
      ],
    );

    return { providers, customProviders, tierAssignments, specificityAssignments };
  }

  async suggestName(userId: string, sourceName: string): Promise<string> {
    const source = await this.findOwnedAgent(userId, sourceName);
    if (!source) throw new NotFoundException(`Agent "${sourceName}" not found`);

    const existingNames = await this.agentRepo
      .createQueryBuilder('a')
      .leftJoin('a.tenant', 't')
      .where('t.name = :userId', { userId })
      .andWhere('a.deleted_at IS NULL')
      .select('a.name', 'name')
      .getRawMany<{ name: string }>();
    const taken = new Set(existingNames.map((r) => r.name));

    const base = `${sourceName}-copy`;
    if (!taken.has(base)) return base;
    for (let i = 2; i <= 999; i++) {
      const candidate = `${base}-${i}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${base}-${Date.now()}`;
  }

  async duplicate(
    userId: string,
    sourceName: string,
    params: { name: string; displayName: string },
  ): Promise<DuplicateAgentResult> {
    const source = await this.findOwnedAgent(userId, sourceName);
    if (!source) throw new NotFoundException(`Agent "${sourceName}" not found`);

    const clash = await this.findOwnedAgent(userId, params.name);
    if (clash) throw new ConflictException(`Agent "${params.name}" already exists`);

    const rawKey = this.generateOtlpKey();
    const secret = getEncryptionSecret();
    const newAgentId = uuidv4();
    const now = sqlNow();

    const copied = await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Agent).insert({
        id: newAgentId,
        name: params.name,
        display_name: params.displayName,
        description: source.description,
        agent_category: source.agent_category,
        agent_platform: source.agent_platform,
        complexity_routing_enabled: source.complexity_routing_enabled,
        is_active: true,
        tenant_id: source.tenant_id,
      });

      await manager.getRepository(AgentApiKey).insert({
        id: uuidv4(),
        key: encrypt(rawKey, secret),
        key_hash: hashKey(rawKey),
        key_prefix: keyPrefix(rawKey),
        label: `${params.name} ingest key`,
        tenant_id: source.tenant_id,
        agent_id: newAgentId,
        is_active: true,
      });

      const customProviders = await manager
        .getRepository(CustomProvider)
        .find({ where: { agent_id: source.id } });
      const customProviderIdMap = new Map<string, string>();
      if (customProviders.length > 0) {
        const newCustomProviders = customProviders.map((cp) => {
          const newId = uuidv4();
          customProviderIdMap.set(cp.id, newId);
          return {
            id: newId,
            agent_id: newAgentId,
            user_id: cp.user_id,
            name: cp.name,
            base_url: cp.base_url,
            api_kind: cp.api_kind,
            models: cp.models,
            created_at: now,
          };
        });
        await manager.getRepository(CustomProvider).insert(newCustomProviders);
      }

      const providers = await manager
        .getRepository(UserProvider)
        .find({ where: { agent_id: source.id } });
      if (providers.length > 0) {
        await manager.getRepository(UserProvider).insert(
          providers.map((p) => ({
            id: uuidv4(),
            user_id: p.user_id,
            agent_id: newAgentId,
            provider: this.remapCustomProviderRef(p.provider, customProviderIdMap),
            api_key_encrypted: p.api_key_encrypted,
            key_prefix: p.key_prefix,
            auth_type: p.auth_type,
            region: p.region,
            is_active: p.is_active,
            connected_at: now,
            updated_at: now,
            cached_models: p.cached_models,
            models_fetched_at: p.models_fetched_at,
          })),
        );
      }

      const tiers = await manager
        .getRepository(TierAssignment)
        .find({ where: { agent_id: source.id } });
      if (tiers.length > 0) {
        await manager.getRepository(TierAssignment).insert(
          tiers.map((t) => ({
            id: uuidv4(),
            user_id: t.user_id,
            agent_id: newAgentId,
            tier: t.tier,
            override_route: t.override_route,
            auto_assigned_route: t.auto_assigned_route,
            fallback_routes: t.fallback_routes,
            updated_at: now,
          })),
        );
      }

      const specificity = await manager
        .getRepository(SpecificityAssignment)
        .find({ where: { agent_id: source.id } });
      if (specificity.length > 0) {
        await manager.getRepository(SpecificityAssignment).insert(
          specificity.map((s) => ({
            id: uuidv4(),
            user_id: s.user_id,
            agent_id: newAgentId,
            category: s.category,
            is_active: s.is_active,
            override_route: s.override_route,
            auto_assigned_route: s.auto_assigned_route,
            fallback_routes: s.fallback_routes,
            updated_at: now,
          })),
        );
      }

      return {
        providers: providers.length,
        customProviders: customProviders.length,
        tierAssignments: tiers.length,
        specificityAssignments: specificity.length,
      };
    });

    this.routingCache.invalidateAgent(newAgentId);

    return {
      agentId: newAgentId,
      agentName: params.name,
      displayName: params.displayName,
      apiKey: rawKey,
      copied,
    };
  }
}
