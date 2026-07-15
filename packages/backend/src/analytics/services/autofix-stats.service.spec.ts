import { AutofixStatsService } from './autofix-stats.service';

const queryBuilder = () => {
  const qb = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    groupBy: jest.fn(),
    addGroupBy: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };
  for (const key of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'limit',
  ] as const) {
    qb[key].mockReturnValue(qb);
  }
  return qb;
};

describe('AutofixStatsService', () => {
  const agentRepo = { find: jest.fn() };
  const tenantRepo = { findOne: jest.fn() };
  const messageRepo = { createQueryBuilder: jest.fn() };
  const requestVolume = {
    getDispositionTimeseries: jest.fn().mockResolvedValue([]),
    getVolumeByDimension: jest.fn().mockResolvedValue([]),
    getVolumeByProviderTimeseries: jest.fn().mockResolvedValue([]),
    getVolumeByAgentTimeseries: jest.fn().mockResolvedValue([]),
  };
  let service: AutofixStatsService;

  beforeEach(() => {
    jest.clearAllMocks();
    requestVolume.getDispositionTimeseries.mockResolvedValue([]);
    requestVolume.getVolumeByDimension.mockResolvedValue([]);
    service = new AutofixStatsService(
      agentRepo as never,
      messageRepo as never,
      tenantRepo as never,
      requestVolume as never,
    );
  });

  it('returns unavailable status without a tenant or Auto-fix access', async () => {
    await expect(service.getWorkspaceStatus(null)).resolves.toEqual({
      available: false,
      any_enabled: false,
      enabled_agents: [],
    });

    tenantRepo.findOne.mockResolvedValue({
      autofix_access_granted_at: null,
      autofix_waitlist_at: null,
    });
    await expect(service.getWorkspaceStatus('tenant')).resolves.toEqual({
      available: false,
      any_enabled: false,
      enabled_agents: [],
    });
    expect(agentRepo.find).not.toHaveBeenCalled();
  });

  it('returns enabled agent names for an eligible workspace', async () => {
    tenantRepo.findOne.mockResolvedValue({
      autofix_access_granted_at: new Date(),
      autofix_waitlist_at: null,
    });
    agentRepo.find.mockResolvedValue([{ name: 'alpha' }, { name: 'beta' }]);
    await expect(service.getWorkspaceStatus('tenant')).resolves.toEqual({
      available: true,
      any_enabled: true,
      enabled_agents: ['alpha', 'beta'],
    });
  });

  it('computes Auto-fix-only stats for current and previous windows', async () => {
    const internals = service as unknown as {
      queryWindow: jest.Mock;
      queryNeedsAttention: jest.Mock;
    };
    internals.queryWindow = jest
      .fn()
      .mockResolvedValueOnce({
        total: 10,
        successes: 8,
        saves: 2,
        fallback_saves: 1,
        errors: 2,
        healed: 2,
        no_fix_found: 1,
        resolving: 1,
        ineffective: 0,
      })
      .mockResolvedValueOnce({
        total: 0,
        successes: 0,
        saves: 0,
        fallback_saves: 0,
        errors: 0,
        healed: 0,
        no_fix_found: 0,
        resolving: 0,
        ineffective: 0,
      });
    internals.queryNeedsAttention = jest.fn().mockResolvedValue([{ error_message: 'bad' }]);

    await expect(
      service.getStats({ tenantId: 'tenant', range: '30d', agentName: 'agent' }),
    ).resolves.toEqual({
      success_rate: { value: 0.8, previous: 0 },
      autofix_saves: { value: 2, previous: 0 },
      fallback_saves: { value: 1, previous: 0 },
      total_requests: { value: 10, previous: 0 },
      errors_remaining: { value: 2, previous: 0 },
      coverage: { rate: 0.5, previous_rate: 0 },
      dispositions: { healed: 2, no_fix_found: 1, resolving: 1, ineffective: 0 },
      needs_attention: [{ error_message: 'bad' }],
    });
  });

  it('maps per-provider and per-agent reliability rows', async () => {
    const providerQb = queryBuilder();
    providerQb.getRawMany.mockResolvedValue([
      {
        provider: 'openai',
        requests: '10',
        failed: '3',
        autofixed: '2',
        fallback_saves: '1',
        succeeded: '8',
      },
    ]);
    const agentQb = queryBuilder();
    agentQb.getRawMany.mockResolvedValue([
      {
        agent_name: 'demo',
        requests: '8',
        failed: '2',
        autofixed: '1',
        fallback_saves: '2',
        succeeded: '7',
      },
    ]);
    messageRepo.createQueryBuilder.mockReturnValueOnce(providerQb).mockReturnValueOnce(agentQb);

    await expect(
      service.getPerProviderStats({ tenantId: 'tenant', agentName: 'demo' }),
    ).resolves.toEqual([
      {
        provider: 'openai',
        requests: 10,
        failed: 3,
        autofixed: 2,
        fallback_saves: 1,
        succeeded: 8,
      },
    ]);
    await expect(service.getPerAgentStats({ tenantId: 'tenant' })).resolves.toEqual([
      { agent_name: 'demo', requests: 8, failed: 2, autofixed: 1, fallback_saves: 2, succeeded: 7 },
    ]);

    const modelQb = queryBuilder();
    modelQb.getRawMany.mockResolvedValue([
      {
        model: 'gpt-4o',
        requests: '6',
        failed: '1',
        autofixed: '1',
        fallback_saves: '1',
        succeeded: '5',
      },
    ]);
    messageRepo.createQueryBuilder.mockReturnValueOnce(modelQb);
    await expect(
      service.getPerModelStats({ tenantId: 'tenant', agentName: 'demo' }),
    ).resolves.toEqual([
      { model: 'gpt-4o', requests: 6, failed: 1, autofixed: 1, fallback_saves: 1, succeeded: 5 },
    ]);
    const modelSql = modelQb.addSelect.mock.calls.flat().join(' ');
    expect(modelSql).toContain('fallback_saves');
    expect(modelSql).toContain('succeeded');
    for (const qb of [providerQb, agentQb]) {
      const aggregateSql = qb.addSelect.mock.calls.flat().join(' ');
      expect(aggregateSql).toContain('FROM provider_attempts sib');
      expect(aggregateSql).not.toContain('FROM agent_messages sib');
    }
  });

  it('builds hourly failed-only timeseries and preserves disposition order', async () => {
    // #2511: the disposition dimension counts logical requests via the
    // request-volume service (terminal-attempt attribution), not attempts.
    requestVolume.getDispositionTimeseries.mockResolvedValue([
      { bucket: '2026-01-01 10:00:00', dim: 'error', count: '2' },
      { bucket: '2026-01-01 10:00:00', dim: 'success', count: '5' },
      { bucket: '2026-01-01 11:00:00', dim: 'success', count: '1' },
      { bucket: '2026-01-01 10:00:00', dim: null, count: '3' },
    ]);

    await expect(
      service.getTimeseries({
        tenantId: 'tenant',
        range: '24h',
        by: 'invalid',
        failedOnly: true,
      }),
    ).resolves.toEqual({
      range: '24h',
      by: 'disposition',
      keys: ['success', 'error', 'unknown'],
      buckets: [
        { bucket: '2026-01-01 10:00:00', counts: [5, 2, 3] },
        { bucket: '2026-01-01 11:00:00', counts: [1, 0, 0] },
      ],
    });
    expect(requestVolume.getDispositionTimeseries).toHaveBeenCalledWith({
      tenantId: 'tenant',
      range: '24h',
      hourly: true,
      agentName: undefined,
      failedOnly: true,
    });
    // The disposition path never scans attempts directly anymore.
    expect(messageRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it.each(['http_status', 'provider', 'error_kind', 'autofix'])(
    'supports the %s timeseries dimension',
    async (by) => {
      const qb = queryBuilder();
      qb.getRawMany.mockResolvedValue([
        { bucket: '2026-01-02', dim: 'zeta', count: '1' },
        { bucket: '2026-01-01', dim: 'alpha', count: '2' },
      ]);
      messageRepo.createQueryBuilder.mockReturnValue(qb);
      const result = await service.getTimeseries({ tenantId: null, range: '7d', by });
      expect(result.keys).toEqual(['alpha', 'zeta']);
      expect(result.buckets[0]!.bucket).toBe('2026-01-01');
      expect(qb.addSelect.mock.calls[0]![0]).toEqual(expect.any(String));
    },
  );

  it('derives coherent window counts from query results and zero defaults', async () => {
    const internals = service as unknown as {
      queryWindow: (
        from: string,
        to: string,
        tenantId: string | null,
        agentName?: string,
      ) => Promise<unknown>;
    };
    const qb = queryBuilder();
    qb.getRawOne.mockResolvedValue({ total: '7', successes: '5', saves: '1', fallback_saves: '2' });
    messageRepo.createQueryBuilder.mockReturnValueOnce(qb);
    await expect(internals.queryWindow('from', 'to', 'tenant', 'demo')).resolves.toEqual({
      total: 7,
      successes: 5,
      saves: 1,
      fallback_saves: 2,
      errors: 2,
      healed: 1,
      no_fix_found: 1,
      resolving: 0,
      ineffective: 0,
    });

    const emptyQb = queryBuilder();
    emptyQb.getRawOne.mockResolvedValue(undefined);
    messageRepo.createQueryBuilder.mockReturnValueOnce(emptyQb);
    await expect(internals.queryWindow('from', 'to', null)).resolves.toEqual({
      total: 0,
      successes: 0,
      saves: 0,
      fallback_saves: 0,
      errors: 0,
      healed: 0,
      no_fix_found: 0,
      resolving: 0,
      ineffective: 0,
    });
    const aggregateSql = qb.addSelect.mock.calls.flat().join(' ');
    expect(aggregateSql).toContain('FROM provider_attempts sib');
    expect(aggregateSql).not.toContain('FROM agent_messages sib');
  });

  it('maps needs-attention failures and defaults nullable fields', async () => {
    const internals = service as unknown as {
      queryNeedsAttention: (
        cutoff: string,
        tenantId: string | null,
        agentName?: string,
      ) => Promise<unknown>;
    };
    const qb = queryBuilder();
    qb.getRawMany.mockResolvedValue([
      {
        error_message: null,
        provider: 'openai',
        model: 'gpt',
        count: '4',
        phoenix_issue_id: null,
      },
    ]);
    messageRepo.createQueryBuilder.mockReturnValue(qb);
    await expect(internals.queryNeedsAttention('cutoff', 'tenant', 'demo')).resolves.toEqual([
      {
        error_message: '',
        provider: 'openai',
        model: 'gpt',
        count: 4,
        phoenix_issue_id: null,
      },
    ]);
    const filterSql = qb.andWhere.mock.calls.flat().join(' ');
    expect(filterSql).toContain('FROM provider_attempts sib');
    expect(filterSql).not.toContain('FROM agent_messages sib');
  });
});
