import { ModelPricingCacheService } from './model-pricing-cache.service';
import { PricingSyncService, OpenRouterPricingEntry } from '../database/pricing-sync.service';
import { MANUAL_PRICING } from '../routing/model-discovery/manual-pricing-reference';

function makeEntry(input: number, output: number): OpenRouterPricingEntry {
  return { input, output };
}

describe('ModelPricingCacheService', () => {
  let service: ModelPricingCacheService;
  let mockGetAll: jest.Mock;

  beforeEach(() => {
    mockGetAll = jest.fn().mockReturnValue(new Map<string, OpenRouterPricingEntry>());
    const mockSync = { getAll: mockGetAll } as unknown as PricingSyncService;
    service = new ModelPricingCacheService(mockSync);
  });

  describe('onModuleInit', () => {
    it('should call reload()', async () => {
      const spy = jest.spyOn(service, 'reload').mockResolvedValue();

      await service.onModuleInit();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('reload', () => {
    it('should load entries from PricingSyncService', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['openai/gpt-4o', makeEntry(0.000015, 0.000075)],
      ]);
      mockGetAll.mockReturnValue(orMap);

      await service.reload();

      const entry = service.getByModel('openai/gpt-4o');
      expect(entry).toBeDefined();
      expect(entry!.model_name).toBe('openai/gpt-4o');
      expect(entry!.provider).toBe('OpenAI');
      expect(entry!.input_price_per_token).toBe(0.000015);
      expect(entry!.output_price_per_token).toBe(0.000075);
    });

    it('should load entries from MANUAL_PRICING', async () => {
      mockGetAll.mockReturnValue(new Map());

      await service.reload();

      // MANUAL_PRICING contains glm-5 — should be loaded
      const entry = service.getByModel('glm-5');
      expect(entry).toBeDefined();
      expect(entry!.model_name).toBe('glm-5');
      expect(entry!.input_price_per_token).toBe(MANUAL_PRICING.get('glm-5')!.input);
      expect(entry!.output_price_per_token).toBe(MANUAL_PRICING.get('glm-5')!.output);
    });

    it('should not overwrite OpenRouter entries with manual entries', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([['glm-5', makeEntry(0.1, 0.2)]]);
      mockGetAll.mockReturnValue(orMap);

      await service.reload();

      const entry = service.getByModel('glm-5');
      expect(entry).toBeDefined();
      expect(entry!.input_price_per_token).toBe(0.1);
      expect(entry!.output_price_per_token).toBe(0.2);
    });

    it('should clear old entries and load new ones', async () => {
      const oldMap = new Map<string, OpenRouterPricingEntry>([
        ['anthropic/old-model', makeEntry(0.01, 0.02)],
      ]);
      mockGetAll.mockReturnValue(oldMap);
      await service.reload();
      expect(service.getByModel('anthropic/old-model')).toBeDefined();

      const newMap = new Map<string, OpenRouterPricingEntry>([
        ['openai/new-model', makeEntry(0.03, 0.04)],
      ]);
      mockGetAll.mockReturnValue(newMap);
      await service.reload();

      expect(service.getByModel('anthropic/old-model')).toBeUndefined();
      expect(service.getByModel('openai/new-model')).toBeDefined();
    });

    it('should handle reload to empty state (no OR data, only manual)', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['openai/gpt-4o', makeEntry(0.01, 0.02)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();
      expect(service.getByModel('openai/gpt-4o')).toBeDefined();

      mockGetAll.mockReturnValue(new Map());
      await service.reload();

      expect(service.getByModel('openai/gpt-4o')).toBeUndefined();
      // Manual entries should still be loaded
      expect(service.getByModel('glm-5')).toBeDefined();
    });
  });

  describe('getByModel', () => {
    it('should return the entry for an exact match', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['anthropic/claude-opus-4-6', makeEntry(0.015, 0.075)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      const result = service.getByModel('anthropic/claude-opus-4-6');
      expect(result).toBeDefined();
      expect(result!.model_name).toBe('anthropic/claude-opus-4-6');
    });

    it('should return undefined for an unknown model', async () => {
      mockGetAll.mockReturnValue(new Map());
      await service.reload();

      expect(service.getByModel('totally-unknown')).toBeUndefined();
    });

    it('should return undefined before initialization', () => {
      expect(service.getByModel('any-model')).toBeUndefined();
    });

    it('should resolve known aliases', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['anthropic/claude-opus-4-6', makeEntry(0.015, 0.075)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      // "claude-opus-4" is a known alias for "claude-opus-4-6"
      // buildAliasMap indexes bare name "claude-opus-4-6" from "anthropic/claude-opus-4-6"
      // Then the alias "claude-opus-4" → "claude-opus-4-6" resolves to "anthropic/claude-opus-4-6"
      const result = service.getByModel('claude-opus-4');
      expect(result).toBeDefined();
      expect(result!.model_name).toBe('anthropic/claude-opus-4-6');
    });

    it('should resolve provider-prefixed model names via alias map', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['openai/gpt-4o', makeEntry(0.01, 0.02)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      // "gpt-4o" should resolve to the full "openai/gpt-4o" entry via bare-name alias
      const result = service.getByModel('gpt-4o');
      expect(result).toBeDefined();
      expect(result!.model_name).toBe('openai/gpt-4o');
    });

    it('should resolve date-suffixed model names', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['openai/gpt-4.1', makeEntry(0.01, 0.02)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      const result = service.getByModel('gpt-4.1-2025-04-14');
      expect(result).toBeDefined();
      expect(result!.model_name).toBe('openai/gpt-4.1');
    });

    it('should resolve prefix + date suffix combined', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['openai/gpt-4.1', makeEntry(0.01, 0.02)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      const result = service.getByModel('openai/gpt-4.1-2025-04-14');
      expect(result).toBeDefined();
      expect(result!.model_name).toBe('openai/gpt-4.1');
    });

    it('should resolve deepseek-v3 to deepseek-chat', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['deepseek/deepseek-chat', makeEntry(0.001, 0.002)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      const result = service.getByModel('deepseek-v3');
      expect(result).toBeDefined();
      expect(result!.model_name).toBe('deepseek/deepseek-chat');
    });

    it('should resolve dot-variant to dash-canonical via normalization', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['anthropic/claude-opus-4-6', makeEntry(0.015, 0.075)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      const result = service.getByModel('claude-opus-4.6');
      expect(result).toBeDefined();
      expect(result!.model_name).toBe('anthropic/claude-opus-4-6');
    });

    it('should distinguish between models with similar names', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['openai/gpt-4', makeEntry(0.03, 0.06)],
        ['openai/gpt-4o', makeEntry(0.01, 0.02)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      expect(service.getByModel('openai/gpt-4')!.model_name).toBe('openai/gpt-4');
      expect(service.getByModel('openai/gpt-4o')!.model_name).toBe('openai/gpt-4o');
      expect(service.getByModel('openai/gpt-4o-mini')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all cached entries', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['openai/gpt-4o', makeEntry(0.01, 0.02)],
        ['anthropic/claude-opus-4-6', makeEntry(0.015, 0.075)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      const result = service.getAll();

      // Should include OR entries + manual entries
      expect(result.length).toBeGreaterThanOrEqual(2);
      const names = result.map((e) => e.model_name);
      expect(names).toContain('openai/gpt-4o');
      expect(names).toContain('anthropic/claude-opus-4-6');
    });

    it('should return empty array before initialization', () => {
      expect(service.getAll()).toEqual([]);
    });

    it('should return a new array each time', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['openai/gpt-4o', makeEntry(0.01, 0.02)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      const a = service.getAll();
      const b = service.getAll();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('inferProvider', () => {
    it('should infer known provider from slash prefix', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['anthropic/claude-opus-4-6', makeEntry(0.015, 0.075)],
        ['openai/gpt-4o', makeEntry(0.01, 0.02)],
        ['google/gemini-2.0-flash', makeEntry(0.005, 0.01)],
        ['deepseek/deepseek-chat', makeEntry(0.001, 0.002)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      expect(service.getByModel('anthropic/claude-opus-4-6')!.provider).toBe('Anthropic');
      expect(service.getByModel('openai/gpt-4o')!.provider).toBe('OpenAI');
      expect(service.getByModel('google/gemini-2.0-flash')!.provider).toBe('Google');
      expect(service.getByModel('deepseek/deepseek-chat')!.provider).toBe('DeepSeek');
    });

    it('should use raw prefix for unknown provider slash prefix', async () => {
      const orMap = new Map<string, OpenRouterPricingEntry>([
        ['newvendor/some-model', makeEntry(0.001, 0.002)],
      ]);
      mockGetAll.mockReturnValue(orMap);
      await service.reload();

      expect(service.getByModel('newvendor/some-model')!.provider).toBe('newvendor');
    });

    it('should return Unknown for models without slash prefix', async () => {
      // Manual pricing entries use provider from MANUAL_PRICING map
      mockGetAll.mockReturnValue(new Map());
      await service.reload();

      const entry = service.getByModel('glm-5');
      expect(entry).toBeDefined();
      expect(entry!.provider).toBe('Z.ai');
    });
  });
});
