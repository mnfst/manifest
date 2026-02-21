import { ModelPricesController } from './model-prices.controller';

describe('ModelPricesController', () => {
  let controller: ModelPricesController;
  let mockService: { getAll: jest.Mock };

  beforeEach(() => {
    mockService = { getAll: jest.fn() };
    controller = new ModelPricesController(mockService as never);
  });

  it('delegates to ModelPricesService.getAll()', async () => {
    const expected = { models: [], lastSyncedAt: null };
    mockService.getAll.mockResolvedValue(expected);

    const result = await controller.getModelPrices();

    expect(result).toEqual(expected);
    expect(mockService.getAll).toHaveBeenCalledTimes(1);
  });
});
