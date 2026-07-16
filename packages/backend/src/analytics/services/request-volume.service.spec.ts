import { RequestVolumeService } from './request-volume.service';

describe('RequestVolumeService (#2511 request-level volume)', () => {
  const messageRepo = { query: jest.fn() };
  let service: RequestVolumeService;

  beforeEach(() => {
    jest.clearAllMocks();
    messageRepo.query.mockResolvedValue([]);
    service = new RequestVolumeService(messageRepo as never);
  });

  const lastSql = (): string => messageRepo.query.mock.calls.at(-1)![0] as string;
  const lastParams = (): unknown[] => messageRepo.query.mock.calls.at(-1)![1] as unknown[];

  it('reduces to one row per request via the terminal attempt', async () => {
    await service.getDispositionTimeseries({
      tenantId: 't1',
      range: '7d',
      hourly: false,
    });
    const sql = lastSql();
    // One row per logical request.
    expect(sql).toContain('DISTINCT ON (r.id)');
    // The Requests list's ranking: ok wins, else the terminal failure.
    expect(sql).toContain("WHEN pa.status = 'ok' THEN 3");
    expect(sql).toContain("pa.status NOT IN ('fallback_error', 'auto_fixed') THEN 2");
    // In-flight requests have no outcome to chart.
    expect(sql).toContain("r.status <> 'pending'");
    // Unlinked legacy attempts stay in the universe (KPI parity).
    expect(sql).toContain('pa.request_id IS NULL');
    // Playground traffic excluded on both branches.
    expect(sql).toContain('playag.is_playground = true');
    expect(lastParams()).toHaveLength(2);
    expect(lastParams()[0]).toBe('t1');
  });

  it('maps dispositions from how the request CONCLUDED, one count each', async () => {
    await service.getDispositionTimeseries({ tenantId: 't1', range: '24h', hourly: true });
    const sql = lastSql();
    // Method is the request-level Auto-fix outcome; a rescued request counts once.
    expect(sql).toContain(
      "WHEN t.request_status = 'ok' AND t.autofix_status = 'retry_succeeded' THEN 'healed'",
    );
    expect(sql).toContain('r.autofix_status');
    expect(sql).toContain(
      "WHEN t.request_status = 'ok' AND t.fallback_from_model IS NOT NULL THEN 'fallback'",
    );
    expect(sql).toContain("WHEN t.request_status = 'ok' THEN 'success'");
    expect(sql).toContain("ELSE 'error'");
    // Hourly bucket on the request's own timestamp.
    expect(sql).toContain('t.ts');
  });

  it('applies failedOnly as a terminal-error filter', async () => {
    await service.getDispositionTimeseries({
      tenantId: 't1',
      range: '24h',
      hourly: true,
      failedOnly: true,
    });
    expect(lastSql()).toContain("= 'error'");
  });

  it('scopes to the live agent when agentName is provided', async () => {
    await service.getDispositionTimeseries({
      tenantId: 't1',
      range: '7d',
      hourly: false,
      agentName: 'demo-agent',
    });
    const sql = lastSql();
    expect(sql).toContain('deleted_at IS NULL');
    expect(lastParams()).toEqual(['t1', expect.any(String), 'demo-agent']);
  });

  it('keys the harness volume by agent name', async () => {
    await service.getVolumeByAgentTimeseries('24h', 't1', true);
    const sql = lastSql();
    expect(sql).toContain("COALESCE(t.agent_name, 'Unknown') AS agent_name");
    expect(sql).toContain('AS hour');
  });

  it('computes per-dimension request totals with terminal outcomes', async () => {
    messageRepo.query.mockResolvedValue([
      { key: 'openai', requests: '10', failed: '2', succeeded: '8' },
    ]);
    const rows = await service.getVolumeByDimension('provider', { tenantId: 't1', range: '7d' });
    expect(rows).toEqual([{ key: 'openai', requests: 10, failed: 2, succeeded: 8 }]);
    const sql = lastSql();
    // The trio fold: custom:<uuid> providers group as 'custom'.
    expect(sql).toContain("THEN 'custom'");
    expect(sql).toContain("FILTER (WHERE t.request_status <> 'ok')");
    expect(sql).toContain('t.provider IS NOT NULL');
  });

  it('scopes to one connection by terminal attribution', async () => {
    // Preferred: the exact tenant_providers id.
    await service.getDispositionTimeseries({
      tenantId: 't1',
      range: '7d',
      hourly: false,
      connection: { tenantProviderId: 'conn-1', provider: 'openai', authType: 'api_key' },
    });
    expect(lastSql()).toContain('t.tenant_provider_id = $3');
    expect(lastParams()).toEqual(['t1', expect.any(String), 'conn-1']);

    // Fallback: the (provider, auth_type, label) tuple with the legacy fold.
    await service.getDispositionTimeseries({
      tenantId: 't1',
      range: '7d',
      hourly: false,
      connection: { provider: 'openai', authType: 'api_key', label: 'Default' },
    });
    const sql = lastSql();
    expect(sql).toContain('t.provider = $3');
    expect(sql).toContain('t.auth_type = $4');
    expect(sql).toContain("LOWER(COALESCE(t.provider_key_label, 'Default')) = LOWER($5)");
    expect(lastParams()).toEqual(['t1', expect.any(String), 'openai', 'api_key', 'Default']);
  });

  it('returns empty without a tenant, never querying', async () => {
    await expect(
      service.getDispositionTimeseries({ tenantId: null, range: '7d', hourly: false }),
    ).resolves.toEqual([]);
    await expect(service.getVolumeByAgentTimeseries('7d', null, false)).resolves.toEqual([]);
    await expect(service.getVolumeByDimension('model', { tenantId: null })).resolves.toEqual([]);
    expect(messageRepo.query).not.toHaveBeenCalled();
  });
});
