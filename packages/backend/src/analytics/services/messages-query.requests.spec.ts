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
  ]) {
    qb[name].mockReturnValue(qb);
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
});
