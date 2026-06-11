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
  userId: string,
  tenantId?: string,
): SelectQueryBuilder<T> {
  // Scope the live-agent lookup to the SAME tenant the outer query resolves to,
  // NOT `at.tenant_id`: on the user_id fallback path (no resolved tenant)
  // message rows can carry a NULL tenant_id, which would make the subquery match
  // nothing and blank the chart. When a tenant is resolved, match it directly;
  // otherwise resolve the tenant from the user (tenant.name = userId).
  const tenantScope = tenantId
    ? 'a.tenant_id = :liveTenantId'
    : 'a.tenant_id = (SELECT t.id FROM tenants t WHERE t.name = :liveUserId LIMIT 1)';
  const params: ObjectLiteral = { liveAgentName: agentName };
  if (tenantId) params.liveTenantId = tenantId;
  else params.liveUserId = userId;
  return qb.andWhere(
    `at.agent_id = (
        SELECT a.id FROM agents a
        WHERE ${tenantScope}
          AND a.name = :liveAgentName
          AND a.deleted_at IS NULL
        LIMIT 1
      )`,
    params,
  );
}

export function addTenantFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  userId: string,
  agentName?: string,
  tenantId?: string,
): SelectQueryBuilder<T> {
  if (tenantId) {
    qb.andWhere('at.tenant_id = :tenantId', { tenantId });
  } else {
    qb.andWhere('at.user_id = :userId', { userId });
  }
  if (agentName) {
    filterByLiveAgentName(qb, agentName, userId, tenantId);
  }
  return qb;
}

/**
 * Exclude the reserved Playground (`is_system`) agent from a message
 * aggregate. A row is dropped iff it belongs to a system agent of the same
 * tenant by EITHER `agent_id` OR `agent_name`; every other row (including
 * orphan telemetry with a NULL/unmatched `agent_id` and a non-system name)
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
 *     `is_system` and wrongly counted them.
 *
 * Assumes the query builder aliases `agent_messages` as `at`. This helper adds
 * no join, so callers that need agent columns must add their own `agents` join
 * (one-to-(0/1) on `a.id = at.agent_id`) independently.
 */
/**
 * The exact `NOT EXISTS` predicate `excludeSystemAgents` appends. Exported so
 * call sites and tests reference one string instead of duplicating (and
 * drifting on) the SQL.
 */
export const EXCLUDE_SYSTEM_AGENTS_PREDICATE =
  'NOT EXISTS (SELECT 1 FROM agents sysag WHERE sysag.tenant_id = at.tenant_id AND sysag.is_system = true AND (sysag.id = at.agent_id OR sysag.name = at.agent_name))';

export function excludeSystemAgents<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
): SelectQueryBuilder<T> {
  return qb.andWhere(EXCLUDE_SYSTEM_AGENTS_PREDICATE);
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
  'recorded',
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
    .addSelect('at.recorded', 'recorded')
    .addSelect('cp.name', 'custom_provider_name');
}
