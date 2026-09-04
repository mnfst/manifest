import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { TtlCache } from '../common/utils/ttl-cache';
import { toLocalSqlTimestamp } from '../common/utils/postgres-sql';
import { sqlIsSuccessStatus } from '../analytics/services/query-helpers';
import { isExcludedEmail } from './crm-metrics.filters';
import type { CohortRow, CrmHealedUser, CrmWaitlistClaim, ProviderRow } from './crm-metrics.types';

/**
 * Answers on the cheap: the requests Autofix repaired lately, grouped by the
 * person who owns them, plus the waiting-list claims that measure whether the
 * campaign worked.
 *
 * Read once a day by the CRM, so there is no snapshot table and no cron. A
 * snapshot would need a cron running exactly the cross-tenant scan this is
 * trying to avoid, plus leader election; once indexed, the live query is
 * cheaper than that cron would be. Results sit behind a TTL cache.
 */

const HEALED_INDEX = 'IDX_requests_autofix_healed';

/**
 * Short on purpose. The cache exists to stop a retrying client from replaying
 * the provider join (~80 MB of buffer reads) up to the throttler's 100/min, not
 * to serve the expected traffic — a once-a-day poll misses either way. A long
 * TTL would buy nothing and make the feed surprisingly stale after an operator
 * fixes something and re-runs.
 */
const CACHE_TTL_MS = 60_000;

/**
 * Deliberately *below* the 2.4s the unindexed cohort scan takes. If the
 * partial index is missing the query aborts instead of completing, because the
 * damage from that plan is not latency but reading 6.6 GB through a ~128 MB
 * shared_buffers and evicting everyone else's working set.
 */
const STATEMENT_TIMEOUT_MS = 1_500;
const LOCK_TIMEOUT_MS = 5_000;

/** The index is the entire point; without it, refuse rather than thrash prod. */
const INDEX_READY_SQL = `
  SELECT 1 FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  WHERE c.relname = $1 AND i.indisvalid
`;

/**
 * The canonical "healed" predicate, matching request-volume.service.ts. The
 * status check is not redundant: a retry can return 2xx while the request still
 * concludes failed, and quoting a repair count the dashboard disagrees with is
 * worse than quoting none.
 *
 * No playground exclusion is needed here (every other cross-tenant aggregate
 * carries one): playground.service.ts writes `autofix_status: null` on all of
 * its request paths, so a playground row can never match this predicate.
 */
const IS_HEALED = `r.autofix_status = 'retry_succeeded' AND ${sqlIsSuccessStatus('r.status')}`;

const COHORT_SQL = `
  SELECT lower(u.email)                             AS email,
         u.name                                     AS user_name,
         r.tenant_id                                AS tenant_id,
         count(*) FILTER (WHERE r.timestamp > $1)   AS healed_recent,
         count(*)                                   AS healed_all,
         min(r.timestamp)                           AS first_heal_at,
         max(r.timestamp)                           AS last_heal_at
  FROM requests r
  JOIN tenants t ON t.id = r.tenant_id
  JOIN "user" u ON u.id = t.owner_user_id
  WHERE ${IS_HEALED}
    AND u."emailVerified" = true
  GROUP BY lower(u.email), u.name, r.tenant_id
  HAVING count(*) FILTER (WHERE r.timestamp > $1) > 0
`;

/**
 * Driven off the healed requests, not off "any autofix-touched attempt in the
 * window". That is both cheaper (it rides the partial index, then ~1.6k
 * request_id lookups, instead of scanning every tenant's whole window) and the
 * question we actually mean: which providers were failing on the requests
 * Autofix went on to repair.
 */
const PROVIDERS_SQL = `
  SELECT r.tenant_id AS tenant_id, am.provider AS provider, count(*) AS n
  FROM requests r
  JOIN agent_messages am ON am.request_id = r.id
  WHERE ${IS_HEALED}
    AND r.timestamp > $1
    AND am.autofix_applied = true
  GROUP BY r.tenant_id, am.provider
`;

const CLAIMS_SQL = `
  SELECT email, source, claimed_at
  FROM waitlist_claims
  WHERE claimed_at > $1
  ORDER BY claimed_at DESC
`;

@Injectable()
export class CrmMetricsService {
  private readonly cohortCache = new TtlCache<number, CrmHealedUser[]>({
    maxSize: 8,
    ttlMs: CACHE_TTL_MS,
  });
  private readonly claimsCache = new TtlCache<number, CrmWaitlistClaim[]>({
    maxSize: 8,
    ttlMs: CACHE_TTL_MS,
  });

  constructor(private readonly dataSource: DataSource) {}

  /** Users whose requests Autofix repaired within `days`, one row per person. */
  async getHealedCohort(days: number, now: Date = new Date()): Promise<CrmHealedUser[]> {
    const cached = this.cohortCache.get(days);
    if (cached) return cached;

    const cutoff = cutoffFor(days, now);
    const users = await this.withRunner(async (runner) => {
      const ready = (await runner.query(INDEX_READY_SQL, [HEALED_INDEX])) as unknown[];
      if (ready.length === 0) {
        throw new ServiceUnavailableException(
          `${HEALED_INDEX} is missing or invalid; refusing to run an unindexed scan`,
        );
      }
      const merged = mergeByEmail((await runner.query(COHORT_SQL, [cutoff])) as CohortRow[]);
      if (merged.size === 0) return [];
      const providers = (await runner.query(PROVIDERS_SQL, [cutoff])) as ProviderRow[];
      return buildUsers(merged, providers);
    });

    this.cohortCache.set(days, users);
    return users;
  }

