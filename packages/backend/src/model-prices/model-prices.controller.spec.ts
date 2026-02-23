import { ModelPricesController } from './model-prices.controller';
import { ModelPricesService } from './model-prices.service';

describe('ModelPricesController', () => {
  let controller: ModelPricesController;
  let mockService: jest.Mocked<ModelPricesService>;

  beforeEach(() => {
    mockService = {
      getAll: jest.fn(),
      triggerSync: jest.fn(),
      getUnresolved: jest.fn(),
      getHistory: jest.fn(),
    } as unknown as jest.Mocked<ModelPricesService>;
    controller = new ModelPricesController(mockService);
  });

  it('delegates to service.getAll()', async () => {
    const expected = { models: [], lastSyncedAt: null };
    mockService.getAll.mockResolvedValue(expected);

    const result = await controller.getModelPrices();

    expect(result).toBe(expected);
    expect(mockService.getAll).toHaveBeenCalledTimes(1);
  });

  it('delegates to service.triggerSync()', async () => {
    const expected = { updated: 100 };
    mockService.triggerSync.mockResolvedValue(expected);

    const result = await controller.triggerSync();

    expect(result).toEqual(expected);
    expect(mockService.triggerSync).toHaveBeenCalledTimes(1);
  });

  it('delegates to service.getUnresolved()', async () => {
    const expected = [{ model_name: 'unknown', occurrence_count: 5 }];
    mockService.getUnresolved.mockResolvedValue(expected as never);

    const result = await controller.getUnresolved();

    expect(result).toEqual(expected);
    expect(mockService.getUnresolved).toHaveBeenCalledTimes(1);
  });

  it('delegates to service.getHistory()', async () => {
    const expected = [{ model_name: 'gpt-4o', input_price_per_million: 2.5 }];
    mockService.getHistory.mockResolvedValue(expected as never);

    const result = await controller.getHistory('gpt-4o');

    expect(result).toEqual(expected);
    expect(mockService.getHistory).toHaveBeenCalledWith('gpt-4o');
  });
});
