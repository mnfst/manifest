import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import type { KeyRotationRule } from 'manifest-shared';
import { AgentKeyRotationRule } from '../../entities/agent-key-rotation-rule.entity';
import { RoutingCacheService } from './routing-cache.service';
import { inferProviderFromModelName } from '../../common/utils/provider-aliases';
import { normalizeAnthropicShortModelId } from '../../common/utils/anthropic-model-id';

/**
 * Per-agent key rotation rules: a rule maps a model string to an ordered list
 * of provider API-key labels. The proxy hot path calls `getRule()` on every
 * attempt, so reads go through the same per-agent list cache as
 * AgentModelParamsService (set once, served from memory for the 2-minute TTL
 * window). Writes invalidate the agent's cached list.
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
   * Per-attempt lookup in the proxy hot path. Returns `null` when no rule
   * exists for the model — the proxy then keeps its existing behavior
   * (pinned keyLabel / default key, no rotation). Model matching is
   * case-insensitive; stored models were normalized at write time to the
   * runtime identity (see normalizeRuleModel).
   */
  async getRule(model: string, agentId: string): Promise<KeyRotationRule | null> {
    const rows = await this.list(agentId);
    const target = model.toLowerCase();
    const row = rows.find((r) => r.model.toLowerCase() === target);
    return row ? toKeyRotationRule(row) : null;
  }

  /**
   * Full replace of an agent's rotation rules (upsert/delete diff, keyed by
   * the unique (agent_id, model) index). Returns the saved list.
   *
   * Validation:
   *  - provider: inferred from the model name via inferProviderFromModelName;
   *    an explicit provider in the payload wins, and it is REQUIRED when
   *    inference fails (a rule without a provider cannot scope its labels).
   *  - keyOrder: non-empty array of distinct, non-empty labels (case- and
   *    whitespace-deduplicated).
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
          key_order: rule.keyOrder,
        })
        .orUpdate(['provider', 'key_order', 'updated_at'], ['agent_id', 'model'])
        .setParameter('updated_at', new Date().toISOString())
        .execute();
    }

    if (normalized.length === 0) {
      await this.repo.delete({ agent_id: agentId });
    } else {
      // Drop every rule for this agent that the payload no longer mentions.
      await this.repo
        .createQueryBuilder()
        .delete()
        .from(AgentKeyRotationRule)
        .where('agent_id = :agentId', { agentId })
        .andWhere('model NOT IN (:...models)', { models: normalized.map((r) => r.model) })
        .execute();
    }

    this.cache.invalidateKeyRotationRules(agentId);
    return this.list(agentId);
  }

  private normalizeRules(rules: Array<Omit<KeyRotationRule, 'id'>>): Array<{
    model: string;
    provider: string;
    keyOrder: string[];
  }> {
    const seenModels = new Set<string>();
    return rules.map((rule) => {
      const normalized = this.normalizeRule(rule);
      const modelKey = normalized.model.toLowerCase();
      if (seenModels.has(modelKey)) {
        throw new BadRequestException(
          `Duplicate rule for model "${normalized.model}" (model rules are unique per agent)`,
        );
      }
      seenModels.add(modelKey);
      return normalized;
    });
  }

  private normalizeRule(rule: Omit<KeyRotationRule, 'id'>): {
    model: string;
    provider: string;
    keyOrder: string[];
  } {
    if (!rule || typeof rule.model !== 'string') {
      throw new BadRequestException('Each rule must carry a model');
    }
    const model = rule.model.trim();
    if (!model) throw new BadRequestException('Rule model must be a non-empty string');

    const inferred = inferProviderFromModelName(model);
    const provider = (rule.provider ?? '').trim().toLowerCase() || inferred;
    if (!provider) {
      throw new BadRequestException(
        `Could not infer a provider from model "${model}"; provide "provider" explicitly`,
      );
    }

    // Normalize the model to the identity the runtime looks up at attempt
    // time (proxy-fallback's normalizeProviderModel): a provider-qualified id
    // is stripped to its bare form and Anthropic dotted minors become the
    // short dashed form the proxy actually routes with. Without this, a rule
    // stored as `claude-sonnet-4.5` or `anthropic/claude-sonnet-4-5` would
    // silently never match the runtime `claude-sonnet-4-5` (and vice versa).
    const normalizedModel = normalizeRuleModel(model, provider);

    if (!Array.isArray(rule.keyOrder) || rule.keyOrder.length === 0) {
      throw new BadRequestException(
        `Rule for "${normalizedModel}": keyOrder must be a non-empty array`,
      );
    }
    const keyOrder: string[] = [];
    const seenLabels = new Set<string>();
    for (const raw of rule.keyOrder) {
      if (typeof raw !== 'string' || raw.trim() === '') {
        throw new BadRequestException(
          `Rule for "${normalizedModel}": keyOrder entries must be non-empty strings`,
        );
      }
      const label = raw.trim();
      const labelKey = label.toLowerCase();
      if (seenLabels.has(labelKey)) {
        throw new BadRequestException(
          `Rule for "${normalizedModel}": duplicate key label "${label}"`,
        );
      }
      seenLabels.add(labelKey);
      keyOrder.push(label);
    }

    return { model: normalizedModel, provider, keyOrder };
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
    keyOrder: row.key_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
