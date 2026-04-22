import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

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
    qb.andWhere('at.agent_name = :agentName', { agentName });
  }
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
] as const;

export function selectMessageRowColumns<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  costExpr: string,
): SelectQueryBuilder<T> {
  return qb
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
    .addSelect('at.header_tier_color', 'header_tier_color');
}
