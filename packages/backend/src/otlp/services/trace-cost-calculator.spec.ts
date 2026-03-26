import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TraceCostCalculator } from './trace-cost-calculator';
import { UserProvider } from '../../entities/user-provider.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { AttributeMap } from './otlp-helpers';

describe('TraceCostCalculator', () => {
  let calculator: TraceCostCalculator;
  let mockProviderFind: jest.Mock;
  let mockPricingGetByModel: jest.Mock;

  beforeEach(async () => {
    mockProviderFind = jest.fn().mockResolvedValue([]);
    mockPricingGetByModel = jest.fn().mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TraceCostCalculator,
        { provide: getRepositoryToken(UserProvider), useValue: { find: mockProviderFind } },
        { provide: ModelPricingCacheService, useValue: { getByModel: mockPricingGetByModel } },
      ],
    }).compile();

    calculator = module.get<TraceCostCalculator>(TraceCostCalculator);
  });

  describe('getSubscriptionProviders', () => {
    it('returns empty set when no providers exist', async () => {
      const result = await calculator.getSubscriptionProviders('agent-1');
      expect(result.size).toBe(0);
    });

    it('returns subscription-only providers', async () => {
      mockProviderFind.mockResolvedValue([{ provider: 'anthropic', auth_type: 'subscription' }]);
      const result = await calculator.getSubscriptionProviders('agent-1');
      expect(result.has('anthropic')).toBe(true);
    });

    it('removes provider from subscription set when api_key also exists', async () => {
      mockProviderFind.mockResolvedValue([
        { provider: 'anthropic', auth_type: 'subscription' },
        { provider: 'anthropic', auth_type: 'api_key' },
      ]);
      const result = await calculator.getSubscriptionProviders('agent-1');
      expect(result.has('anthropic')).toBe(false);
    });

    it('removes dual-auth provider regardless of record order', async () => {
      mockProviderFind.mockResolvedValue([
        { provider: 'anthropic', auth_type: 'api_key' },
        { provider: 'anthropic', auth_type: 'subscription' },
      ]);
      const result = await calculator.getSubscriptionProviders('agent-1');
      expect(result.has('anthropic')).toBe(false);
    });

    it('filters out unsupported subscription providers', async () => {
      mockProviderFind.mockResolvedValue([{ provider: 'deepseek', auth_type: 'subscription' }]);
      const result = await calculator.getSubscriptionProviders('agent-1');
      expect(result.has('deepseek')).toBe(false);
    });
  });

  describe('computeCost', () => {
    it('returns null when no model attribute is present', () => {
      expect(calculator.computeCost({})).toBeNull();
    });

    it('returns null when tokens are zero', () => {
      const attrs: AttributeMap = { 'gen_ai.request.model': 'gpt-4o' };
      expect(calculator.computeCost(attrs)).toBeNull();
    });

    it('calculates cost from pricing data', () => {
      mockPricingGetByModel.mockReturnValue({
        input_price_per_token: 0.001,
        output_price_per_token: 0.002,
      });
      const attrs: AttributeMap = {
        'gen_ai.request.model': 'gpt-4o',
        'gen_ai.usage.input_tokens': 100,
        'gen_ai.usage.output_tokens': 50,
      };
      expect(calculator.computeCost(attrs)).toBeCloseTo(0.2);
    });

    it('returns null when pricing is not found', () => {
      const attrs: AttributeMap = {
        'gen_ai.request.model': 'unknown-model',
        'gen_ai.usage.input_tokens': 100,
        'gen_ai.usage.output_tokens': 50,
      };
      expect(calculator.computeCost(attrs)).toBeNull();
    });

    it('returns zero when provider is subscription-only', () => {
      mockPricingGetByModel.mockReturnValue({
        provider: 'anthropic',
        input_price_per_token: 0.001,
        output_price_per_token: 0.002,
      });
      const attrs: AttributeMap = {
        'gen_ai.request.model': 'claude-haiku',
        'gen_ai.usage.input_tokens': 100,
        'gen_ai.usage.output_tokens': 50,
      };
      expect(calculator.computeCost(attrs, new Set(['anthropic']))).toBe(0);
    });

    it('returns zero when prefixed model provider is subscription-only', () => {
      const attrs: AttributeMap = {
        'gen_ai.request.model': 'copilot/gpt-4o',
        'gen_ai.usage.input_tokens': 100,
        'gen_ai.usage.output_tokens': 50,
      };
      expect(calculator.computeCost(attrs, new Set(['copilot']))).toBe(0);
    });

    it('uses gen_ai.response.model when request model is absent', () => {
      mockPricingGetByModel.mockReturnValue({
        input_price_per_token: 0.001,
        output_price_per_token: 0.002,
      });
      const attrs: AttributeMap = {
        'gen_ai.response.model': 'claude-3-haiku',
        'gen_ai.usage.input_tokens': 10,
        'gen_ai.usage.output_tokens': 5,
      };
      expect(calculator.computeCost(attrs)).toBeCloseTo(0.02);
    });
  });

  describe('computeRollupCost', () => {
    it('returns null when model is null', () => {
      expect(calculator.computeRollupCost(null, 100, 50, new Set())).toBeNull();
    });

    it('returns zero for prefixed subscription-only model', () => {
      expect(calculator.computeRollupCost('copilot/gpt-4o', 100, 50, new Set(['copilot']))).toBe(0);
    });

    it('returns zero when pricing provider is subscription-only', () => {
      mockPricingGetByModel.mockReturnValue({
        provider: 'anthropic',
        input_price_per_token: 0.003,
        output_price_per_token: 0.015,
      });
      expect(calculator.computeRollupCost('claude-opus', 100, 50, new Set(['anthropic']))).toBe(0);
    });

    it('calculates cost from pricing data', () => {
      mockPricingGetByModel.mockReturnValue({
        provider: 'openai',
        input_price_per_token: 0.01,
        output_price_per_token: 0.03,
      });
      expect(calculator.computeRollupCost('gpt-4o', 200, 100, new Set())).toBeCloseTo(5.0);
    });

    it('returns null when no pricing is available', () => {
      expect(calculator.computeRollupCost('unknown-model', 100, 50, new Set())).toBeNull();
    });

    it('returns null when pricing has null price fields', () => {
      mockPricingGetByModel.mockReturnValue({
        provider: 'openai',
        input_price_per_token: null,
        output_price_per_token: null,
      });
      expect(calculator.computeRollupCost('gpt-4o', 100, 50, new Set())).toBeNull();
    });
  });

  describe('inferAuthType', () => {
    it('returns null when no model attribute is present', () => {
      expect(calculator.inferAuthType({}, new Set())).toBeNull();
    });

    it('returns subscription for prefixed model when prefix provider is subscription-only', () => {
      expect(
        calculator.inferAuthType(
          { 'gen_ai.request.model': 'copilot/gpt-4o' },
          new Set(['copilot']),
        ),
      ).toBe('subscription');
    });

    it('returns subscription when pricing provider is subscription-only', () => {
      mockPricingGetByModel.mockReturnValue({ provider: 'anthropic' });
      expect(
        calculator.inferAuthType(
          { 'gen_ai.request.model': 'claude-haiku' },
          new Set(['anthropic']),
        ),
      ).toBe('subscription');
    });

    it('returns api_key when pricing provider is not subscription-only', () => {
      mockPricingGetByModel.mockReturnValue({ provider: 'openai' });
      expect(calculator.inferAuthType({ 'gen_ai.request.model': 'gpt-4o' }, new Set())).toBe(
        'api_key',
      );
    });

    it('returns null when no pricing is found', () => {
      expect(calculator.inferAuthType({ 'gen_ai.request.model': 'unknown' }, new Set())).toBeNull();
    });

    it('uses gen_ai.response.model when request model is absent', () => {
      mockPricingGetByModel.mockReturnValue({ provider: 'openai' });
      expect(calculator.inferAuthType({ 'gen_ai.response.model': 'gpt-4o' }, new Set())).toBe(
        'api_key',
      );
    });
  });
});
