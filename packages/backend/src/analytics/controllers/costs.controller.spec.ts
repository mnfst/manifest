import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';
import { CostsController } from './costs.controller';
import { AggregationService } from '../services/aggregation.service';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';

describe('CostsController', () => {
  let controller: CostsController;
  let mockGetPreviousCostTotal: jest.Mock;
  let mockGetDailyCosts: jest.Mock;
  let mockGetHourlyCosts: jest.Mock;
  let mockGetCostByModel: jest.Mock;

  beforeEach(async () => {
    mockGetPreviousCostTotal = jest.fn().mockResolvedValue(10);
    mockGetDailyCosts = jest.fn().mockResolvedValue([]);
    mockGetHourlyCosts = jest.fn().mockResolvedValue([{ hour: '2026-02-16T10:00:00', cost: 12.5 }]);
    mockGetCostByModel = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [CostsController],
      providers: [
        {
          provide: AggregationService,
          useValue: { getPreviousCostTotal: mockGetPreviousCostTotal },
        },
        {
          provide: TimeseriesQueriesService,
          useValue: {
            getDailyCosts: mockGetDailyCosts,
            getHourlyCosts: mockGetHourlyCosts,
            getCostByModel: mockGetCostByModel,
          },
        },
      ],
    }).compile();

    controller = module.get<CostsController>(CostsController);
  });

  it('returns cost summary derived from hourly data with trend', async () => {
    const user = { id: 'u1' };
    const result = await controller.getCosts({ range: '7d' }, user as never);

    expect(result.summary.weekly_cost.value).toBe(12.5);
    expect(result.summary.weekly_cost.trend_pct).toBe(25);
    expect(result.daily).toBeDefined();
    expect(result.hourly).toBeDefined();
    expect(result.by_model).toBeDefined();
  });

  it('defaults range to 7d', async () => {
    const user = { id: 'u1' };
    await controller.getCosts({}, user as never);

    expect(mockGetPreviousCostTotal).toHaveBeenCalledWith('7d', 'u1', undefined);
  });

  it('passes agent_name to service calls', async () => {
    const user = { id: 'u1' };
    await controller.getCosts({ range: '30d', agent_name: 'bot' }, user as never);

    expect(mockGetPreviousCostTotal).toHaveBeenCalledWith('30d', 'u1', 'bot');
    expect(mockGetDailyCosts).toHaveBeenCalledWith('30d', 'u1', 'bot');
    expect(mockGetHourlyCosts).toHaveBeenCalledWith('30d', 'u1', 'bot');
    expect(mockGetCostByModel).toHaveBeenCalledWith('30d', 'u1', 'bot');
  });

  it('returns zero trend when previous cost is zero', async () => {
    mockGetPreviousCostTotal.mockResolvedValue(0);
    const user = { id: 'u1' };
    const result = await controller.getCosts({ range: '7d' }, user as never);

    expect(result.summary.weekly_cost.trend_pct).toBe(0);
  });

  it('computes summary from multiple hourly buckets', async () => {
    mockGetHourlyCosts.mockResolvedValue([
      { hour: '2026-02-16T10:00:00', cost: 5.0 },
      { hour: '2026-02-16T11:00:00', cost: 7.5 },
    ]);
    const user = { id: 'u1' };
    const result = await controller.getCosts({ range: '7d' }, user as never);

    expect(result.summary.weekly_cost.value).toBe(12.5);
  });
});
