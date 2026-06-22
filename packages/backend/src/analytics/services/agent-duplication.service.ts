import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Agent } from '../../entities/agent.entity';
import { AgentApiKey } from '../../entities/agent-api-key.entity';
import { AgentEnabledProvider } from '../../entities/agent-enabled-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';
import { AgentModelParams } from '../../entities/agent-model-params.entity';
import { hashKey, keyPrefix } from '../../common/utils/hash.util';
import { encrypt, getEncryptionSecret } from '../../common/utils/crypto.util';
import { sqlNow } from '../../common/utils/postgres-sql';
import { API_KEY_PREFIX } from '../../common/constants/api-key.constants';
import { RoutingCacheService } from '../../routing/routing-core/routing-cache.service';

export interface DuplicateAgentSummary {
  providers: number;
  tierAssignments: number;
  specificityAssignments: number;
  modelParams: number;
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

  private generateOtlpKey(): string {
    return API_KEY_PREFIX + randomBytes(32).toString('base64url');
  }

  private async findOwnedAgent(tenantId: string | null, agentName: string): Promise<Agent | null> {
    // No tenant yet (fresh account) → no agents.
    if (!tenantId) return null;
    return (
      this.agentRepo
        .createQueryBuilder('a')
        .where('a.tenant_id = :tenantId', { tenantId })
        .andWhere('a.name = :agentName', { agentName })
        .andWhere('a.deleted_at IS NULL')
        // Exclude the reserved Playground agent — it cannot be cloned or used as a
        // duplication source (it has no API key and is tenant-singleton).
        .andWhere('a.is_playground = false')
        .getOne()
    );
  }

  async getCopySummary(
    tenantId: string | null,
    sourceName: string,
  ): Promise<DuplicateAgentSummary> {
    const source = await this.findOwnedAgent(tenantId, sourceName);
    if (!source) throw new NotFoundException(`Agent "${sourceName}" not found`);

    const [providers, tierAssignments, specificityAssignments, modelParams] = await Promise.all([
      // Providers (including custom providers) are tenant-global; access is the
      // agent_enabled_providers row, so the copyable unit is the enabled-provider count,
      // not the credential rows.
      this.dataSource.getRepository(AgentEnabledProvider).count({ where: { agent_id: source.id } }),
      this.dataSource.getRepository(TierAssignment).count({ where: { agent_id: source.id } }),
      this.dataSource
        .getRepository(SpecificityAssignment)
        .count({ where: { agent_id: source.id } }),
      this.dataSource.getRepository(AgentModelParams).count({ where: { agent_id: source.id } }),
    ]);

    return { providers, tierAssignments, specificityAssignments, modelParams };
  }

  async suggestName(tenantId: string | null, sourceName: string): Promise<string> {
    const source = await this.findOwnedAgent(tenantId, sourceName);
    if (!source) throw new NotFoundException(`Agent "${sourceName}" not found`);

    const existingNames = await this.agentRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId: source.tenant_id })
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
    tenantId: string | null,
    sourceName: string,
    params: { name: string; displayName: string },
  ): Promise<DuplicateAgentResult> {
    const source = await this.findOwnedAgent(tenantId, sourceName);
    if (!source) throw new NotFoundException(`Agent "${sourceName}" not found`);

    const clash = await this.findOwnedAgent(tenantId, params.name);
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

      // Providers — regular AND custom — are tenant-global, shared across agents
      // via the agent_enabled_providers junction. Cloning the credential rows
      // under the new agent_id would duplicate a (tenant_id, provider, auth_type,
      // label) tuple and violate the tenant-scoped unique index. Instead, copy the
      // source agent's ENABLED-PROVIDER rows verbatim; every `custom:<id>` reference stays valid
      // because the underlying custom provider is shared, not re-created.
      const sourceEnabledRows = await manager
        .getRepository(AgentEnabledProvider)
        .find({ where: { agent_id: source.id } });
      if (sourceEnabledRows.length > 0) {
        await manager.getRepository(AgentEnabledProvider).insert(
          sourceEnabledRows.map((g) => ({
            agent_id: newAgentId,
            tenant_provider_id: g.tenant_provider_id,
          })),
        );
      }
      const providersEnabled = sourceEnabledRows.length;

      const tiers = await manager
        .getRepository(TierAssignment)
        .find({ where: { agent_id: source.id } });
      if (tiers.length > 0) {
        await manager.getRepository(TierAssignment).insert(
          tiers.map((t) => ({
            id: uuidv4(),
            agent_id: newAgentId,
            tier: t.tier,
            override_route: t.override_route,
            auto_assigned_route: t.auto_assigned_route,
            fallback_routes: t.fallback_routes,
            output_modality: t.output_modality,
            response_mode: t.response_mode,
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
            agent_id: newAgentId,
            category: s.category,
            is_active: s.is_active,
            override_route: s.override_route,
            auto_assigned_route: s.auto_assigned_route,
            fallback_routes: s.fallback_routes,
            output_modality: s.output_modality,
            response_mode: s.response_mode,
            updated_at: now,
          })),
        );
      }

      // Per-route model params travel with the agent — duplicating an agent
      // without copying these would silently reset the new agent's DeepSeek
      // thinking-mode (and any future per-model knob) back to the provider's
      // natural default, surprising the user.
      const modelParams = await manager
        .getRepository(AgentModelParams)
        .find({ where: { agent_id: source.id } });
      if (modelParams.length > 0) {
        for (const p of modelParams) {
          await manager.query(
            `
              INSERT INTO "agent_model_params" (
                "id", "agent_id", "scope_key", "provider",
                "auth_type", "model_name", "params", "created_at", "updated_at"
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `,
            [
              uuidv4(),
              newAgentId,
              p.scope_key,
              // Custom providers are tenant-global and shared by the duplicate, so
              // any `custom:<id>` provider reference is copied verbatim.
              p.provider,
              p.auth_type,
              p.model_name,
              p.params,
              now,
              now,
            ],
          );
        }
      }

      return {
        providers: providersEnabled,
        tierAssignments: tiers.length,
        specificityAssignments: specificity.length,
        modelParams: modelParams.length,
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
