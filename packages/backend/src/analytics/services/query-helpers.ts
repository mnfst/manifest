import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { CustomProvider } from '../../entities/custom-provider.entity';

export interface MetricWithTrend {
  value: number;
  trend_pct: number;
  sub_values?: Record<string, number>;
}

/** Format a Date as a timestamp string using local time (matches `timestamp without time zone` storage). */
export function formatTimestamp(d: Date): string {
  const p = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

/**
 * Compute the percentage change between two values.
 * Returns 0 when values are too small for a meaningful comparison,
 * and clamps the result to ±999 to avoid absurd display values
 * caused by near-zero floating-point denominators.
 */
export function computeTrend(current: number, previous: number): number {
  const EPS = 1e-6;
  if (Math.abs(previous) < EPS) return 0;
  const pct = Math.round(((current - previous) / previous) * 100);
  return Math.max(-999, Math.min(999, pct));
}

export function downsample(data: number[], targetLen: number): number[] {
  if (data.length <= targetLen) return data;
  const result: number[] = [];
  const bucketSize = data.length / targetLen;
  for (let i = 0; i < targetLen; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    let sum = 0;
    for (let j = start; j < end; j++) sum += data[j] ?? 0;
    result.push(sum);
  }
  return result;
}

/**
 * Constrain a message aggregate to the LIVE agent currently owning a slug.
 *
 * `agent_messages` stores `agent_id` alongside `agent_name`, so filtering by
 * name alone would pull in rows from a soft-deleted agent that shares the slug
 * with a live one (slug reuse). Resolving to the live agent's id keeps a
 * recreated agent's chart free of its dead namesake's history. Assumes the
 * query builder aliases `agent_messages` as `at`.
 */
export function filterByLiveAgentName<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  agentName: string,
  tenantId: string,
): SelectQueryBuilder<T> {
  return qb.andWhere(
    `at.agent_id = (
        SELECT a.id FROM agents a
        WHERE a.tenant_id = :liveTenantId
          AND a.name = :liveAgentName
          AND a.deleted_at IS NULL
        LIMIT 1
      )`,
    { liveAgentName: agentName, liveTenantId: tenantId },
  );
}

/**
 * Scope a message aggregate to the tenant. Pass `null` when the requesting
 * user has no tenant yet (fresh account) — the filter then matches nothing,
 * which is the correct "no data" answer. Tenancy is the ONLY scope; the
 * informational `at.user_id` column is never consulted.
 */
export function addTenantFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  tenantId: string | null,
  agentName?: string,
): SelectQueryBuilder<T> {
  if (tenantId === null) {
    // No tenant → no rows. Keeps callers branch-free.
    return qb.andWhere('1 = 0');
  }
  qb.andWhere('at.tenant_id = :tenantId', { tenantId });
  if (agentName) {
    filterByLiveAgentName(qb, agentName, tenantId);
  }
  return qb;
}

/**
 * Exclude the reserved Playground (`is_playground`) agent from a message
 * aggregate. A row is dropped iff it belongs to a playground agent of the same
 * tenant by EITHER `agent_id` OR `agent_name`; every other row (including
 * orphan telemetry with a NULL/unmatched `agent_id` and a non-playground name)
 * stays included.
 *
 * Implemented as a `NOT EXISTS` semi-join rather than a LEFT JOIN. Two
 * properties matter and only the semi-join satisfies both:
 *
 *  1. No duplication — a semi-join is a pure existence test, so it can never
 *     multiply fact rows even when a soft-deleted agent and a live agent share
 *     a slug (which a name-based LEFT JOIN would, inflating any SUM/COUNT).
 *  2. No leak — matching on `id` OR `name` means a Playground message that
 *     carries only `agent_name = 'Playground'` (NULL or unmatched `agent_id`)
 *     is still excluded. An id-only LEFT JOIN left those rows with a NULL
 *     `is_playground` and wrongly counted them.
 *
 * Assumes the query builder aliases `agent_messages` as `at`. This helper adds
 * no join, so callers that need agent columns must add their own `agents` join
 * (one-to-(0/1) on `a.id = at.agent_id`) independently.
 */
/**
 * The exact `NOT EXISTS` predicate `excludePlaygroundAgents` appends. Exported so
 * call sites and tests reference one string instead of duplicating (and
 * drifting on) the SQL.
 */
export const EXCLUDE_PLAYGROUND_AGENTS_PREDICATE =
  'NOT EXISTS (SELECT 1 FROM agents playag WHERE playag.tenant_id = at.tenant_id AND playag.is_playground = true AND (playag.id = at.agent_id OR playag.name = at.agent_name))';

export function excludePlaygroundAgents<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
): SelectQueryBuilder<T> {
  return qb.andWhere(EXCLUDE_PLAYGROUND_AGENTS_PREDICATE);
}

/**
 * Match a connection's key label case-insensitively, treating a legacy NULL
 * `provider_key_label` as the canonical `'Default'`. A connection is identified
 * by (tenant, provider, auth_type, label); without the label filter two keys
 * that share provider+auth_type but differ by label merge into one. Assumes the
 * query builder aliases `agent_messages` as `at`.
 */
export function filterByKeyLabel<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  label: string | null | undefined,
): SelectQueryBuilder<T> {
  return qb.andWhere("LOWER(COALESCE(at.provider_key_label, 'Default')) = LOWER(:keyLabel)", {
    keyLabel: label && label.length > 0 ? label : 'Default',
  });
}

