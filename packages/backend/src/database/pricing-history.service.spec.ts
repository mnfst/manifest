import { PricingHistoryService } from './pricing-history.service';
import { ModelPricing } from '../entities/model-pricing.entity';

describe('PricingHistoryService', () => {
  let service: PricingHistoryService;
  let mockRepo: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(() => {
    mockRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
    };
    service = new PricingHistoryService(mockRepo as never);
  });

  describe('recordChange', () => {
    const incoming = {
      model_name: 'gpt-4o',
      input_price_per_token: 0.000003,
      output_price_per_token: 0.000012,
      provider: 'OpenAI',
    };

    it('should insert history for a new model', async () => {
      const changed = await service.recordChange(null, incoming, 'sync');

      expect(changed).toBe(true);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model_name: 'gpt-4o',
          input_price_per_token: 0.000003,
          output_price_per_token: 0.000012,
          provider: 'OpenAI',
          change_source: 'sync',
          effective_until: null,
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should return false when prices have not changed', async () => {
      const existing = {
        model_name: 'gpt-4o',
        input_price_per_token: 0.000003,
        output_price_per_token: 0.000012,
      } as ModelPricing;

      const changed = await service.recordChange(existing, incoming, 'sync');

      expect(changed).toBe(false);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should record change when input price differs', async () => {
      const existing = {
        model_name: 'gpt-4o',
        input_price_per_token: 0.000002,
        output_price_per_token: 0.000012,
      } as ModelPricing;

      const changed = await service.recordChange(existing, incoming, 'sync');

      expect(changed).toBe(true);
      expect(mockRepo.update).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should record change when output price differs', async () => {
      const existing = {
        model_name: 'gpt-4o',
        input_price_per_token: 0.000003,
        output_price_per_token: 0.000010,
      } as ModelPricing;

      const changed = await service.recordChange(existing, incoming, 'sync');

      expect(changed).toBe(true);
    });

    it('should close the old history entry on price change', async () => {
      const existing = {
        model_name: 'gpt-4o',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000005,
      } as ModelPricing;

      await service.recordChange(existing, incoming, 'sync');

      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ model_name: 'gpt-4o' }),
        expect.objectContaining({ effective_until: expect.any(Date) }),
      );
    });

    it('should handle string-typed decimal values from DB', async () => {
      const existing = {
        model_name: 'gpt-4o',
        input_price_per_token: '0.0000030000' as unknown as number,
        output_price_per_token: '0.0000120000' as unknown as number,
      } as ModelPricing;

      const changed = await service.recordChange(existing, incoming, 'sync');
      expect(changed).toBe(false);
    });

    it('should record change when both input and output price differ', async () => {
      const existing = {
        model_name: 'gpt-4o',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000005,
      } as ModelPricing;

      const changed = await service.recordChange(existing, incoming, 'sync');

      expect(changed).toBe(true);
      expect(mockRepo.update).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should generate a UUID id for history entries', async () => {
      const changed = await service.recordChange(null, incoming, 'sync');

      expect(changed).toBe(true);
      const created = mockRepo.create.mock.calls[0][0];
      expect(created.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('should pass the change_source through to the history entry', async () => {
      await service.recordChange(null, incoming, 'manual');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ change_source: 'manual' }),
      );
    });

    it('should close the previous entry with IsNull filter', async () => {
      const existing = {
        model_name: 'gpt-4o',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000005,
      } as ModelPricing;

      await service.recordChange(existing, incoming, 'sync');

      const updateFilter = mockRepo.update.mock.calls[0][0];
      expect(updateFilter.model_name).toBe('gpt-4o');
      // The IsNull() TypeORM FindOperator should be present
      expect(updateFilter.effective_until).toBeDefined();
      expect(updateFilter.effective_until._type).toBe('isNull');
    });

    it('should set effective_from as a Date on new entries', async () => {
      await service.recordChange(null, incoming, 'sync');

      const created = mockRepo.create.mock.calls[0][0];
      expect(created.effective_from).toBeInstanceOf(Date);
      expect(created.effective_until).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should return history records ordered by effective_from DESC', async () => {
      const records = [
        { id: '2', model_name: 'gpt-4o', effective_from: new Date('2025-02-01') },
        { id: '1', model_name: 'gpt-4o', effective_from: new Date('2025-01-01') },
      ];
      mockRepo.find.mockResolvedValue(records);

      const result = await service.getHistory('gpt-4o');

      expect(result).toEqual(records);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { model_name: 'gpt-4o' },
        order: { effective_from: 'DESC' },
      });
    });

    it('should return empty array for unknown model', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getHistory('unknown');
      expect(result).toEqual([]);
    });
  });
});
