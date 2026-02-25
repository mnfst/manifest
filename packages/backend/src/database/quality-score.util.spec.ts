import { computeQualityScore, QUALITY_OVERRIDES } from './quality-score.util';
import { ModelPricing } from '../entities/model-pricing.entity';

type ScoreInput = Pick<
  ModelPricing,
  | 'model_name'
  | 'input_price_per_token'
  | 'output_price_per_token'
  | 'capability_reasoning'
  | 'capability_code'
  | 'context_window'
>;

function makeModel(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    model_name: 'test-model',
    input_price_per_token: 0.000005,
    output_price_per_token: 0.000015,
    capability_reasoning: false,
    capability_code: false,
    context_window: 128000,
    ...overrides,
  };
}

describe('computeQualityScore', () => {
  /* ── Overrides ── */

  describe('manual overrides', () => {
    it('should return the override score for known models', () => {
      for (const [name, expected] of QUALITY_OVERRIDES) {
        const model = makeModel({ model_name: name });
        expect(computeQualityScore(model)).toBe(expected);
      }
    });

    it('should not apply override for unknown model names', () => {
      const model = makeModel({ model_name: 'unknown-model-xyz' });
      const score = computeQualityScore(model);
      expect(QUALITY_OVERRIDES.has('unknown-model-xyz')).toBe(false);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(5);
    });
  });

  /* ── Zero-price models (Ollama / local) ── */

  describe('zero-price models', () => {
    const zeroPriceBase: Partial<ScoreInput> = {
      input_price_per_token: 0,
      output_price_per_token: 0,
    };

    it('should score 3 for dual-capability non-mini models', () => {
      const model = makeModel({
        ...zeroPriceBase,
        model_name: 'qwen3',
        capability_reasoning: true,
        capability_code: true,
      });
      expect(computeQualityScore(model)).toBe(3);
    });

    it('should score 3 for reasoning-only non-mini models', () => {
      const model = makeModel({
        ...zeroPriceBase,
        model_name: 'deepseek-r1',
        capability_reasoning: true,
        capability_code: false,
      });
      expect(computeQualityScore(model)).toBe(3);
    });

    it('should score 2 for reasoning mini models', () => {
      const model = makeModel({
        ...zeroPriceBase,
        model_name: 'deepseek-r1-mini',
        capability_reasoning: true,
        capability_code: false,
      });
      expect(computeQualityScore(model)).toBe(2);
    });

    it('should score 2 for code-only models', () => {
      const model = makeModel({
        ...zeroPriceBase,
        model_name: 'codellama',
        capability_reasoning: false,
        capability_code: true,
      });
      expect(computeQualityScore(model)).toBe(2);
    });

    it('should score 1 for models with no capabilities', () => {
      const model = makeModel({
        ...zeroPriceBase,
        model_name: 'tiny-llm',
        capability_reasoning: false,
        capability_code: false,
      });
      expect(computeQualityScore(model)).toBe(1);
    });

    it('should score 2 for mini reasoning model with code too', () => {
      const model = makeModel({
        ...zeroPriceBase,
        model_name: 'qwen3-mini',
        capability_reasoning: true,
        capability_code: true,
      });
      // hasBoth && !isMini is false (mini), then hasReasoning && isMini => 2
      // Actually: hasBoth is true, isMini is true => skip first branch
      // hasReasoning && !isMini => false, hasReasoning && isMini => 2
      expect(computeQualityScore(model)).toBe(2);
    });

    it('should treat string "0" as zero price (decimal column cast)', () => {
      const model = makeModel({
        input_price_per_token: '0' as unknown as number,
        output_price_per_token: '0' as unknown as number,
        model_name: 'local-model',
        capability_code: true,
      });
      expect(computeQualityScore(model)).toBe(2);
    });

    it('should detect all mini variants (nano, haiku, micro)', () => {
      const variants = ['model-nano', 'model-haiku', 'model-micro', 'model-mini'];
      for (const name of variants) {
        const model = makeModel({
          ...zeroPriceBase,
          model_name: name,
          capability_reasoning: true,
          capability_code: false,
        });
        expect(computeQualityScore(model)).toBe(2);
      }
    });
  });

  /* ── Paid models: Q5 frontier ── */

  describe('Q5 frontier', () => {
    it('should score 5 for expensive dual-cap non-mini', () => {
      const model = makeModel({
        input_price_per_token: 0.000005,
        output_price_per_token: 0.000015,
        capability_reasoning: true,
        capability_code: true,
      });
      // totalPerM = (5 + 15) * 1e6 / 1e6 = 20 >= 8, hasBoth, not mini
      expect(computeQualityScore(model)).toBe(5);
    });

    it('should score 5 for expensive code model with 1M+ context', () => {
      const model = makeModel({
        input_price_per_token: 0.000005,
        output_price_per_token: 0.000015,
        capability_code: true,
        capability_reasoning: false,
        context_window: 2_000_000,
      });
      expect(computeQualityScore(model)).toBe(5);
    });

    it('should not score 5 for expensive mini with dual-cap', () => {
      const model = makeModel({
        model_name: 'big-mini-model',
        input_price_per_token: 0.000005,
        output_price_per_token: 0.000015,
        capability_reasoning: true,
        capability_code: true,
      });
      expect(computeQualityScore(model)).not.toBe(5);
    });
  });

  /* ── Paid models: Q4 high-capability ── */

  describe('Q4 high-capability', () => {
    it('should score 4 for reasoning model above $1/M (not mini)', () => {
      const model = makeModel({
        model_name: 'reasoner-large',
        input_price_per_token: 0.0000008,
        output_price_per_token: 0.0000005,
        capability_reasoning: true,
        capability_code: false,
      });
      // totalPerM = (0.8 + 0.5) = 1.3 >= 1.0, reasoning, not mini
      expect(computeQualityScore(model)).toBe(4);
    });

    it('should score 4 for expensive code-only model ($8+/M, no big context)', () => {
      const model = makeModel({
        input_price_per_token: 0.000005,
        output_price_per_token: 0.000015,
        capability_code: true,
        capability_reasoning: false,
        context_window: 128000,
      });
      // totalPerM = 20 >= 8, hasCode, not bigContext => Q4 path
      expect(computeQualityScore(model)).toBe(4);
    });
  });

  /* ── Paid models: Q3 mid-range ── */

  describe('Q3 mid-range', () => {
    it('should score 3 for mid-price code non-mini ($3+/M)', () => {
      const model = makeModel({
        model_name: 'mid-coder',
        input_price_per_token: 0.000002,
        output_price_per_token: 0.000002,
        capability_code: true,
        capability_reasoning: false,
      });
      // totalPerM = 4.0 >= 3.0, hasCode, not mini
      expect(computeQualityScore(model)).toBe(3);
    });

    it('should score 3 for cheap dual-cap non-mini ($0.50+/M)', () => {
      const model = makeModel({
        model_name: 'budget-dual',
        input_price_per_token: 0.0000003,
        output_price_per_token: 0.0000003,
        capability_code: true,
        capability_reasoning: true,
      });
      // totalPerM = 0.6 >= 0.50, hasBoth, not mini
      expect(computeQualityScore(model)).toBe(3);
    });

    it('should score 3 for reasoning mini at $0.50+/M', () => {
      const model = makeModel({
        model_name: 'thinker-mini',
        input_price_per_token: 0.0000003,
        output_price_per_token: 0.0000003,
        capability_reasoning: true,
        capability_code: false,
      });
      // totalPerM = 0.6 >= 0.50, reasoning, isMini
      expect(computeQualityScore(model)).toBe(3);
    });
  });

  /* ── Paid models: Q2 cost-optimized ── */

  describe('Q2 cost-optimized', () => {
    it('should score 2 for cheap code-only model below $3/M', () => {
      const model = makeModel({
        model_name: 'cheap-coder',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000001,
        capability_code: true,
        capability_reasoning: false,
      });
      // totalPerM = 0.2 < 3.0, hasCode
      expect(computeQualityScore(model)).toBe(2);
    });
  });

  /* ── Paid models: Q1 ultra-low ── */

  describe('Q1 ultra-low', () => {
    it('should score 1 for cheap model with no capabilities', () => {
      const model = makeModel({
        model_name: 'bare-llm',
        input_price_per_token: 0.0000001,
        output_price_per_token: 0.0000001,
        capability_code: false,
        capability_reasoning: false,
      });
      expect(computeQualityScore(model)).toBe(1);
    });
  });
});
