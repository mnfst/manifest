import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';
import { OverviewController } from './overview.controller';
import { AggregationService } from '../services/aggregation.service';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { CacheInvalidationService } from '../../common/services/cache-invalidation.service';

function mockAggregation(): Record<string, jest.Mock> {
  return {
    getTokenSummary: jest.fn().mockResolvedValue({
      tokens_today: { value: 1000, trend_pct: 10 },
      input_tokens: 600,
      output_tokens: 400,
    }),
    getCostSummary: jest.fn().mockResolvedValue({ value: 5.0, trend_pct: 20 }),
    getMessageCount: jest.fn().mockResolvedValue({ value: 50, trend_pct: 5 }),
    hasAnyData: jest.fn().mockResolvedValue(true),
  };
}

function mockTimeseries(): Record<string, jest.Mock> {
  return {
    getCostByModel: jest.fn().mockResolvedValue([]),
    getRecentActivity: jest.fn().mockResolvedValue([]),
    getHourlyTokens: jest.fn().mockResolvedValue([]),
    getDailyTokens: jest.fn().mockResolvedValue([]),
    getHourlyCosts: jest.fn().mockResolvedValue([]),
    getDailyCosts: jest.fn().mockResolvedValue([]),
    getHourlyMessages: jest.fn().mockResolvedValue([]),
    getDailyMessages: jest.fn().mockResolvedValue([]),
    getActiveSkills: jest.fn().mockResolvedValue([]),
  };
}

describe('OverviewController', () => {
  let controller: OverviewController;
  let agg: Record<string, jest.Mock>;
  let ts: Record<string, jest.Mock>;

  beforeEach(async () => {
    agg = mockAggregation();
    ts = mockTimeseries();

    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [OverviewController],
      providers: [
        { provide: AggregationService, useValue: agg },
        { provide: TimeseriesQueriesService, useValue: ts },
        { provide: CacheInvalidationService, useValue: { trackKey: jest.fn() } },
      ],
    }).compile();

    controller = module.get<OverviewController>(OverviewController);
  });

  it('returns overview with hourly data for 24h range', async () => {
    const user = { id: 'u1' };
    const result = await controller.getOverview({ range: '24h' }, user as never);

    expect(result.summary.tokens_today).toBeDefined();
    expect(result.summary.cost_today).toBeDefined();
    expect(result.summary.messages).toBeDefined();
    expect(ts.getHourlyTokens).toHaveBeenCalledWith('24h', 'u1', undefined);
    expect(ts.getDailyTokens).not.toHaveBeenCalled();
  });

  it('returns overview with daily data for 7d range', async () => {
    const user = { id: 'u1' };
    const result = await controller.getOverview({ range: '7d' }, user as never);

    expect(result.token_usage).toBeDefined();
    expect(ts.getDailyTokens).toHaveBeenCalledWith('7d', 'u1', undefined);
    expect(ts.getHourlyTokens).not.toHaveBeenCalled();
  });

  it('defaults range to 24h when not specified', async () => {
    const user = { id: 'u1' };
    await controller.getOverview({}, user as never);

    expect(agg.getTokenSummary).toHaveBeenCalledWith('24h', 'u1', undefined);
  });

  it('passes agent_name to all aggregation calls', async () => {
    const user = { id: 'u1' };
    await controller.getOverview({ range: '24h', agent_name: 'bot-1' }, user as never);

    expect(agg.getTokenSummary).toHaveBeenCalledWith('24h', 'u1', 'bot-1');
    expect(agg.getCostSummary).toHaveBeenCalledWith('24h', 'u1', 'bot-1');
    expect(agg.getMessageCount).toHaveBeenCalledWith('24h', 'u1', 'bot-1');
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
});
