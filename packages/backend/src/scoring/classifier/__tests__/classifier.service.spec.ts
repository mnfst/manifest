import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import {
  ClassifierService,
  MIN_DIFFICULTY_CONFIDENCE,
  MIN_REASONING_CONFIDENCE,
} from '../classifier.service';
import { SmartRouterModel, type ModelJson } from '../inference';

/**
 * Hand-built stand-in for the trained model: one word feature per outcome we
 * need to drive, so every mapping branch can be triggered by a single word.
 *  alpha → simple | beta → standard
 *  gamma → hard + reasoning True @0.99 | delta → hard + reasoning False
 *  epsilon → hard + reasoning True @0.73 | zeta → a label outside the tier map
 *  anything else → no features, uniform difficulty (below the gate)
 */
const TEST_MODEL: ModelJson = {
  version: 'test',
  nWord: 6,
  word: {
    ngram: [1, 1],
    vocab: { alpha: 0, beta: 1, gamma: 2, delta: 3, epsilon: 4, zeta: 5 },
    idf: [1, 1, 1, 1, 1, 1],
  },
  char: { ngram: [3, 3], vocab: {}, idf: [] },
  heads: {
    difficulty: {
      classes: ['simple', 'standard', 'hard', 'exotic'],
      intercept: [0, 0, 0, 0],
      coef: [
        [[0, 10]],
        [[1, 10]],
        [
          [2, 10],
          [3, 10],
          [4, 10],
        ],
        [[5, 10]],
      ],
    },
    reasoning: {
      classes: ['False', 'True'],
      binary: true,
      intercept: [0],
      coef: [
        [
          [2, 5],
          [4, 1],
        ],
      ],
    },
    category: { classes: ['general'], intercept: [0], coef: [[]] },
    output_tokens: { regression: true, transform: 'log1p', intercept: [2], coef: [[]] },
  },
};

const gzippedTestModel = () => gzipSync(Buffer.from(JSON.stringify(TEST_MODEL)));

const ask = (text: string) => ({ messages: [{ role: 'user', content: text }] });

describe('ClassifierService', () => {
  let svc: ClassifierService;

  beforeEach(() => {
    delete process.env.SMART_CLASSIFIER_ENABLED;
    svc = new ClassifierService();
  });

  afterAll(() => {
    delete process.env.SMART_CLASSIFIER_ENABLED;
  });

  describe('isEnabled', () => {
    it('is off when the flag is absent', () => {
      expect(svc.isEnabled()).toBe(false);
    });

    it.each(['1', 'true'])('is on for %s', (value) => {
      process.env.SMART_CLASSIFIER_ENABLED = value;
      expect(svc.isEnabled()).toBe(true);
    });

    it.each(['0', 'false', 'yes'])('is off for %s', (value) => {
      process.env.SMART_CLASSIFIER_ENABLED = value;
      expect(svc.isEnabled()).toBe(false);
    });
  });

  describe('onModuleInit', () => {
    it('skips loading the model when disabled', () => {
      svc.onModuleInit();
      expect(svc.classifyTier(ask('alpha'))).toBeNull();
    });

    it('loads the shipped model when enabled and classifies a real request', () => {
      process.env.SMART_CLASSIFIER_ENABLED = '1';
      svc.onModuleInit();

      const result = svc.classifyTier(
        ask('Refactor the payment service to use the new ledger API and keep the tests green.'),
      );

      expect(result).not.toBeNull();
      expect(['simple', 'standard', 'complex', 'reasoning']).toContain(result!.tier);
      expect(result!.confidence).toBeGreaterThanOrEqual(MIN_DIFFICULTY_CONFIDENCE);
    });
  });

  it('exposes the shipped model with all four heads', () => {
    const json = JSON.parse(
      gunzipSync(readFileSync(join(__dirname, '..', 'model.v3.json.gz'))).toString('utf8'),
    ) as ModelJson;
    const classification = new SmartRouterModel(json).classify({
      model: 'auto',
      messages: [{ role: 'user', content: 'write a haiku about routers' }],
    });

    expect(classification.difficulty.label).toEqual(expect.any(String));
    expect(classification.reasoning.label).toEqual(expect.any(String));
    expect(classification.category.label).toEqual(expect.any(String));
    expect(classification.expectedOutputTokens).toEqual(expect.any(Number));
  });

  describe('classifyTier', () => {
    beforeEach(() => {
      svc.loadModel(gzippedTestModel());
    });

    it.each([
      ['alpha', 'simple'],
      ['beta', 'standard'],
      ['gamma', 'reasoning'],
      ['delta', 'complex'],
      ['epsilon', 'complex'],
    ])('maps %s to the %s tier', (word, tier) => {
      expect(svc.classifyTier(ask(word))?.tier).toBe(tier);
    });

    it('promotes hard to reasoning only above the reasoning threshold', () => {
      // epsilon is a `True` reasoning prediction, but below the bar.
      const model = new SmartRouterModel(TEST_MODEL);
      const { reasoning } = model.classify({
        model: 'auto',
        messages: [{ role: 'user', content: 'epsilon' }],
      });
      expect(reasoning.label).toBe('True');
      expect(reasoning.confidence).toBeLessThan(MIN_REASONING_CONFIDENCE);
      expect(svc.classifyTier(ask('epsilon'))?.tier).toBe('complex');
    });

    it('reports the difficulty confidence', () => {
      expect(svc.classifyTier(ask('alpha'))?.confidence).toBeGreaterThan(0.9);
    });

    it('abstains below the difficulty confidence gate', () => {
      expect(svc.classifyTier(ask('nothing recognizable here'))).toBeNull();
    });

    it('abstains on a label with no tier mapping', () => {
      expect(svc.classifyTier(ask('zeta'))).toBeNull();
    });

    it('passes tools, tool_choice and max_tokens through to the model', () => {
      const result = svc.classifyTier({
        messages: [{ role: 'user', content: 'alpha' }],
        tools: [{ function: { name: 'search' } }],
        tool_choice: 'auto',
        max_tokens: 256,
      });
      expect(result?.tier).toBe('simple');
    });
  });
});
