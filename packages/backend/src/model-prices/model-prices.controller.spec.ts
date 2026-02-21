import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';
import { ModelPricesController } from './model-prices.controller';
import { ModelPricesService } from './model-prices.service';

describe('ModelPricesController', () => {
  let controller: ModelPricesController;
  let mockGetAll: jest.Mock;

  beforeEach(async () => {
    mockGetAll = jest.fn().mockResolvedValue({ models: [], lastSyncedAt: null });

    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [ModelPricesController],
      providers: [
        { provide: ModelPricesService, useValue: { getAll: mockGetAll } },
      ],
    }).compile();

    controller = module.get<ModelPricesController>(ModelPricesController);
  });

  it('should delegate to ModelPricesService.getAll', async () => {
    await controller.getModelPrices();
    expect(mockGetAll).toHaveBeenCalledTimes(1);
  });

  it('should return models and lastSyncedAt', async () => {
    const expected = {
      models: [
        { model_name: 'gpt-4o', provider: 'OpenAI', input_price_per_million: 2.5, output_price_per_million: 10 },
      ],
      lastSyncedAt: '2025-06-01T00:00:00Z',
    };
    mockGetAll.mockResolvedValue(expected);

    const result = await controller.getModelPrices();
    expect(result).toEqual(expected);
  });

  it('should return empty models with null sync date', async () => {
    const expected = { models: [], lastSyncedAt: null };
    mockGetAll.mockResolvedValue(expected);

    const result = await controller.getModelPrices();
    expect(result).toEqual(expected);
  });
});
