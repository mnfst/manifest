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
    setQueryRunner: jest.fn(),
    clone: jest.fn(),
    getQueryAndParameters: jest.fn().mockReturnValue(['SELECT r.id FROM requests r', []]),
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
    'setQueryRunner',
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
  it('reads request parents and unlinked attempts from one repeatable snapshot', async () => {
    const requestQb = makeQb();
    requestQb.clone.mockReturnValue(makeQb());
    const legacyCountQb = makeQb();
    const legacyDataQb = makeQb();
    const legacyBase = makeQb();
    legacyBase.clone.mockReturnValueOnce(legacyCountQb).mockReturnValueOnce(legacyDataQb);
    const runner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
    };
    const service = new MessagesQueryService(
      { createQueryBuilder: jest.fn(() => legacyBase), query: jest.fn() } as never,
      { find: jest.fn() } as never,
      { createQueryBuilder: jest.fn(() => requestQb), query: jest.fn() } as never,
      undefined,
      { createQueryRunner: jest.fn(() => runner) } as never,
    );

    await service.getMessages({
      tenantId: 'tenant-1',
      limit: 10,
      include_total: false,
      include_filter_options: false,
    });

    expect(runner.startTransaction).toHaveBeenCalledWith('REPEATABLE READ');
    expect(runner.query).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');
    expect(requestQb.setQueryRunner).toHaveBeenCalledWith(runner);
    expect(legacyCountQb.setQueryRunner).toHaveBeenCalledWith(runner);
    expect(legacyDataQb.setQueryRunner).toHaveBeenCalledWith(runner);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

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

  it('filters by connection with the legacy folds, OR-ing several connections', async () => {
    const requestQb = makeQb();
    requestQb.clone.mockReturnValue(makeQb());
    const legacyBase = makeQb();
    legacyBase.clone.mockReturnValueOnce(makeQb()).mockReturnValueOnce(makeQb());
    const tenantProviderFind = jest.fn().mockResolvedValue([
      { id: 'conn-1', provider: 'openai', auth_type: 'api_key', label: 'Default' },
      { id: 'conn-2', provider: 'openai', auth_type: 'subscription', label: 'Team' },
    ]);

    const service = new MessagesQueryService(
      {
        createQueryBuilder: jest.fn(() => legacyBase),
        query: jest.fn().mockResolvedValue([]),
      } as never,
      { find: jest.fn() } as never,
      { createQueryBuilder: jest.fn(() => requestQb) } as never,
      { find: tenantProviderFind } as never,
    );

    await service.getMessages({
      tenantId: 'tenant-1',
      limit: 10,
      connections: ['conn-1', 'conn-2'],
      include_total: false,
      include_filter_options: false,
    });

    // The lookup is tenant-scoped: another tenant's connection id resolves to nothing.
    expect(tenantProviderFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: 'tenant-1' }) }),
    );
    const clause = requestQb.andWhere.mock.calls
      .map((call) => String(call[0]))
      .find((c) => c.includes('connProvider0'));
    expect(clause).toBeDefined();
    // Both connections OR-ed inside ONE EXISTS over the request's attempts.
    expect(clause).toContain('EXISTS');
    expect(clause).toContain('connProvider1');
    expect(clause).toContain(' OR ');
    // Legacy folds: api_key matches NULL auth_type; orphan attempts fold by label.
    expect(clause).toContain('filtered_attempt.auth_type IS NULL');
    expect(clause).toContain(
      "LOWER(COALESCE(filtered_attempt.provider_key_label, 'Default')) = LOWER(:connLabel0)",
    );
    expect(clause).toContain('filtered_attempt.tenant_provider_id IS NULL');
  });

  it('matches nothing when the connections filter resolves to no owned connection', async () => {
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
      { find: jest.fn().mockResolvedValue([]) } as never,
    );

    await service.getMessages({
      tenantId: 'tenant-1',
      limit: 10,
      connections: ['someone-elses-conn'],
      include_total: false,
      include_filter_options: false,
    });

    const clauses = requestQb.andWhere.mock.calls.map((call) => String(call[0]));
    expect(clauses).toContain('1 = 0');
  });

  it('ORs several recovery-attempt kinds, scoped to the selected connections', async () => {
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
      {
        find: jest
          .fn()
          .mockResolvedValue([
            { id: 'conn-1', provider: 'openai', auth_type: 'api_key', label: 'Default' },
          ]),
      } as never,
    );

    await service.getMessages({
      tenantId: 'tenant-1',
      limit: 10,
      connections: ['conn-1'],
      triggers: ['autofix', 'fallback'],
      include_total: false,
      include_filter_options: false,
    });

    const clause = requestQb.andWhere.mock.calls
      .map((call) => String(call[0]))
      .find((c) => c.includes('trigger_attempt.autofix_applied'));
    expect(clause).toBeDefined();
    // Both kinds OR together...
    expect(clause).toContain('trigger_attempt.fallback_from_model IS NOT NULL');
    expect(clause).toContain(' OR ');
    // ...and each recovery attempt must be ON a selected connection.
    expect(clause).toContain('trigger_attempt.tenant_provider_id');
  });

  it('ANDs the attempt-status facets, scoped to the selected connections', async () => {
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
      {
        find: jest
          .fn()
          .mockResolvedValue([
            { id: 'conn-1', provider: 'openai', auth_type: 'api_key', label: 'Default' },
          ]),
      } as never,
    );

    await service.getMessages({
      tenantId: 'tenant-1',
      limit: 10,
      connections: ['conn-1'],
      attemptStatus: ['has_failed', 'has_succeeded'],
      include_total: false,
      include_filter_options: false,
    });

    const clauses = requestQb.andWhere.mock.calls.map((call) => String(call[0]));
    const failed = clauses.find((c) =>
      c.includes("outcome_attempt.status NOT IN ('ok', 'success')"),
    );
    const succeeded = clauses.find((c) =>
      c.includes("outcome_attempt.status IN ('ok', 'success')"),
    );
    // AND semantics: each facet is its own EXISTS condition...
    expect(failed).toBeDefined();
    expect(succeeded).toBeDefined();
    expect(failed).not.toBe(succeeded);
    expect(failed).toContain("outcome_attempt.status <> 'pending'");
    // ...and each attempt must be ON a selected connection.
    expect(failed).toContain('outcome_attempt.tenant_provider_id');
    expect(succeeded).toContain('outcome_attempt.tenant_provider_id');
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
      {
        createQueryBuilder: jest.fn(() => requestQb),
        query: jest.fn().mockResolvedValue([{ total: '7' }]),
      } as never,
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
      triggers: ['none'],
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
      clauses.filter((clause) => clause.includes('SELECT 1 FROM agent_messages filtered_attempt')),
    ).toHaveLength(1);
    expect(requestQb.having).toHaveBeenCalled();
    expect(requestQb.andHaving).toHaveBeenCalled();
    // The exact request total wraps the grouped query after cost HAVING.
    expect(requestQb.clone).toHaveBeenCalled();
    expect(requestCountQb.select).toHaveBeenCalledWith('r.id', 'id');
    expect(result.total_count).toBe(9);
    expect(result.items).toHaveLength(2);
    expect(result.next_cursor).toBeTruthy();
  });

  it('keeps the exact total when the requested page has no request rows', async () => {
    const requestQb = makeQb([]);
    requestQb.clone.mockReturnValue(makeQb());
    const legacyBase = makeQb();
    legacyBase.clone.mockReturnValueOnce(makeQb()).mockReturnValueOnce(makeQb());
    const service = new MessagesQueryService(
      {
        createQueryBuilder: jest.fn(() => legacyBase),
        query: jest.fn().mockResolvedValue([]),
      } as never,
      { find: jest.fn() } as never,
      {
        createQueryBuilder: jest.fn(() => requestQb),
        query: jest.fn().mockResolvedValue([{ total: '7' }]),
      } as never,
    );

    const result = await service.getMessages({
      tenantId: 'tenant-1',
      cursor: '2026-07-14T13:00:00Z|r-3',
      limit: 10,
      include_total: true,
      include_filter_options: false,
    });

    expect(result.total_count).toBe(7);
    expect(result.items).toEqual([]);
  });

  it.each([
    [
      {
        tenantId: null,
        status: 'ok' as const,
        origin: 'provider' as const,
        triggers: ['autofix' as const],
      },
    ],
    [
      {
        tenantId: 'tenant-1',
        status: 'error' as const,
        origin: 'transport' as const,
        triggers: ['fallback' as const],
      },
    ],
  ])('covers alternate request status, origin, and trigger filters', async (filters) => {
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
