import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import type { KeyRotationRule, KeyRotationRuleScope } from 'manifest-shared';
import { AgentKeyRotationRule } from '../../entities/agent-key-rotation-rule.entity';
import { RoutingCacheService } from './routing-cache.service';
import { inferProviderFromModelName } from '../../common/utils/provider-aliases';
import { normalizeAnthropicShortModelId } from '../../common/utils/anthropic-model-id';

/** Identity a normalized rule upserts / dedupes on. */
interface NormalizedKeyRotationRule {
  model: string | null;
  provider: string;
  scope: KeyRotationRuleScope;
  keyOrder: string[];
}

const SCOPES: readonly KeyRotationRuleScope[] = ['model', 'provider'];

/**
 * Per-agent key rotation rules: a rule maps a model (or every model of a
 * provider, at `provider` scope) to an ordered list of provider API-key
 * labels. The proxy hot path calls `getRule()` on every attempt, so reads go
 * through the same per-agent list cache as AgentModelParamsService (set once,
 * served from memory for the 2-minute TTL window). Writes invalidate the
 * agent's cached list.
 */
@Injectable()
export class KeyRotationRuleService {
  constructor(
    @InjectRepository(AgentKeyRotationRule)
    private readonly repo: Repository<AgentKeyRotationRule>,
    private readonly cache: RoutingCacheService,
  ) {}

  /**
   * All rotation rules for an agent, served through the routing cache.
   */
  async list(agentId: string): Promise<AgentKeyRotationRule[]> {
    const cached = this.cache.getKeyRotationRules(agentId);
    if (cached) return cached;
    const rows = await this.repo.find({ where: { agent_id: agentId } });
    this.cache.setKeyRotationRules(agentId, rows);
    return rows;
  }

  /**
   * Per-attempt lookup in the proxy hot path. Model-scope rules win; when none
   * matches, the provider-scope rule for the model's provider applies; else
   * `null` (current behavior — pinned keyLabel / default key, no rotation).
   * Model matching is case-insensitive; stored models were normalized at write
   * time to the runtime identity (see normalizeRuleModel).
   *
   * `provider` is the route's resolved provider when the caller knows it (the
   * proxy always does) — used directly for the provider-scope fallback. When
   * omitted, the provider is inferred from the model name; a bare model with
   * no prefix cannot resolve a provider rule.
   */
  async getRule(
    model: string,
    agentId: string,
    provider?: string,
  ): Promise<KeyRotationRule | null> {
    const rows = await this.list(agentId);
    const target = model.toLowerCase();
    // A model rule is scoped to its provider: when the caller knows the route
    // provider, only a matching-provider model rule applies — otherwise an
    // anthropic model rule could hijack a same-named model routed elsewhere.
    const modelRule = rows.find(
      (r) =>
        r.scope === 'model' &&
        r.model?.toLowerCase() === target &&
        (!provider || r.provider.toLowerCase() === provider.toLowerCase()),
    );
    if (modelRule) return toKeyRotationRule(modelRule);

    const resolvedProvider = provider ?? inferProviderFromModelName(model);
    if (!resolvedProvider) return null;
    const providerKey = resolvedProvider.toLowerCase();
    const providerRule = rows.find(
      (r) => r.scope === 'provider' && r.provider.toLowerCase() === providerKey,
    );
    return providerRule ? toKeyRotationRule(providerRule) : null;
  }

