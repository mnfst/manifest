import { ModelPricingCacheService } from './model-pricing-cache.service';
import { ModelPricing } from '../entities/model-pricing.entity';
import { UnresolvedModelTrackerService } from './unresolved-model-tracker.service';

function makePricing(name: string, overrides?: Partial<ModelPricing>): ModelPricing {
  const p = new ModelPricing();
  p.model_name = name;
  p.input_price_per_token = 0.000015;
  p.output_price_per_token = 0.000075;
  p.provider = 'TestProvider';
  p.updated_at = null;
  p.context_window = 128000;
  p.capability_reasoning = true;
  p.capability_code = true;
  p.quality_score = 5;
  Object.assign(p, overrides);
  return p;
}

describe('ModelPricingCacheService', () => {
  let service: ModelPricingCacheService;
  let mockFind: jest.Mock;
  let mockUpdate: jest.Mock;
  let mockTrack: jest.Mock;

  beforeEach(() => {
    mockFind = jest.fn().mockResolvedValue([]);
    mockUpdate = jest.fn().mockResolvedValue({});
    const mockRepo = { find: mockFind, update: mockUpdate } as never;
    mockTrack = jest.fn();
    const mockTracker = { track: mockTrack } as unknown as UnresolvedModelTrackerService;
    service = new ModelPricingCacheService(mockRepo, mockTracker);
  });

  describe('onModuleInit', () => {
    it('should load all pricing rows into the cache', async () => {
      const rows = [makePricing('gpt-4o'), makePricing('claude-opus-4')];
      mockFind.mockResolvedValue(rows);

      await service.onModuleInit();

      expect(mockFind).toHaveBeenCalledTimes(1);
      expect(service.getByModel('gpt-4o')).toEqual(rows[0]);
      expect(service.getByModel('claude-opus-4')).toEqual(rows[1]);
    });

    it('should result in empty cache when DB has no rows', async () => {
      mockFind.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockFind).toHaveBeenCalledTimes(1);
      expect(service.getByModel('anything')).toBeUndefined();
    });
  });

  describe('reload', () => {
    it('should clear old entries and load new ones', async () => {
      const oldRows = [makePricing('old-model')];
      mockFind.mockResolvedValueOnce(oldRows);
      await service.onModuleInit();
      expect(service.getByModel('old-model')).toBeDefined();

      const newRows = [makePricing('new-model')];
      mockFind.mockResolvedValueOnce(newRows);
      await service.reload();

      expect(service.getByModel('old-model')).toBeUndefined();
      expect(service.getByModel('new-model')).toEqual(newRows[0]);
    });

    it('should handle reload to empty state', async () => {
      mockFind.mockResolvedValueOnce([makePricing('model-a')]);
      await service.onModuleInit();
      expect(service.getByModel('model-a')).toBeDefined();

      mockFind.mockResolvedValueOnce([]);
      await service.reload();

      expect(service.getByModel('model-a')).toBeUndefined();
    });

    it('should call find on each reload', async () => {
      await service.onModuleInit();
      await service.reload();
      await service.reload();

      expect(mockFind).toHaveBeenCalledTimes(3);
    });

    it('should recompute quality scores on reload', async () => {
      // Model with stale quality_score=1 but frontier-level pricing + caps
      const stale = makePricing('frontier-model', { quality_score: 1 });
      mockFind.mockResolvedValue([stale]);

      await service.reload();

      // Should have updated the DB with the computed score (5)
      expect(mockUpdate).toHaveBeenCalledWith(
        { model_name: 'frontier-model' },
        { quality_score: 5 },
      );
      // Cached value should also be updated
      expect(service.getByModel('frontier-model')?.quality_score).toBe(5);
    });

    it('should skip DB update when quality score is already correct', async () => {
      const correct = makePricing('correct-model', { quality_score: 5 });
      mockFind.mockResolvedValue([correct]);

      await service.reload();

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getByModel', () => {
    it('should return the pricing entity for a known model', async () => {
      const pricing = makePricing('claude-sonnet');
      mockFind.mockResolvedValue([pricing]);
      await service.onModuleInit();

      const result = service.getByModel('claude-sonnet');

      expect(result).toBe(pricing);
    });

    it('should return undefined for an unknown model', async () => {
      mockFind.mockResolvedValue([makePricing('known-model')]);
      await service.onModuleInit();

      expect(service.getByModel('unknown-model')).toBeUndefined();
    });

    it('should return undefined before initialization', () => {
      expect(service.getByModel('any-model')).toBeUndefined();
    });

    it('should distinguish between models with similar names', async () => {
      const rows = [makePricing('gpt-4'), makePricing('gpt-4o')];
      mockFind.mockResolvedValue(rows);
      await service.onModuleInit();

      expect(service.getByModel('gpt-4')).toBe(rows[0]);
      expect(service.getByModel('gpt-4o')).toBe(rows[1]);
      expect(service.getByModel('gpt-4o-mini')).toBeUndefined();
    });

    it('should resolve provider-prefixed model names', async () => {
      const pricing = makePricing('gpt-4o');
      mockFind.mockResolvedValue([pricing]);
      await service.onModuleInit();

      expect(service.getByModel('openai/gpt-4o')).toBe(pricing);
    });

    it('should resolve known aliases', async () => {
      const pricing = makePricing('claude-opus-4-6');
      mockFind.mockResolvedValue([pricing]);
      await service.onModuleInit();

      expect(service.getByModel('claude-opus-4')).toBe(pricing);
    });

    it('should resolve date-suffixed model names', async () => {
      const pricing = makePricing('gpt-4.1');
      mockFind.mockResolvedValue([pricing]);
      await service.onModuleInit();

      expect(service.getByModel('gpt-4.1-2025-04-14')).toBe(pricing);
    });

    it('should resolve prefix + date suffix combined', async () => {
      const pricing = makePricing('gpt-4.1');
      mockFind.mockResolvedValue([pricing]);
      await service.onModuleInit();

      expect(service.getByModel('openai/gpt-4.1-2025-04-14')).toBe(pricing);
    });

    it('should resolve deepseek-chat to deepseek-v3', async () => {
      const pricing = makePricing('deepseek-v3');
      mockFind.mockResolvedValue([pricing]);
      await service.onModuleInit();

      expect(service.getByModel('deepseek-chat')).toBe(pricing);
    });

    it('should track unresolved models on cache miss', async () => {
      mockFind.mockResolvedValue([makePricing('gpt-4o')]);
      await service.onModuleInit();

      service.getByModel('totally-unknown');

      expect(mockTrack).toHaveBeenCalledWith('totally-unknown');
    });

    it('should not track models that resolve successfully', async () => {
      mockFind.mockResolvedValue([makePricing('gpt-4o')]);
      await service.onModuleInit();

      service.getByModel('openai/gpt-4o');

      expect(mockTrack).not.toHaveBeenCalled();
    });

    it('should still return undefined for truly unknown models', async () => {
      mockFind.mockResolvedValue([makePricing('gpt-4o')]);
      await service.onModuleInit();

      expect(service.getByModel('totally-unknown')).toBeUndefined();
    });

    it('should not track models that match exactly in cache', async () => {
      mockFind.mockResolvedValue([makePricing('gpt-4o')]);
      await service.onModuleInit();

      service.getByModel('gpt-4o');

      expect(mockTrack).not.toHaveBeenCalled();
    });
  });

  describe('getAll', () => {
    it('should return all cached models', async () => {
      const rows = [makePricing('gpt-4o'), makePricing('claude-opus-4')];
      mockFind.mockResolvedValue(rows);
      await service.onModuleInit();

      const result = service.getAll();

      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining(rows));
    });

    it('should return empty array before initialization', () => {
      expect(service.getAll()).toEqual([]);
    });

    it('should return a new array each time (not the internal cache)', async () => {
      mockFind.mockResolvedValue([makePricing('model-a')]);
      await service.onModuleInit();

      const a = service.getAll();
      const b = service.getAll();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });
});
