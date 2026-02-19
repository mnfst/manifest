import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';
import { CostsController } from './costs.controller';
import { AggregationService } from '../services/aggregation.service';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import { CacheInvalidationService } from '../../common/services/cache-invalidation.service';

describe('CostsController', () => {
  let controller: CostsController;
  let mockGetCostSummary: jest.Mock;
  let mockGetDailyCosts: jest.Mock;
  let mockGetHourlyCosts: jest.Mock;
  let mockGetCostByModel: jest.Mock;

  beforeEach(async () => {
    mockGetCostSummary = jest.fn().mockResolvedValue({ value: 12.5, trend_pct: 10 });
    mockGetDailyCosts = jest.fn().mockResolvedValue([]);
    mockGetHourlyCosts = jest.fn().mockResolvedValue([]);
    mockGetCostByModel = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [CostsController],
      providers: [
        {
          provide: AggregationService,
          useValue: { getCostSummary: mockGetCostSummary },
        },
        {
          provide: TimeseriesQueriesService,
          useValue: {
            getDailyCosts: mockGetDailyCosts,
            getHourlyCosts: mockGetHourlyCosts,
            getCostByModel: mockGetCostByModel,
          },
        },
        { provide: CacheInvalidationService, useValue: { trackKey: jest.fn() } },
      ],
    }).compile();

    controller = module.get<CostsController>(CostsController);
  });

  it('returns cost summary with daily, hourly, and by_model data', async () => {
    const user = { id: 'u1' };
    const result = await controller.getCosts({ range: '7d' }, user as never);

    expect(result.summary.weekly_cost.value).toBe(12.5);
    expect(result.daily).toBeDefined();
    expect(result.hourly).toBeDefined();
    expect(result.by_model).toBeDefined();
  });

  it('defaults range to 7d', async () => {
    const user = { id: 'u1' };
    await controller.getCosts({}, user as never);

    expect(mockGetCostSummary).toHaveBeenCalledWith('7d', 'u1', undefined);
  });

  it('passes agent_name to service calls', async () => {
    const user = { id: 'u1' };
    await controller.getCosts({ range: '30d', agent_name: 'bot' }, user as never);

    expect(mockGetCostSummary).toHaveBeenCalledWith('30d', 'u1', 'bot');
    expect(mockGetDailyCosts).toHaveBeenCalledWith('30d', 'u1', 'bot');
    expect(mockGetHourlyCosts).toHaveBeenCalledWith('30d', 'u1', 'bot');
    expect(mockGetCostByModel).toHaveBeenCalledWith('30d', 'u1', 'bot');
  });
});
