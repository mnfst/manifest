import { SmartRouterModel, type HeadResult, type ModelJson } from '../inference';

/**
 * Two word features (`alpha`, `beta`) plus two char features, so a request can
 * exercise both vectorizer blocks, unknown terms, and every head kind.
 * Feature indices: word 0..1, char 2..3 (offset by nWord).
 */
const model = (overrides: Partial<ModelJson> = {}): ModelJson => ({
  version: 'test',
  nWord: 2,
  word: { ngram: [1, 2], vocab: { alpha: 0, 'alpha beta': 1 }, idf: [2, 3] },
  char: { ngram: [3, 5], vocab: { ' al': 0, lph: 1 }, idf: [1, 1] },
  heads: {
    difficulty: {
      classes: ['easy', 'hard'],
      intercept: [0, 1],
      coef: [[[0, 1]], [[1, 2]]],
    },
    reasoning: {
      classes: ['False', 'True'],
      binary: true,
      intercept: [0.5],
      coef: [[[0, 2]]],
    },
    category: { classes: ['general'], intercept: [0], coef: [[]] },
    output_tokens: { regression: true, transform: 'log1p', intercept: [2], coef: [[[0, 1]]] },
  },
  ...overrides,
});

const serialized = 'alpha beta alpha ab';

describe('SmartRouterModel', () => {
  it('vectorizes word and char blocks, ignoring unknown terms', () => {
    const result = new SmartRouterModel(model()).classifySerialized(serialized);

    // Every head answered, so both vectorizer blocks produced usable features.
    expect(result.difficulty.label).toBe('hard');
    expect(Object.keys(result.difficulty.scores)).toEqual(['easy', 'hard']);
    expect(result.category.label).toBe('general');
    expect(result.category.confidence).toBeCloseTo(1);
  });

  it('produces a softmax distribution that sums to one', () => {
    const { difficulty } = new SmartRouterModel(model()).classifySerialized(serialized);
    const total = Object.values(difficulty.scores).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1);
    expect(difficulty.confidence).toBeGreaterThan(0.5);
  });

  it('scores the binary head with a sigmoid over the single logit', () => {
    const { reasoning } = new SmartRouterModel(model()).classifySerialized(serialized);
    expect(reasoning.scores.False + reasoning.scores.True).toBeCloseTo(1);
    expect(reasoning.label).toBe('True');
  });

  it('applies the log1p inverse transform on the regression head', () => {
    const withTransform = new SmartRouterModel(model()).classifySerialized(serialized);
    const raw = model();
    delete raw.heads.output_tokens.transform;
    const withoutTransform = new SmartRouterModel(raw).classifySerialized(serialized);

    expect(withTransform.expectedOutputTokens).toBeCloseTo(
      Math.expm1(withoutTransform.expectedOutputTokens),
    );
  });

  it('reports zero expected output tokens when the model has no such head', () => {
    const noRegression = model();
    delete noRegression.heads.output_tokens;
    expect(
      new SmartRouterModel(noRegression).classifySerialized(serialized).expectedOutputTokens,
    ).toBe(0);
  });

  it('returns intercept-only scores when no term is in the vocabulary', () => {
    const { difficulty, reasoning } = new SmartRouterModel(model()).classifySerialized(
      'zzz qqq wwww',
    );
    // exp(0) vs exp(1) — the intercepts alone.
    expect(difficulty.scores.hard).toBeCloseTo(Math.E / (1 + Math.E));
    expect(reasoning.scores.True).toBeCloseTo(1 / (1 + Math.exp(-0.5)));
  });

  it('handles words shorter than the char n-gram window', () => {
    // " ab " is 4 chars: n=3 slides once, n=4 fits exactly, n=5 is skipped.
    const result = new SmartRouterModel(model()).classifySerialized('ab');
    expect(result.difficulty.confidence).toBeGreaterThan(0);
  });

  it('handles text with no word tokens at all', () => {
    expect(new SmartRouterModel(model()).classifySerialized('!').difficulty.label).toBe('hard');
  });

  it('survives a zero-norm feature block', () => {
    const zeroIdf = model();
    zeroIdf.word.idf = [0, 0];
    zeroIdf.char.idf = [0, 0];
    const { difficulty } = new SmartRouterModel(zeroIdf).classifySerialized(serialized);
    // All weights are zero, so only the intercepts survive.
    expect(difficulty.scores.hard).toBeCloseTo(Math.E / (1 + Math.E));
  });

  it('returns an undefined label for a head with no class list', () => {
    const classless = model();
    delete classless.heads.category.classes;
    expect(new SmartRouterModel(classless).classifySerialized(serialized).category.scores).toEqual(
      {},
    );
  });

  it('classifies a raw chat request through the serializer', () => {
    const fromRequest = new SmartRouterModel(model()).classify({
      model: 'auto',
      messages: [{ role: 'user', content: 'alpha beta' }],
    });
    expect(fromRequest.difficulty.label).toBe('hard');
  });

  describe('gate', () => {
    const result: HeadResult = { label: 'hard', confidence: 0.8, scores: { hard: 0.8 } };

    it('returns the label at or above the threshold', () => {
      expect(SmartRouterModel.gate(result, 0.8)).toBe('hard');
    });

    it('returns null below the threshold', () => {
      expect(SmartRouterModel.gate(result, 0.9)).toBeNull();
    });
  });
});
