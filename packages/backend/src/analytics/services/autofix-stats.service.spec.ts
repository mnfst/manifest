import { AutofixStatsService } from './autofix-stats.service';

/**
 * Unit tests for the request-level KPI split: recovered_by_manifest =
 * recovered_by_autofix + recovered_by_fallback, with autofix taking
 * precedence (same rule as the disposition timeseries).
 */

function makeService(queryImpl: (sql: string, params: unknown[]) => Promise<unknown[]>) {
  const dataSource = { query: jest.fn().mockImplementation(queryImpl) };
  return {
    service: new AutofixStatsService(
      {} as never, // agentRepo (unused by getStats)
      {} as never, // messageRepo (unused by getStats)
      {} as never, // requestRepo (unused by getStats)
      {} as never, // tenantRepo (unused by getStats)
      dataSource as never,
    ),
    dataSource,
  };
}

describe('AutofixStatsService.getStats', () => {
  it('splits recovered requests into autofix vs fallback (autofix precedence)', async () => {
    const { service } = makeService(async (sql) => {
      if (sql.includes('recovered_autofix')) {
        // 100 requests, 95 ok, 12 recovered of which 9 via autofix → 3 fallback
        return [{ total: 100, successes: 95, recovered: 12, recovered_autofix: 9 }];
      }
      return []; // needs_attention
    });

    const stats = await service.getStats({ tenantId: 't-1', range: '7d' });

    expect(stats.total_requests.value).toBe(100);
    expect(stats.success_rate.value).toBeCloseTo(0.95, 10);
    expect(stats.recovered_by_manifest.value).toBe(12);
    expect(stats.recovered_by_autofix.value).toBe(9);
    expect(stats.recovered_by_fallback.value).toBe(3);
    expect(stats.recovered_by_autofix.value + stats.recovered_by_fallback.value).toBe(
      stats.recovered_by_manifest.value,
    );
    expect(stats.errors_remaining.value).toBe(5);
  });

  it('counts a recovered request with both autofix and fallback attempts once, as autofix', async () => {
    // The SQL enforces this via EXISTS(autofix_applied) on recovered rows;
    // here we assert the service derives fallback as the exact complement.
    const { service } = makeService(async (sql) => {
      if (sql.includes('recovered_autofix')) {
        return [{ total: 10, successes: 10, recovered: 4, recovered_autofix: 4 }];
      }
      return [];
    });

    const stats = await service.getStats({ tenantId: 't-1' });

    expect(stats.recovered_by_autofix.value).toBe(4);
    expect(stats.recovered_by_fallback.value).toBe(0);
  });

  it('returns zeroed splits for a null tenant', async () => {
    const { service, dataSource } = makeService(async () => []);

    const stats = await service.getStats({ tenantId: null });

    expect(stats.total_requests.value).toBe(0);
    expect(stats.recovered_by_autofix.value).toBe(0);
    expect(stats.recovered_by_fallback.value).toBe(0);
    // The window query must not run without a tenant (needs_attention also bails).
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('counts per-provider and per-agent "autofixed" as true Auto-fix recoveries only', async () => {
    // The dashboard column says "Auto-fixed" — a fallback-only recovery must
    // not count. Pin the autofix_applied EXISTS guard in both queries.
    const captured: string[] = [];
    const { service } = makeService(async (sql) => {
      captured.push(sql);
      return [];
    });

    await service.getPerProviderStats({ tenantId: 't-1', range: '7d' });
    await service.getPerAgentStats({ tenantId: 't-1', range: '7d' });

    expect(captured).toHaveLength(2);
    for (const sql of captured) {
      expect(sql).toContain('autofixed');
      expect(sql).toContain('autofix_applied = true');
    }
  });

  it('exposes previous-window values for the split (trend support)', async () => {
    let call = 0;
    const { service } = makeService(async (sql) => {
      if (sql.includes('recovered_autofix')) {
        call++;
        return call === 1
          ? [{ total: 50, successes: 50, recovered: 10, recovered_autofix: 7 }] // current
          : [{ total: 40, successes: 38, recovered: 6, recovered_autofix: 2 }]; // previous
      }
      return [];
    });

    const stats = await service.getStats({ tenantId: 't-1', range: '24h' });

    expect(stats.recovered_by_autofix).toEqual({ value: 7, previous: 2 });
    expect(stats.recovered_by_fallback).toEqual({ value: 3, previous: 4 });
  });
});
