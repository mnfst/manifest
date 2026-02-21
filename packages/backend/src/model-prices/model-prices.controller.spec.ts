import { ModelPricesController } from './model-prices.controller';
import { ModelPricesService } from './model-prices.service';

describe('ModelPricesController', () => {
  let controller: ModelPricesController;
  let mockService: jest.Mocked<ModelPricesService>;

  beforeEach(() => {
    mockService = { getAll: jest.fn() } as unknown as jest.Mocked<ModelPricesService>;
    controller = new ModelPricesController(mockService);
  });

  it('delegates to service.getAll()', async () => {
    const expected = { models: [], lastSyncedAt: null };
    mockService.getAll.mockResolvedValue(expected);

    const result = await controller.getModelPrices();

    expect(result).toBe(expected);
    expect(mockService.getAll).toHaveBeenCalledTimes(1);
  });
});