  /** Pivot waiting-list claims in the window: who converted, and from where. */
  async getConversions(days: number, now: Date = new Date()): Promise<CrmWaitlistClaim[]> {
    const cached = this.claimsCache.get(days);
    if (cached) return cached;

    // `waitlist_claims.claimed_at` is `timestamp WITH time zone`, unlike the
    // naive `requests.timestamp` below — hence the UTC boundary here.
    const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
    const claims = await this.withRunner(async (runner) => {
      const rows = (await runner.query(CLAIMS_SQL, [cutoff])) as CrmWaitlistClaim[];
      return rows.map((row) => ({
        email: row.email.toLowerCase(),
        source: row.source,
        claimed_at: new Date(row.claimed_at).toISOString(),
      }));
    });

    this.claimsCache.set(days, claims);
    return claims;
  }

  /**
   * `SET LOCAL` is transaction-scoped, which is the only form Railway's
   * PgBouncer accepts (see the note in database.module.ts).
   */
  private async withRunner<T>(fn: (runner: QueryRunner) => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT_MS}ms'`);
        await runner.query(`SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT_MS}ms'`);
        const result = await fn(runner);
        await runner.commitTransaction();
        return result;
      } catch (error) {
        await runner.rollbackTransaction();
        throw error;
      }
    } finally {
      await runner.release();
    }
  }
}

/** Accumulator for the rows belonging to one person. */
interface Merged {
  email: string;
  name: string | null;
  healed_recent: number;
  healed_all: number;
  first_heal_at: number;
  last_heal_at: number;
  tenantIds: string[];
}

/**
 * Local wall clock, not UTC: `requests.timestamp` is `timestamp without time
 * zone` and the pg driver writes JS Dates in the process timezone, so a UTC
 * boundary would be offset by that amount and silently drop rows.
 */
function cutoffFor(days: number, now: Date): string {
  return toLocalSqlTimestamp(new Date(now.getTime() - days * 86_400_000));
}

/**
 * The SQL groups by (email, tenant) and the totals are summed here. Today a
 * user owns at most one tenant (`uq_tenants_owner_user` is unique), so this is
 * a no-op — but `owner_user_id` is nullable by design for future team
 * workspaces, so the 1:1 is a current fact rather than an invariant.
 *
 * Excluded addresses are dropped before their tenants reach the payload.
 */
function mergeByEmail(rows: CohortRow[]): Map<string, Merged> {
  const merged = new Map<string, Merged>();
  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (isExcludedEmail(email)) continue;

    const first = new Date(row.first_heal_at).getTime();
    const last = new Date(row.last_heal_at).getTime();
    const existing = merged.get(email);
    if (!existing) {
      merged.set(email, {
        email,
        name: row.user_name,
        healed_recent: Number(row.healed_recent),
        healed_all: Number(row.healed_all),
        first_heal_at: first,
        last_heal_at: last,
        tenantIds: [row.tenant_id],
      });
      continue;
    }
    existing.healed_recent += Number(row.healed_recent);
    existing.healed_all += Number(row.healed_all);
    existing.first_heal_at = Math.min(existing.first_heal_at, first);
    existing.last_heal_at = Math.max(existing.last_heal_at, last);
    existing.name = existing.name ?? row.user_name;
    existing.tenantIds.push(row.tenant_id);
  }
  return merged;
}

function buildUsers(merged: Map<string, Merged>, providerRows: ProviderRow[]): CrmHealedUser[] {
  const byTenant = new Map<string, ProviderRow[]>();
  for (const row of providerRows) {
    if (!row.provider) continue;
    const bucket = byTenant.get(row.tenant_id);
    if (bucket) bucket.push(row);
    else byTenant.set(row.tenant_id, [row]);
  }

  const users = [...merged.values()].map((entry) => {
    const providers = rankProviders(entry.tenantIds, byTenant);
    return {
      email: entry.email,
      name: entry.name,
      healed_recent: entry.healed_recent,
      healed_all: entry.healed_all,
      first_heal_at: new Date(entry.first_heal_at).toISOString(),
      last_heal_at: new Date(entry.last_heal_at).toISOString(),
      providers,
      top_provider: providers[0] ?? null,
    };
  });

  return users.sort((a, b) => b.healed_recent - a.healed_recent);
}

/** Providers this person's tenants healed against, most-repaired first. */
function rankProviders(tenantIds: string[], byTenant: Map<string, ProviderRow[]>): string[] {
  const totals = new Map<string, number>();
  for (const tenantId of tenantIds) {
    for (const row of byTenant.get(tenantId) ?? []) {
      const provider = row.provider as string;
      totals.set(provider, (totals.get(provider) ?? 0) + Number(row.n));
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([provider]) => provider);
}