  /**
   * Full replace of an agent's rotation rules (upsert/delete diff). Returns
   * the saved list.
   *
   * Validation:
   *  - scope: 'model' (default) or 'provider'.
   *  - model: REQUIRED for model scope (normalized to the runtime identity);
   *    NULL/absent for provider scope.
   *  - provider: always required — for provider scope it is the rule's whole
   *    identity; for model scope it scopes the labels to that provider.
   *  - keyOrder: non-empty array of distinct, non-empty labels (case- and
   *    whitespace-deduplicated).
   *  - duplicates: one model rule per (agent, model); one provider rule per
   *    (agent, provider).
   *
   * Label/connection validation is deliberately LENIENT: labels are matched
   * against `tenant_providers` rows at runtime, and a strict write-time
   * cross-check would require listing keys per (provider, authType) — a rule
   * carries no auth type, and connections get renamed/reordered in the
   * dashboard all the time, so a rule that validates today can silently
   * drift. The runtime already guards the real failure mode: a label that
   * resolves to no connection is recorded as a credential failure and the
   * next label is tried. Here we only reject entries that could never match
   * anything (empty / non-string).
   */
  async replace(
    agentId: string,
    tenantId: string,
    rules: Array<Omit<KeyRotationRule, 'id'>>,
  ): Promise<AgentKeyRotationRule[]> {
    // Normalize + validate first so a bad payload writes nothing at all.
    const normalized = this.normalizeRules(rules);

    for (const rule of normalized) {
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(AgentKeyRotationRule)
        .values({
          id: randomUUID(),
          tenant_id: tenantId,
          agent_id: agentId,
          model: rule.model,
          provider: rule.provider,
          scope: rule.scope,
          key_order: rule.keyOrder,
        })
        .orUpdate(
          ['provider', 'key_order', 'scope', 'updated_at'],
          rule.scope === 'provider' ? ['agent_id', 'provider'] : ['agent_id', 'model'],
          // The provider-scope uniqueness lives on a PARTIAL unique index
          // (WHERE scope = 'provider'), so ON CONFLICT must name its predicate
          // or Postgres rejects the statement as "no unique index matching".
          rule.scope === 'provider' ? { indexPredicate: `scope = 'provider'` } : undefined,
        )
        .setParameter('updated_at', new Date().toISOString())
        .execute();
    }

    if (normalized.length === 0) {
      await this.repo.delete({ agent_id: agentId });
    } else {
      // Drop rules the payload no longer mentions, per scope: model rows by
      // model, provider rows by provider (NULL model never matches NOT IN).
      // Each scope branch is built only when that scope has entries — TypeORM
      // expands an empty array to `IN ('')`, and Postgres rejects `NOT IN ()`
      // as a syntax error, so an all-model (or all-provider) PUT must not emit
      // the other branch.
      const modelNames = normalized.filter((r) => r.model !== null).map((r) => r.model);
      const providerNames = normalized.filter((r) => r.scope === 'provider').map((r) => r.provider);
      const branches: string[] = [];
      const branchParams: Record<string, unknown> = {};
      if (modelNames.length > 0) {
        branches.push("scope = 'model' AND model NOT IN (:...models)");
        branchParams.models = modelNames;
      }
      if (providerNames.length > 0) {
        branches.push("scope = 'provider' AND provider NOT IN (:...providers)");
        branchParams.providers = providerNames;
      }
      if (branches.length > 0) {
        await this.repo
          .createQueryBuilder()
          .delete()
          .from(AgentKeyRotationRule)
          .where('agent_id = :agentId', { agentId })
          .andWhere(new Brackets((sub) => sub.where(branches.join(' OR '))), branchParams)
          .execute();
      }
    }

    this.cache.invalidateKeyRotationRules(agentId);
    return this.list(agentId);
  }

  private normalizeRules(rules: Array<Omit<KeyRotationRule, 'id'>>): NormalizedKeyRotationRule[] {
    const seenModels = new Set<string>();
    const seenProviders = new Set<string>();
    return rules.map((rule) => {
      const normalized = this.normalizeRule(rule);
      if (normalized.scope === 'provider') {
        const key = normalized.provider.toLowerCase();
        if (seenProviders.has(key)) {
          throw new BadRequestException(
            `Duplicate provider rule for "${normalized.provider}" (one provider rule per provider)`,
          );
        }
        seenProviders.add(key);
      } else {
        const key = normalized.model!.toLowerCase();
        if (seenModels.has(key)) {
          throw new BadRequestException(
            `Duplicate rule for model "${normalized.model}" (model rules are unique per agent)`,
          );
        }
        seenModels.add(key);
      }
      return normalized;
    });
  }

