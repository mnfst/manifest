import { AutofixAnalyticsController } from './autofix-analytics.controller';

describe('AutofixAnalyticsController', () => {
  const service = {
    getWorkspaceStatus: jest.fn(),
    getStats: jest.fn(),
    getTimeseries: jest.fn(),
    getPerAgentStats: jest.fn(),
    getPerProviderStats: jest.fn(),
  };
  const controller = new AutofixAnalyticsController(service as never);
  const ctx = { tenantId: 'tenant' } as never;

  beforeEach(() => jest.clearAllMocks());

  it('delegates every Auto-fix analytics route with tenant scope', async () => {
    service.getWorkspaceStatus.mockResolvedValue({ available: true });
    service.getStats.mockResolvedValue({ autofix_saves: { value: 1 } });
    service.getTimeseries.mockResolvedValue({ buckets: [] });
    service.getPerAgentStats.mockResolvedValue([]);
    service.getPerProviderStats.mockResolvedValue([]);

    await controller.getStatus(ctx);
    await controller.getStats({ range: '30d', agent_name: 'demo' }, ctx);
    await controller.getTimeseries(
      { range: '24h', agent_name: 'demo', by: 'autofix', failed_only: 'true' },
      ctx,
    );
    await controller.getPerAgent({ range: '7d' }, ctx);
    await controller.getPerProvider({ range: '90d', agent_name: 'demo' }, ctx);

    expect(service.getWorkspaceStatus).toHaveBeenCalledWith('tenant');
    expect(service.getStats).toHaveBeenCalledWith({
      tenantId: 'tenant',
      range: '30d',
      agentName: 'demo',
    });
    expect(service.getTimeseries).toHaveBeenCalledWith({
      tenantId: 'tenant',
      range: '24h',
      by: 'autofix',
      agentName: 'demo',
      failedOnly: true,
    });
    expect(service.getPerAgentStats).toHaveBeenCalledWith({ tenantId: 'tenant', range: '7d' });
    expect(service.getPerProviderStats).toHaveBeenCalledWith({
      tenantId: 'tenant',
      range: '90d',
      agentName: 'demo',
    });
  });

  it('treats non-true failed_only values as false', async () => {
    await controller.getTimeseries({ failed_only: 'false' }, ctx);
    expect(service.getTimeseries).toHaveBeenCalledWith({
      tenantId: 'tenant',
      range: undefined,
      by: undefined,
      agentName: undefined,
      failedOnly: false,
    });
  });
});
