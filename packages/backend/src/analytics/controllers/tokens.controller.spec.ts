import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';
import { TokensController } from './tokens.controller';
import { AggregationService } from '../services/aggregation.service';
import { TimeseriesQueriesService } from '../services/timeseries-queries.service';

describe('TokensController', () => {
  let controller: TokensController;
  let mockGetPreviousTokenTotal: jest.Mock;
  let mockGetHourlyTokens: jest.Mock;
  let mockGetDailyTokens: jest.Mock;

  beforeEach(async () => {
    mockGetPreviousTokenTotal = jest.fn().mockResolvedValue(4000);
    mockGetHourlyTokens = jest
      .fn()
      .mockResolvedValue([
        { hour: '2026-02-16T10:00:00', input_tokens: 3000, output_tokens: 2000 },
      ]);
    mockGetDailyTokens = jest
      .fn()
      .mockResolvedValue([{ date: '2026-02-16', input_tokens: 1000, output_tokens: 500 }]);

    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [TokensController],
      providers: [
        {
          provide: AggregationService,
          useValue: { getPreviousTokenTotal: mockGetPreviousTokenTotal },
        },
        {
          provide: TimeseriesQueriesService,
          useValue: {
            getHourlyTokens: mockGetHourlyTokens,
            getDailyTokens: mockGetDailyTokens,
          },
        },
      ],
    }).compile();

    controller = module.get<TokensController>(TokensController);
  });

  it('returns token summary derived from hourly data with trend', async () => {
    const user = { id: 'u1' };
    const result = await controller.getTokens({ range: '24h' }, user as never);

    expect(result.summary.total_tokens.value).toBe(5000);
    expect(result.summary.total_tokens.trend_pct).toBe(25);
    expect(result.summary.total_tokens.sub_values).toEqual({ input: 3000, output: 2000 });
    expect(result.summary.input_tokens).toBe(3000);
    expect(result.summary.output_tokens).toBe(2000);
    expect(result.hourly).toHaveLength(1);
    expect(result.daily).toHaveLength(1);
  });

  it('defaults range to 24h', async () => {
    const user = { id: 'u1' };
    await controller.getTokens({}, user as never);

    expect(mockGetPreviousTokenTotal).toHaveBeenCalledWith('24h', 'u1', undefined);
  });

  it('passes agent_name to service calls', async () => {
    const user = { id: 'u1' };
    await controller.getTokens({ range: '7d', agent_name: 'bot' }, user as never);

    expect(mockGetPreviousTokenTotal).toHaveBeenCalledWith('7d', 'u1', 'bot');
    expect(mockGetHourlyTokens).toHaveBeenCalledWith('7d', 'u1', 'bot');
    expect(mockGetDailyTokens).toHaveBeenCalledWith('7d', 'u1', 'bot');
  });

  it('returns zero trend when previous tokens is zero', async () => {
    mockGetPreviousTokenTotal.mockResolvedValue(0);
    const user = { id: 'u1' };
    const result = await controller.getTokens({ range: '24h' }, user as never);

    expect(result.summary.total_tokens.trend_pct).toBe(0);
  });

  it('computes summary from multiple hourly buckets', async () => {
    mockGetHourlyTokens.mockResolvedValue([
      { hour: '2026-02-16T10:00:00', input_tokens: 100, output_tokens: 50 },
      { hour: '2026-02-16T11:00:00', input_tokens: 200, output_tokens: 100 },
    ]);
    const user = { id: 'u1' };
    const result = await controller.getTokens({ range: '24h' }, user as never);

    expect(result.summary.total_tokens.value).toBe(450);
    expect(result.summary.input_tokens).toBe(300);
    expect(result.summary.output_tokens).toBe(150);
  });
});