  private normalizeRule(rule: Omit<KeyRotationRule, 'id'>): NormalizedKeyRotationRule {
    if (!rule) throw new BadRequestException('Each rule must be an object');

    const scope: KeyRotationRuleScope = rule.scope ?? 'model';
    if (!SCOPES.includes(scope)) {
      throw new BadRequestException(`scope must be one of: ${SCOPES.join(', ')}`);
    }

    const provider = (rule.provider ?? '').trim().toLowerCase();
    if (!provider) {
      throw new BadRequestException('Rule provider is required');
    }

    // A provider-scope rule must NOT carry a model — reject instead of
    // silently dropping it (the row's model column is NULL for this scope).
    if (scope === 'provider' && typeof rule.model === 'string' && rule.model.trim() !== '') {
      throw new BadRequestException(
        'A provider-scope rule must not carry a model (it applies to every model of the provider)',
      );
    }

    let model: string | null = null;
    if (scope === 'model') {
      if (typeof rule.model !== 'string' || rule.model.trim() === '') {
        throw new BadRequestException('A model-scope rule must carry a model');
      }
      // Normalize the model to the identity the runtime looks up at attempt
      // time (proxy-fallback's normalizeProviderModel): a provider-qualified id
      // is stripped to its bare form and Anthropic dotted minors become the
      // short dashed form the proxy actually routes with. Without this, a rule
      // stored as `claude-sonnet-4.5` or `anthropic/claude-sonnet-4-5` would
      // silently never match the runtime `claude-sonnet-4-5` (and vice versa).
      model = normalizeRuleModel(rule.model.trim(), provider);
    }

    if (!Array.isArray(rule.keyOrder) || rule.keyOrder.length === 0) {
      throw new BadRequestException(
        `Rule for "${model ?? provider}": keyOrder must be a non-empty array`,
      );
    }
    const keyOrder: string[] = [];
    const seenLabels = new Set<string>();
    for (const raw of rule.keyOrder) {
      if (typeof raw !== 'string' || raw.trim() === '') {
        throw new BadRequestException(
          `Rule for "${model ?? provider}": keyOrder entries must be non-empty strings`,
        );
      }
      const label = raw.trim();
      const labelKey = label.toLowerCase();
      if (seenLabels.has(labelKey)) {
        throw new BadRequestException(
          `Rule for "${model ?? provider}": duplicate key label "${label}"`,
        );
      }
      seenLabels.add(labelKey);
      keyOrder.push(label);
    }

    return { model, provider, scope, keyOrder };
  }
}

/**
 * Normalize a rule's model to the identity the proxy runtime uses at lookup
 * time (proxy-fallback's `normalizeProviderModel(provider, model)`):
 *  - a `provider/`-qualified id is reduced to its bare form — but only when
 *    the prefix names the rule's own provider and the provider isn't a custom
 *    endpoint, whose `custom:<uuid>/model` ids keep the prefix as part of the
 *    runtime model identity;
 *  - Anthropic dotted minors (`claude-sonnet-4.5`) become the short dashed
 *    form the proxy routes with (`claude-sonnet-4-5`).
 * Non-anthropic bare ids pass through unchanged.
 */
function normalizeRuleModel(model: string, provider: string): string {
  const slashIdx = model.indexOf('/');
  const inferred = slashIdx > 0 ? model.substring(0, slashIdx).toLowerCase() : undefined;
  const bare =
    inferred && inferred === provider.toLowerCase() && !provider.startsWith('custom:')
      ? model.substring(slashIdx + 1)
      : model;
  return provider.toLowerCase() === 'anthropic' ? normalizeAnthropicShortModelId(bare) : bare;
}

export function toKeyRotationRule(row: AgentKeyRotationRule): KeyRotationRule {
  return {
    id: row.id,
    agentId: row.agent_id,
    model: row.model,
    provider: row.provider,
    scope: row.scope,
    keyOrder: row.key_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
