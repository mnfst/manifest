import { AutofixStatsService } from './autofix-stats.service';

const queryBuilder = () => {
  const qb = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    leftJoin: jest.fn(),
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
    'leftJoin',
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
  const messageRepo = { createQueryBuilder: jest.fn() };
  const autofix = {
    hasAccess: jest.fn().mockResolvedValue(true),
    resolveEnabled: jest.fn((stored: boolean | null) => stored ?? true),
  };
  const requestVolume = {
    getDispositionTimeseries: jest.fn().mockResolvedValue([]),
    getDispositionTotals: jest
      .fn()
      .mockResolvedValue({ total: 0, success: 0, healed: 0, fallback: 0, error: 0 }),
    getVolumeByDimension: jest.fn().mockResolvedValue([]),
    getVolumeByProviderTimeseries: jest.fn().mockResolvedValue([]),
    getVolumeByAgentTimeseries: jest.fn().mockResolvedValue([]),
  };
  let service: AutofixStatsService;

  beforeEach(() => {
    jest.clearAllMocks();
    messageRepo.createQueryBuilder.mockReset();
    autofix.hasAccess.mockResolvedValue(true);
    autofix.resolveEnabled.mockImplementation((stored: boolean | null) => stored ?? true);
    requestVolume.getDispositionTimeseries.mockResolvedValue([]);
    requestVolume.getDispositionTotals.mockResolvedValue({
      total: 0,
      success: 0,
      healed: 0,
      fallback: 0,
      error: 0,
    });
    requestVolume.getVolumeByDimension.mockResolvedValue([]);
    service = new AutofixStatsService(
      agentRepo as never,
      messageRepo as never,
      autofix as never,
      requestVolume as never,
    );
  });

  it('returns unavailable status without a tenant or Auto-fix access', async () => {
    await expect(service.getWorkspaceStatus(null)).resolves.toEqual({
      available: false,
      any_enabled: false,
      enabled_agents: [],
    });

    autofix.hasAccess.mockResolvedValueOnce(false);
    await expect(service.getWorkspaceStatus('tenant')).resolves.toEqual({
      available: false,
      any_enabled: false,
      enabled_agents: [],
    });
    expect(autofix.hasAccess).toHaveBeenCalledWith('tenant');
    expect(agentRepo.find).not.toHaveBeenCalled();
  });

  it('returns effectively enabled agent names for an eligible cloud workspace', async () => {
    agentRepo.find.mockResolvedValue([
      { name: 'inherited', autofix_enabled: null },
      { name: 'disabled', autofix_enabled: false },
      { name: 'enabled', autofix_enabled: true },
    ]);
    await expect(service.getWorkspaceStatus('tenant')).resolves.toEqual({
      available: true,
      any_enabled: true,
      enabled_agents: ['inherited', 'enabled'],
    });
    expect(agentRepo.find).toHaveBeenCalledWith({
      where: { tenant_id: 'tenant', deleted_at: expect.anything(), is_playground: false },
      select: ['name', 'autofix_enabled'],
    });
  });

  it('keeps inherited agents disabled under the self-hosted default', async () => {
    autofix.resolveEnabled.mockImplementation((stored: boolean | null) => stored ?? false);
    agentRepo.find.mockResolvedValue([
      { name: 'inherited', autofix_enabled: null },
      { name: 'enabled', autofix_enabled: true },
    ]);

    await expect(service.getWorkspaceStatus('tenant')).resolves.toEqual({
      available: true,
      any_enabled: true,
      enabled_agents: ['enabled'],
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

  it('maps per-provider, per-agent and per-model reliability rows', async () => {
    // Provider and model tables live in the ATTEMPT world: every provider
    // call counts by its own outcome, no retry exclusion, no healing fields.
    const providerQb = queryBuilder();
    providerQb.getRawMany.mockResolvedValue([
      {
        provider: 'openai',
        auth_type: 'subscription',
        key_label: 'Default',
        attempts: '12',
        failed: '3',
        succeeded: '9',
      },
    ]);
    requestVolume.getVolumeByDimension.mockResolvedValue([
      {
        key: 'demo',
        requests: 8,
        failed: 2,
        healed: 1,
        fallback: 2,
        succeeded: 7,
      },
    ]);
    messageRepo.createQueryBuilder.mockReturnValueOnce(providerQb);

    await expect(
      service.getPerProviderStats({ tenantId: 'tenant', agentName: 'demo' }),
    ).resolves.toEqual([
      {
        provider: 'openai',
        auth_type: 'subscription',
        key_label: 'Default',
        attempts: 12,
        failed: 3,
        succeeded: 9,
      },
    ]);
    // Connection grain: grouped by provider + folded auth_type + folded label.
    const providerGroupSql = providerQb.addGroupBy.mock.calls.flat().join(' ');
    expect(providerGroupSql).toContain("COALESCE(at.auth_type, 'api_key')");
    expect(providerGroupSql).toContain("COALESCE(at.provider_key_label, 'Default')");
    const providerSql = providerQb.addSelect.mock.calls.flat().join(' ');
    // Canonical success and legacy NULL/ok remain compatible.
    expect(providerSql).toContain("at.status IN ('ok', 'success')");
    expect(providerSql).toContain("at.status <> 'pending'");
    // No retry exclusion: an auto-fix retry is a real provider call here.
    expect(providerQb.andWhere.mock.calls.flat()).not.toContain(
      "(at.autofix_role IS NULL OR at.autofix_role != 'retry')",
    );

    // The harness table stays in the REQUEST world (unchanged shape).
    await expect(service.getPerAgentStats({ tenantId: 'tenant' })).resolves.toEqual([
      { agent_name: 'demo', requests: 8, failed: 2, autofixed: 1, fallback_saves: 2, succeeded: 7 },
    ]);
    expect(requestVolume.getVolumeByDimension).toHaveBeenCalledWith('agent_name', {
      tenantId: 'tenant',
    });

    const modelQb = queryBuilder();
    modelQb.getRawMany.mockResolvedValue([
      { model: 'gpt-4o', attempts: '6', failed: '1', succeeded: '5' },
    ]);
    messageRepo.createQueryBuilder.mockReturnValueOnce(modelQb);
    await expect(
      service.getPerModelStats({ tenantId: 'tenant', agentName: 'demo' }),
    ).resolves.toEqual([{ model: 'gpt-4o', attempts: 6, failed: 1, succeeded: 5 }]);
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

  it('derives window counts from the request-level disposition totals', async () => {
    const internals = service as unknown as {
      queryWindow: (
        from: string,
        to: string,
        tenantId: string | null,
        agentName?: string,
      ) => Promise<unknown>;
    };
    // ONE definition: the KPI window reads the same reducer as the chart.
    requestVolume.getDispositionTotals.mockResolvedValue({
      total: 100,
      success: 70,
      healed: 4,
      fallback: 6,
      error: 20,
    });
    await expect(internals.queryWindow('from', 'to', 'tenant', 'demo')).resolves.toEqual({
      total: 100,
      successes: 80, // success + recovered by Auto-fix + recovered by fallback
      saves: 4, // autofix_status = retry_succeeded
      fallback_saves: 6,
      errors: 20,
      healed: 4,
      no_fix_found: 20,
      resolving: 0,
      ineffective: 0,
    });
    expect(requestVolume.getDispositionTotals).toHaveBeenCalledWith({
      tenantId: 'tenant',
      from: 'from',
      to: 'to',
      agentName: 'demo',
    });
    // No attempt-table scan and no sibling join anymore.
    expect(messageRepo.createQueryBuilder).not.toHaveBeenCalled();
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
    expect(qb.leftJoin).toHaveBeenCalled();
    expect(filterSql).toContain("r.autofix_status <> 'retry_succeeded'");
    expect(filterSql).toContain('FROM agent_messages sib');
    expect(filterSql).not.toContain('FROM provider_attempts sib');
  });
});
