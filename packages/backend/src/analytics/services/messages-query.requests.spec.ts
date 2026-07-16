import { MessagesQueryService } from './messages-query.service';

function makeQb(rows: Array<Record<string, unknown>> = []) {
  const qb: Record<string, jest.Mock> = {
    leftJoin: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orWhere: jest.fn(),
    groupBy: jest.fn(),
    having: jest.fn(),
    andHaving: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    limit: jest.fn(),
    distinct: jest.fn(),
    clone: jest.fn(),
    getRawOne: jest.fn().mockResolvedValue({ total: 0 }),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
  for (const name of [
    'leftJoin',
    'select',
    'addSelect',
    'where',
    'andWhere',
    'orWhere',
    'groupBy',
    'having',
    'andHaving',
    'orderBy',
    'addOrderBy',
    'limit',
    'distinct',
  ]) {
    qb[name].mockReturnValue(qb);
  }
  for (const name of ['andWhere', 'orWhere']) {
    qb[name].mockImplementation((clause: { whereFactory?: (builder: unknown) => void }) => {
      clause?.whereFactory?.(qb);
      return qb;
    });
  }
  return qb;
}

describe('MessagesQueryService request-first queries', () => {
  it('filters by matching attempts without truncating the request rollup', async () => {
    const requestRows = [
      { id: 'request-1', timestamp: new Date('2026-07-14T10:00:00Z'), attempt_count: 2 },
    ];
    const legacyRows = [{ id: 'legacy-1', timestamp: '2026-07-14T11:00:00Z', attempt_count: 1 }];
    const requestQb = makeQb(requestRows);
    requestQb.clone.mockReturnValue(makeQb());
    const legacyBase = makeQb();
    legacyBase.clone.mockReturnValueOnce(makeQb()).mockReturnValueOnce(makeQb(legacyRows));

    const service = new MessagesQueryService(
      {
        createQueryBuilder: jest.fn(() => legacyBase),
        query: jest.fn().mockResolvedValue([]),
      } as never,
      { find: jest.fn() } as never,
      { createQueryBuilder: jest.fn(() => requestQb) } as never,
    );

    const result = await service.getMessages({
      tenantId: 'tenant-1',
      limit: 10,
      provider: 'anthropic',
      include_total: false,
      include_filter_options: false,
    });

    const requestClauses = requestQb.andWhere.mock.calls.map((call) => String(call[0]));
    expect(requestClauses).toContainEqual(
      expect.stringContaining('filtered_attempt.provider = :requestProvider'),
    );
    expect(requestClauses).not.toContain('at.provider = :requestProvider');
    expect(result.items.map((row) => row.id)).toEqual(['legacy-1', 'request-1']);
  });

  it('uses tenant-scoped id-or-name Playground exclusion for request rows', async () => {
    const requestQb = makeQb();
    requestQb.clone.mockReturnValue(makeQb());
    const legacyBase = makeQb();
    legacyBase.clone.mockReturnValueOnce(makeQb()).mockReturnValueOnce(makeQb());
    const service = new MessagesQueryService(
      { createQueryBuilder: jest.fn(() => legacyBase) } as never,
      { find: jest.fn() } as never,
      { createQueryBuilder: jest.fn(() => requestQb) } as never,
    );

    await service.getMessages({
      tenantId: 'tenant-1',
      limit: 10,
      exclude_playground: true,
      include_total: false,
      include_filter_options: false,
    });

    expect(requestQb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('playag.name = r.agent_name'),
    );
  });

  it('applies the complete request filter set, pagination, costs, and exact totals', async () => {
    const requestRows = [
      { id: 'r-2', timestamp: '2026-07-14T12:00:00Z' },
      { id: 'r-1', timestamp: '2026-07-14T12:00:00Z' },
    ];
    const requestQb = makeQb(requestRows);
    const requestCountQb = makeQb();
    requestCountQb.getRawOne.mockResolvedValue({ total: '7' });
    requestQb.clone.mockReturnValue(requestCountQb);
    const legacyBase = makeQb();
    const legacyCountQb = makeQb();
    legacyCountQb.getRawOne.mockResolvedValue({ total: '2' });
    const legacyDataQb = makeQb([{ id: 'legacy', timestamp: '2026-07-14T10:00:00Z' }]);
    legacyBase.clone.mockReturnValueOnce(legacyCountQb).mockReturnValueOnce(legacyDataQb);
    const service = new MessagesQueryService(
      {
        createQueryBuilder: jest.fn(() => legacyBase),
        query: jest.fn().mockResolvedValue([]),
      } as never,
      { find: jest.fn() } as never,
      { createQueryBuilder: jest.fn(() => requestQb) } as never,
    );

    const result = await service.getMessages({
      tenantId: 'tenant-1',
      range: '24h',
      agent_name: 'agent-1',
      provider: 'openai',
      service_type: 'agent',
      status: 'failed',
      origin: 'manifest',
      error_class: 'rate_limit',
      routing_tier: 'balanced',
      specificity_category: 'specific',
      header_tier_id: 'tier-1',
      trigger: 'none',
      cursor: '2026-07-14T13:00:00Z|r-3',
      cost_min: 1,
      cost_max: 10,
      limit: 2,
      include_total: true,
      include_filter_options: false,
      exclude_playground: true,
    });

    const clauses = requestQb.andWhere.mock.calls.map((call) => String(call[0]));
    expect(clauses).toEqual(
      expect.arrayContaining([
        expect.stringContaining("r.status NOT IN ('ok', 'success')"),
        expect.stringContaining("r.error_origin IN ('config', 'policy', 'internal', 'request')"),
        expect.stringContaining('filtered_attempt.service_type = :requestServiceType'),
        expect.stringContaining('filtered_attempt.routing_tier = :requestTier'),
        expect.stringContaining('filtered_attempt.specificity_category = :requestSpecificity'),
        expect.stringContaining('filtered_attempt.header_tier_id = :requestHeaderTier'),
        expect.stringContaining('NOT EXISTS'),
      ]),
    );
    const combinedAttemptClause = clauses.find(
      (clause) =>
        clause.includes('filtered_attempt.provider = :requestProvider') &&
        clause.includes('filtered_attempt.service_type = :requestServiceType'),
    );
    expect(combinedAttemptClause).toEqual(
      expect.stringContaining('filtered_attempt.routing_tier = :requestTier'),
    );
    expect(
      clauses.filter((clause) =>
        clause.includes('SELECT 1 FROM provider_attempts filtered_attempt'),
      ),
    ).toHaveLength(1);
    expect(requestQb.having).toHaveBeenCalled();
    expect(requestQb.andHaving).toHaveBeenCalled();
    expect(result.total_count).toBe(9);
    expect(result.items).toHaveLength(2);
    expect(result.next_cursor).toBeTruthy();
  });

  it.each([
    [{ tenantId: null, status: 'ok', origin: 'provider', trigger: 'autofix' }],
    [{ tenantId: 'tenant-1', status: 'error', origin: 'transport', trigger: 'fallback' }],
  ] as const)('covers alternate request status, origin, and trigger filters', async (filters) => {
    const requestQb = makeQb();
    requestQb.clone.mockReturnValue(makeQb());
    const legacyBase = makeQb();
    legacyBase.clone.mockReturnValueOnce(makeQb()).mockReturnValueOnce(makeQb());
    const service = new MessagesQueryService(
      {
        createQueryBuilder: jest.fn(() => legacyBase),
        query: jest.fn().mockResolvedValue([]),
      } as never,
      { find: jest.fn() } as never,
      { createQueryBuilder: jest.fn(() => requestQb) } as never,
    );

    await service.getMessages({
      ...filters,
      limit: 10,
      include_total: false,
      include_filter_options: false,
    });

    expect(requestQb.andWhere).toHaveBeenCalled();
  });
});