/**
 * Scope a message aggregate to one exact connection by its `tenant_providers`
 * row id — the value stamped on `agent_messages.tenant_provider_id` at proxy
 * time. Unlike filterByKeyLabel (which matches the provider+auth_type+label
 * tuple and so merges sibling keys sharing a label, and treats a NULL label as
 * 'Default'), this pins to the single connection that actually served each
 * message. Rows with a NULL id — pre-upgrade history that the backfill could
 * not disambiguate, plus local/Ollama and blind-proxy paths — never match,
 * which is the correct behaviour for a per-connection view. Assumes the query
 * builder aliases `agent_messages` as `at`. Prefer this over filterByKeyLabel
 * whenever a connection id is available; keep filterByKeyLabel for
 * provider-level ("all my OpenAI keys") aggregation.
 */
export function filterByTenantProviderId<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  tenantProviderId: string,
): SelectQueryBuilder<T> {
  return qb.andWhere('at.tenant_provider_id = :tenantProviderId', { tenantProviderId });
}

/**
 * Scope a message aggregate to a single connection. When a `tenant_providers`
 * row id is known, pin to it (the authoritative per-connection filter, exact
 * to the key that served each message); otherwise fall back to the
 * provider+auth_type+label tuple. The id deliberately wins over the label so a
 * backfilled row whose `provider_key_label` was never set (NULL → 'Default')
 * still appears under its real connection. A no-op when neither is supplied.
 */
export function scopeToConnection<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  tenantProviderId: string | undefined,
  label: string | null | undefined,
): SelectQueryBuilder<T> {
  if (tenantProviderId) return filterByTenantProviderId(qb, tenantProviderId);
  if (label !== undefined) return filterByKeyLabel(qb, label);
  return qb;
}

/**
 * Single source of truth for the columns projected by any endpoint that
 * returns rows rendered by the frontend `MessageTable` / `ModelCell` component.
 * The frontend `MessageRow` type (packages/frontend/src/components/message-table-types.ts)
 * is the downstream contract — every field it declares must be selected here so
 * the shared badge/provider rendering works identically across every call site.
 *
 * Assumes the query builder aliases `agent_messages` as `at`. Callers pass the
 * `costExpr` (e.g. `sqlCastFloat(sqlSanitizeCost('at.cost_usd'))`) so the
 * shared helper stays agnostic to how each call site sanitises cost.
 */
/**
 * Join `custom_providers` to resolve a custom provider's display name from a
 * stored `at.provider` of the form `custom:<uuid>`. `cp.id` is a varchar PK,
 * so plain string concatenation matches without casts. Built-in providers
 * never match (their provider ids carry no `custom:` prefix) and resolve to a
 * NULL `cp.name`.
 */
export const CUSTOM_PROVIDER_JOIN_CONDITION = "at.provider = 'custom:' || cp.id";

/**
 * Series key for per-provider aggregates: custom providers surface their
 * display name (or a stable fallback when the provider was deleted), built-in
 * providers keep their id. Requires the `cp` join above.
 */
export const PROVIDER_SERIES_KEY_EXPR =
  "CASE WHEN at.provider LIKE 'custom:%' THEN COALESCE(cp.name, 'Deleted provider') ELSE at.provider END";

export const MESSAGE_ROW_SELECT_ALIASES = [
  'id',
  'timestamp',
  'agent_name',
  'model',
  'provider',
  'display_name',
  'input_tokens',
  'output_tokens',
  'status',
  'total_tokens',
  'cost',
  'routing_tier',
  'routing_reason',
  'specificity_category',
  'error_message',
  'auth_type',
  'fallback_from_model',
  'fallback_index',
  'feedback_rating',
  'header_tier_id',
  'header_tier_name',
  'header_tier_color',
  'provider_key_label',
  'custom_provider_name',
] as const;

export function selectMessageRowColumns<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  costExpr: string,
): SelectQueryBuilder<T> {
  return qb
    .leftJoin(CustomProvider, 'cp', CUSTOM_PROVIDER_JOIN_CONDITION)
    .select('at.id', 'id')
    .addSelect('at.timestamp', 'timestamp')
    .addSelect('at.agent_name', 'agent_name')
    .addSelect('at.model', 'model')
    .addSelect('at.provider', 'provider')
    .addSelect('at.model', 'display_name')
    .addSelect('at.input_tokens', 'input_tokens')
    .addSelect('at.output_tokens', 'output_tokens')
    .addSelect('at.status', 'status')
    .addSelect('at.input_tokens + at.output_tokens', 'total_tokens')
    .addSelect(costExpr, 'cost')
    .addSelect('at.routing_tier', 'routing_tier')
    .addSelect('at.routing_reason', 'routing_reason')
    .addSelect('at.specificity_category', 'specificity_category')
    .addSelect('at.error_message', 'error_message')
    .addSelect('at.auth_type', 'auth_type')
    .addSelect('at.fallback_from_model', 'fallback_from_model')
    .addSelect('at.fallback_index', 'fallback_index')
    .addSelect('at.feedback_rating', 'feedback_rating')
    .addSelect('at.header_tier_id', 'header_tier_id')
    .addSelect('at.header_tier_name', 'header_tier_name')
    .addSelect('at.header_tier_color', 'header_tier_color')
    .addSelect('at.provider_key_label', 'provider_key_label')
    .addSelect('cp.name', 'custom_provider_name');
}
