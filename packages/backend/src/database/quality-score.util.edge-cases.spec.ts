import { computeQualityScore, QualityScoreInput } from './quality-score.util';

type ScoreInput = QualityScoreInput;

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

/**
 * Edge cases around negative / mixed-sign prices.
 *
 * Background (finding): the zero-price branch is gated on `totalPerM === 0`
 * (strict equality), not `<= 0`. If one of the two prices is negative and the
 * other is zero, totalPerM is negative, so the zero-price branch is bypassed
 * and the function falls through to the paid-model tree, where every
 * `>=` threshold check fails. The result is a degraded score (1 or 2),
 * NOT the zero-price scoring path. These tests pin that behavior so any
 * accidental relaxation of the gate (e.g. `<= 0`) is caught.
 */
describe('computeQualityScore — negative / mixed-sign prices', () => {
  describe('one negative + one zero (the finding scenario)', () => {
    it('treats input=-0.001, output=0 as paid-model with no caps → score 1', () => {
      // totalPerM = (-0.001 + 0) * 1_000_000 = -1000 (NOT === 0)
      // Falls through to price-only fallback; every >= check fails → return 1
      const model = makeModel({
        model_name: 'corrupt-pricing-model',
        input_price_per_token: -0.001,
        output_price_per_token: 0,
        capability_reasoning: false,
        capability_code: false,
      });
      expect(computeQualityScore(model)).toBe(1);
    });

    it('treats input=0, output=-0.001 as paid-model with no caps → score 1', () => {
      const model = makeModel({
        model_name: 'corrupt-pricing-model',
        input_price_per_token: 0,
        output_price_per_token: -0.001,
        capability_reasoning: false,
        capability_code: false,
      });
      expect(computeQualityScore(model)).toBe(1);
    });

    it('does NOT promote a corrupt-priced reasoning+code model to score 3', () => {
      // If the zero-price branch were entered (e.g. via `<= 0`), this model
      // would score 3 (hasBoth && !isMini). The strict `=== 0` gate keeps
      // it on the paid branch, where -1000/M cannot satisfy any >= check,
      // and hasCode triggers `return 2`.
      const model = makeModel({
        model_name: 'corrupt-dual-cap',
        input_price_per_token: -0.001,
        output_price_per_token: 0,
        capability_reasoning: true,
        capability_code: true,
      });
      expect(computeQualityScore(model)).toBe(2);
      expect(computeQualityScore(model)).not.toBe(3);
    });

    it('does NOT promote a corrupt-priced reasoning-only model to score 3', () => {
      // Zero-price logic would return 3 for non-mini reasoning. Paid branch
      // returns 1 because hasCode is false and every >= threshold fails.
      const model = makeModel({
        model_name: 'corrupt-reasoner',
        input_price_per_token: 0,
        output_price_per_token: -0.001,
        capability_reasoning: true,
        capability_code: false,
      });
      expect(computeQualityScore(model)).toBe(1);
      expect(computeQualityScore(model)).not.toBe(3);
    });

    it('does NOT promote a corrupt-priced code-only model above score 2', () => {
      const model = makeModel({
        model_name: 'corrupt-coder',
        input_price_per_token: -0.001,
        output_price_per_token: 0,
        capability_reasoning: false,
        capability_code: true,
      });
      // Zero-price branch would also return 2 here, but via a different
      // path. Pin the paid-branch result so we notice if the gate changes.
      expect(computeQualityScore(model)).toBe(2);
    });
  });

  describe('both prices negative', () => {
    it('scores a doubly-negative no-cap model at the lowest tier', () => {
      const model = makeModel({
        model_name: 'doubly-corrupt',
        input_price_per_token: -0.000005,
        output_price_per_token: -0.000015,
        capability_reasoning: false,
        capability_code: false,
      });
      // totalPerM = -20 → paid-model branches all fail → 1
      expect(computeQualityScore(model)).toBe(1);
    });

    it('scores a doubly-negative reasoning+code model at the lowest tier', () => {
      // Without the strict gate this would also pass `=== 0` checks if it
      // were broadened. Make sure the paid branch keeps us low.
      const model = makeModel({
        model_name: 'doubly-corrupt-dual',
        input_price_per_token: -0.000005,
        output_price_per_token: -0.000015,
        capability_reasoning: true,
        capability_code: true,
      });
      expect(computeQualityScore(model)).toBe(2);
    });
  });

  describe('negative inputs canceling to exactly zero (defensive)', () => {
    it('routes input=-0.001 + output=+0.001 (sum exactly 0) into zero-price branch', () => {
      // (-0.001 + 0.001) * 1_000_000 = 0 EXACTLY → enters Ollama-style branch.
      // This documents a genuine edge case in the strict `=== 0` gate: it
      // accepts mixed-sign prices that happen to cancel. Treat as a pinned
      // behavior, not a recommendation.
      const model = makeModel({
        model_name: 'sum-zero-model',
        input_price_per_token: -0.001,
        output_price_per_token: 0.001,
        capability_reasoning: true,
        capability_code: true,
      });
      // hasBoth && !isMini → 3 (Ollama-style scoring)
      expect(computeQualityScore(model)).toBe(3);
    });
  });

  describe('override precedence is unaffected by corrupt prices', () => {
    it('still returns override score when input price is negative', () => {
      // Overrides are looked up before any price math, so corrupt prices
      // on an override-listed model don't degrade its score.
      const model = makeModel({
        model_name: 'openrouter/auto',
        input_price_per_token: -0.001,
        output_price_per_token: 0,
        capability_reasoning: false,
        capability_code: false,
      });
      expect(computeQualityScore(model)).toBe(5);
    });
  });
});
