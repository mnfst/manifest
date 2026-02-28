import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm';

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
  if (Math.abs(current) < EPS && Math.abs(previous) < EPS) return 0;
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
): SelectQueryBuilder<T> {
  qb.andWhere(
    new Brackets((sub) => {
      sub
        .where('at.tenant_id IN (SELECT id FROM tenants WHERE name = :userId)', { userId })
        .orWhere('at.user_id = :userId', { userId });
    }),
  );
  if (agentName) {
    qb.andWhere('at.agent_name = :agentName', { agentName });
  }
  return qb;
}
