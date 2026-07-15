import { AttemptStatsService } from './attempt-stats.service';
import { EXCLUDE_PLAYGROUND_AGENTS_PREDICATE } from './query-helpers';

function mockQueryBuilder(options: { rawOne?: unknown; rawMany?: unknown[] } = {}) {
  const qb = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    groupBy: jest.fn(),
    orderBy: jest.fn(),
    getRawOne: jest.fn().mockResolvedValue(options.rawOne),
    getRawMany: jest.fn().mockResolvedValue(options.rawMany ?? []),
  };
  for (const method of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'orderBy',
  ] as const) {
    qb[method].mockReturnValue(qb);
  }
  return qb;
}

function makeService(qbs: unknown[]) {
  const repo = { createQueryBuilder: jest.fn().mockImplementation(() => qbs.shift()) };
  return new AttemptStatsService(repo as never);
}

describe('AttemptStatsService', () => {
  it('returns current and previous attempt and fallback totals', async () => {
    const current = mockQueryBuilder({
      rawOne: { attempts: '8', fallbacked_attempts: '3' },
    });
    const previous = mockQueryBuilder({
      rawOne: { attempts: '5', fallbacked_attempts: '1' },
    });
    const service = makeService([current, previous]);

    await expect(
      service.getStats({ tenantId: 'tenant-1', range: '7d', agentName: 'bot-1' }),
    ).resolves.toEqual({
      total_attempts: { value: 8, previous: 5 },
      fallbacked_attempts: { value: 3, previous: 1 },
    });
    expect(current.addSelect).toHaveBeenCalledWith(
      'COUNT(*) FILTER (WHERE at.fallback_from_model IS NOT NULL)',
      'fallbacked_attempts',
    );
    expect(previous.andWhere).toHaveBeenCalledWith('at.timestamp < :to', {
      to: expect.any(String),
    });
    for (const qb of [current, previous]) {
      expect(qb.andWhere).toHaveBeenCalledWith('at.tenant_id = :tenantId', {
        tenantId: 'tenant-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(EXCLUDE_PLAYGROUND_AGENTS_PREDICATE);
      expect(
        qb.andWhere.mock.calls.some(([clause]) => String(clause).includes('liveAgentName')),
      ).toBe(true);
      expect(qb.addSelect.mock.calls.flat()).not.toContain('autofix_role');
    }
  });

  it('defaults to seven days and returns zeros without a tenant', async () => {
    const current = mockQueryBuilder();
    const previous = mockQueryBuilder();
    const service = makeService([current, previous]);

    await expect(service.getStats({ tenantId: null })).resolves.toEqual({
      total_attempts: { value: 0, previous: 0 },
      fallbacked_attempts: { value: 0, previous: 0 },
    });
    expect(current.andWhere).toHaveBeenCalledWith('1 = 0');
    expect(previous.andWhere).toHaveBeenCalledWith('1 = 0');
  });

  it('returns daily pivoted buckets in the #2485 timeseries shape', async () => {
    const qb = mockQueryBuilder({
      rawMany: [
        { bucket: '2026-07-14', attempts: '4', fallbacked_attempts: '1' },
        { bucket: '2026-07-15', attempts: '2', fallbacked_attempts: null },
      ],
    });
    const service = makeService([qb]);

    await expect(service.getTimeseries({ tenantId: 'tenant-1', range: '7d' })).resolves.toEqual({
      range: '7d',
      by: 'metric',
      keys: ['total_attempts', 'fallbacked_attempts'],
      buckets: [
        { bucket: '2026-07-14', counts: [4, 1] },
        { bucket: '2026-07-15', counts: [2, 0] },
      ],
    });
    expect(qb.select.mock.calls[0][0]).toContain('YYYY-MM-DD');
  });

  it('uses hourly buckets and forwards live-agent scoping', async () => {
    const qb = mockQueryBuilder();
    const service = makeService([qb]);

    const result = await service.getTimeseries({
      tenantId: 'tenant-1',
      range: '24h',
      agentName: 'bot-1',
    });

    expect(result.buckets).toEqual([]);
    expect(qb.select.mock.calls[0][0]).toContain("date_trunc('hour'");
    expect(
      qb.andWhere.mock.calls.some(([clause]) => String(clause).includes('liveAgentName')),
    ).toBe(true);
  });
});
