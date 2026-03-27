import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';
import { OverviewController } from './overview.controller';
import { AggregationService } from '../services/aggregation.service';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import { ProviderService } from '../../routing/routing-core/provider.service';
import { ResolveAgentService } from '../../routing/routing-core/resolve-agent.service';

function mockAggregation(): Record<string, jest.Mock> {
  return {
    getSummaryMetrics: jest.fn().mockResolvedValue({
      tokens: {
        tokens_today: { value: 1000, trend_pct: 10, sub_values: { input: 600, output: 400 } },
        input_tokens: 600,
        output_tokens: 400,
      },
      cost: { value: 5.0, trend_pct: 20 },
      messages: { value: 50, trend_pct: 5 },
    }),
    hasAnyData: jest.fn().mockResolvedValue(true),
  };
}

function mockTimeseries(): Record<string, jest.Mock> {
  return {
    getTimeseries: jest.fn().mockResolvedValue({
      tokenUsage: [],
      costUsage: [],
      messageUsage: [],
    }),
    getCostByModel: jest.fn().mockResolvedValue([]),
    getRecentActivity: jest.fn().mockResolvedValue([]),
    getActiveSkills: jest.fn().mockResolvedValue([]),
  };
}

describe('OverviewController', () => {
  let controller: OverviewController;
  let agg: Record<string, jest.Mock>;
  let ts: Record<string, jest.Mock>;
  let mockTenantResolve: jest.Mock;
  let mockResolveAgent: jest.Mock;
  let mockGetProviders: jest.Mock;

  beforeEach(async () => {
    agg = mockAggregation();
    ts = mockTimeseries();
    mockTenantResolve = jest.fn().mockResolvedValue('tenant-123');
    mockResolveAgent = jest.fn().mockResolvedValue({ id: 'agent-uuid-1' });
    mockGetProviders = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [OverviewController],
      providers: [
        { provide: AggregationService, useValue: agg },
        { provide: TimeseriesQueriesService, useValue: ts },
        { provide: TenantCacheService, useValue: { resolve: mockTenantResolve } },
        { provide: ProviderService, useValue: { getProviders: mockGetProviders } },
        { provide: ResolveAgentService, useValue: { resolve: mockResolveAgent } },
      ],
    }).compile();

    controller = module.get<OverviewController>(OverviewController);
  });

  it('returns overview with hourly timeseries for 24h range', async () => {
    const user = { id: 'u1' };
    const result = await controller.getOverview({ range: '24h' }, user as never);

    expect(result.summary.tokens_today).toBeDefined();
    expect(result.summary.cost_today).toBeDefined();
    expect(result.summary.messages).toBeDefined();
    expect(ts.getTimeseries).toHaveBeenCalledWith('24h', 'u1', true, 'tenant-123', undefined);
  });

  it('returns overview with daily timeseries for 7d range', async () => {
    const user = { id: 'u1' };
    const result = await controller.getOverview({ range: '7d' }, user as never);

    expect(result.token_usage).toBeDefined();
    expect(ts.getTimeseries).toHaveBeenCalledWith('7d', 'u1', false, 'tenant-123', undefined);
  });

  it('defaults range to 24h when not specified', async () => {
    const user = { id: 'u1' };
    await controller.getOverview({}, user as never);

    expect(agg.getSummaryMetrics).toHaveBeenCalledWith('24h', 'u1', 'tenant-123', undefined);
  });

  it('passes agent_name and tenantId to all calls', async () => {
    const user = { id: 'u1' };
    await controller.getOverview({ range: '24h', agent_name: 'bot-1' }, user as never);

    expect(agg.getSummaryMetrics).toHaveBeenCalledWith('24h', 'u1', 'tenant-123', 'bot-1');
    expect(ts.getTimeseries).toHaveBeenCalledWith('24h', 'u1', true, 'tenant-123', 'bot-1');
    expect(ts.getCostByModel).toHaveBeenCalledWith('24h', 'u1', 'bot-1', 'tenant-123');
    expect(ts.getRecentActivity).toHaveBeenCalledWith('24h', 'u1', 5, 'bot-1', 'tenant-123');
    expect(ts.getActiveSkills).toHaveBeenCalledWith('24h', 'u1', 'bot-1', 'tenant-123');
    expect(agg.hasAnyData).toHaveBeenCalledWith('u1', 'bot-1', 'tenant-123');
  });

  it('includes services_hit placeholder in summary', async () => {
    const user = { id: 'u1' };
    const result = await controller.getOverview({ range: '24h' }, user as never);

    expect(result.summary.services_hit).toEqual({ total: 0, healthy: 0, issues: 0 });
  });

  it('includes has_data boolean in response', async () => {
    const user = { id: 'u1' };
    const result = await controller.getOverview({ range: '24h' }, user as never);

    expect(result.has_data).toBe(true);
  });

  it('returns has_data false when no data exists', async () => {
    agg.hasAnyData.mockResolvedValueOnce(false);
    const user = { id: 'u1' };
    const result = await controller.getOverview({ range: '24h' }, user as never);

    expect(result.has_data).toBe(false);
  });

  it('resolves tenant once and passes to all services', async () => {
    const user = { id: 'u1' };
    await controller.getOverview({ range: '24h' }, user as never);

    expect(mockTenantResolve).toHaveBeenCalledTimes(1);
    expect(mockTenantResolve).toHaveBeenCalledWith('u1');
  });

  it('passes undefined tenantId when tenant not found', async () => {
    mockTenantResolve.mockResolvedValueOnce(null);
    const user = { id: 'u1' };
    await controller.getOverview({ range: '24h' }, user as never);

    expect(agg.getSummaryMetrics).toHaveBeenCalledWith('24h', 'u1', undefined, undefined);
  });

  it('returns has_providers true when agent has active providers', async () => {
    mockGetProviders.mockResolvedValueOnce([{ is_active: true }]);
    const user = { id: 'u1' };
    const result = await controller.getOverview(
      { range: '24h', agent_name: 'bot-1' },
      user as never,
    );

    expect(result.has_providers).toBe(true);
    expect(mockResolveAgent).toHaveBeenCalledWith('u1', 'bot-1');
    expect(mockGetProviders).toHaveBeenCalledWith('agent-uuid-1');
  });

  it('returns has_providers false when no providers exist', async () => {
    const user = { id: 'u1' };
    const result = await controller.getOverview(
      { range: '24h', agent_name: 'bot-1' },
      user as never,
    );

    expect(result.has_providers).toBe(false);
  });

  it('returns has_providers false when agent_name is not provided', async () => {
    const user = { id: 'u1' };
    const result = await controller.getOverview({ range: '24h' }, user as never);

    expect(result.has_providers).toBe(false);
    expect(mockResolveAgent).not.toHaveBeenCalled();
  });

  it('returns has_providers false when agent resolution fails', async () => {
    mockResolveAgent.mockRejectedValueOnce(new Error('Not found'));
    const user = { id: 'u1' };
    const result = await controller.getOverview(
      { range: '24h', agent_name: 'missing-agent' },
      user as never,
    );

    expect(result.has_providers).toBe(false);
  });

  it('returns has_providers false when all providers are inactive', async () => {
    mockGetProviders.mockResolvedValueOnce([{ is_active: false }, { is_active: false }]);
    const user = { id: 'u1' };
    const result = await controller.getOverview(
      { range: '24h', agent_name: 'bot-1' },
      user as never,
    );

    expect(result.has_providers).toBe(false);
  });
});
