import { lookupWithVariants } from './model-fallback';

/**
 * Pin down the *resolution order* of lookupWithVariants — i.e. which variant
 * is tried first, second, third, and that null is only returned after every
 * transformation has been exhausted. The chained tests in
 * `model-fallback.spec.ts` exercise each step in isolation; these tests
 * exercise the *chain* by populating the cache so that multiple steps could
 * resolve, then asserting which one wins.
 */

function makePricingSync(
  entries: Map<
    string,
    { input: number; output: number; contextWindow?: number; displayName?: string }
  >,
) {
  return {
    lookupPricing: jest.fn((key: string) => entries.get(key) ?? null),
    getAll: jest.fn(() => entries),
  };
}

describe('lookupWithVariants resolution order', () => {
  describe('exact match wins', () => {
    it('short-circuits before alias / :free / dot are tried', () => {
      const cache = new Map([
        ['mistralai/open-mistral-nemo', { input: 1, output: 1 }],
        ['mistralai/mistral-nemo', { input: 2, output: 2 }],
        ['mistralai/open-mistral-nemo:free', { input: 3, output: 3 }],
      ]);
      const sync = makePricingSync(cache);

      const result = lookupWithVariants(sync, 'mistralai', 'open-mistral-nemo');

      expect(result).toEqual({ input: 1, output: 1 });
      expect(sync.lookupPricing).toHaveBeenNthCalledWith(1, 'mistralai/open-mistral-nemo');
    });

    it('wins over date-stripped variant', () => {
      const cache = new Map([
        ['anthropic/claude-opus-4-6-20260301', { input: 5, output: 5 }],
        ['anthropic/claude-opus-4-6', { input: 99, output: 99 }],
      ]);

      const result = lookupWithVariants(
        makePricingSync(cache),
        'anthropic',
        'claude-opus-4-6-20260301',
      );

      expect(result).toEqual({ input: 5, output: 5 });
    });
  });

  describe('alias path runs before dot/dash/date', () => {
    it('falls through exact miss and resolves via OPENROUTER_NAME_ALIASES', () => {
      const cache = new Map([['mistralai/mistral-nemo', { input: 7, output: 7 }]]);
      const sync = makePricingSync(cache);

      const result = lookupWithVariants(sync, 'mistralai', 'open-mistral-nemo');

      expect(result).toEqual({ input: 7, output: 7 });
      expect(sync.lookupPricing).toHaveBeenNthCalledWith(1, 'mistralai/open-mistral-nemo');
      expect(sync.lookupPricing).toHaveBeenNthCalledWith(2, 'mistralai/mistral-nemo');
    });

    it('alias success short-circuits before dot/dash variants are tried', () => {
      const cache = new Map([['mistralai/open-mistral-7b', { input: 9, output: 9 }]]);
      const sync = makePricingSync(cache);

      const result = lookupWithVariants(sync, 'mistralai', 'mistral-tiny');

      expect(result).toEqual({ input: 9, output: 9 });
      expect(sync.lookupPricing).toHaveBeenNthCalledWith(1, 'mistralai/mistral-tiny');
      expect(sync.lookupPricing).toHaveBeenNthCalledWith(2, 'mistralai/open-mistral-7b');
    });

    it('tries every alias before falling through to dot variant', () => {
      // 'voxtral-small-2507' contains alias 'voxtral-small' → 'voxtral-small-24b'.
      // Other aliases ('open-mistral-nemo', 'mistral-tiny') do not match.
      const cache = new Map([['mistralai/voxtral-small-24b-2507', { input: 33, output: 33 }]]);

      const result = lookupWithVariants(makePricingSync(cache), 'mistralai', 'voxtral-small-2507');

      expect(result).toEqual({ input: 33, output: 33 });
    });
  });

  describe('dot variant runs before date-strip', () => {
    it('succeeds when exact and alias both miss', () => {
      const cache = new Map([['anthropic/claude-sonnet-4.6', { input: 11, output: 11 }]]);
      const sync = makePricingSync(cache);

      const result = lookupWithVariants(sync, 'anthropic', 'claude-sonnet-4-6');

      expect(result).toEqual({ input: 11, output: 11 });
      expect(sync.lookupPricing).toHaveBeenNthCalledWith(1, 'anthropic/claude-sonnet-4-6');
      expect(sync.lookupPricing).toHaveBeenNthCalledWith(2, 'anthropic/claude-sonnet-4.6');
    });

    it('wins over date-strip when both could match', () => {
      const cache = new Map([
        ['anthropic/claude-sonnet-4.6-20260301', { input: 13, output: 13 }],
        ['anthropic/claude-sonnet-4-6', { input: 99, output: 99 }],
      ]);

      const result = lookupWithVariants(
        makePricingSync(cache),
        'anthropic',
        'claude-sonnet-4-6-20260301',
      );

      // Dot variant runs *before* date strip — that hit must win.
      expect(result).toEqual({ input: 13, output: 13 });
    });
  });

  describe('date-strip runs before :free and Google variant', () => {
    it('succeeds when exact / alias / dot / dash all miss', () => {
      const cache = new Map([['openai/gpt-5-turbo', { input: 17, output: 17 }]]);
      const sync = makePricingSync(cache);

      const result = lookupWithVariants(sync, 'openai', 'gpt-5-turbo-20260101');

      expect(result).toEqual({ input: 17, output: 17 });
      const calls = sync.lookupPricing.mock.calls.map((c) => c[0]);
      const exactIdx = calls.indexOf('openai/gpt-5-turbo-20260101');
      const strippedIdx = calls.indexOf('openai/gpt-5-turbo');
      expect(exactIdx).toBe(0);
      expect(strippedIdx).toBeGreaterThan(exactIdx);
    });

    it('wins over :free fallback when both could match', () => {
      const cache = new Map([
        ['anthropic/claude-3-haiku', { input: 19, output: 19 }],
        ['anthropic/claude-3-haiku-20260101:free', { input: 99, output: 99 }],
      ]);

      const result = lookupWithVariants(
        makePricingSync(cache),
        'anthropic',
        'claude-3-haiku-20260101',
      );

      expect(result).toEqual({ input: 19, output: 19 });
    });
  });

  describe(':free fallback runs after date-strip, before Google variant', () => {
    it('succeeds when no earlier transformation matched', () => {
      const cache = new Map([['google/gemma-3n-e2b-it:free', { input: 0, output: 0 }]]);
      const sync = makePricingSync(cache);

      const result = lookupWithVariants(sync, 'google', 'gemma-3n-e2b-it');

      expect(result).toEqual({ input: 0, output: 0 });
      const calls = sync.lookupPricing.mock.calls.map((c) => c[0]);
      expect(calls[0]).toBe('google/gemma-3n-e2b-it');
      expect(calls).toContain('google/gemma-3n-e2b-it:free');
    });

    it('wins over Google variant strip when both could match', () => {
      const cache = new Map([
        ['google/gemma-it-latest:free', { input: 21, output: 21 }],
        ['google/gemma-it', { input: 99, output: 99 }],
      ]);

      const result = lookupWithVariants(makePricingSync(cache), 'google', 'gemma-it-latest');

      expect(result).toEqual({ input: 21, output: 21 });
    });
  });

  describe('-latest cache scan is the last resort', () => {
    it('finds dated cache entry when nothing else matched', () => {
      const cache = new Map([['mistralai/ministral-14b-2512', { input: 23, output: 23 }]]);

      const result = lookupWithVariants(
        makePricingSync(cache),
        'mistralai',
        'ministral-14b-latest',
      );

      expect(result).toEqual({ input: 23, output: 23 });
    });

    it('does NOT run when an earlier step already matched', () => {
      const cache = new Map([
        ['mistralai/voxtral-small-24b-latest', { input: 25, output: 25 }],
        ['mistralai/voxtral-small-24b-2507', { input: 99, output: 99 }],
      ]);
      const sync = makePricingSync(cache);

      const result = lookupWithVariants(sync, 'mistralai', 'voxtral-small-latest');

      // Alias path matched first; cache-scan path never reached.
      expect(result).toEqual({ input: 25, output: 25 });
      expect(sync.getAll).not.toHaveBeenCalled();
    });

    it('runs only after Google-variant strip misses', () => {
      // 'mistral-7b-latest' triggers BOTH Google-variant strip
      // (gives 'mistral-7b') and -latest scan (gives 'mistral-7b-*').
      // Cache has only the dated form — order must reach scan path.
      const cache = new Map([
        ['mistralai/mistral-7b-2503', { input: 29, output: 29 }],
        ['mistralai/mistral-7b-2401', { input: 31, output: 31 }],
      ]);
      const sync = makePricingSync(cache);

      const result = lookupWithVariants(sync, 'mistralai', 'mistral-7b-latest');

      // First dated entry wins (Map iteration = insertion order).
      expect(result).toEqual({ input: 29, output: 29 });
      expect(sync.getAll).toHaveBeenCalled();
    });
  });

  describe('exhaustion returns null', () => {
    it('returns null when every transformation misses', () => {
      const cache = new Map<
        string,
        { input: number; output: number; contextWindow?: number; displayName?: string }
      >();
      const sync = makePricingSync(cache);

      const result = lookupWithVariants(sync, 'anthropic', 'claude-opus-4-6-20260301');

      expect(result).toBeNull();
      const calls = sync.lookupPricing.mock.calls.map((c) => c[0]);
      // Several transformation steps were attempted.
      expect(calls[0]).toBe('anthropic/claude-opus-4-6-20260301');
      expect(calls).toContain('anthropic/claude-opus-4.6-20260301');
      expect(calls).toContain('anthropic/claude-opus-4-6');
      expect(calls).toContain('anthropic/claude-opus-4.6');
      expect(calls).toContain('anthropic/claude-opus-4-6-20260301:free');
    });

    it('returns null even after -latest scan finds zero starting-with matches', () => {
      const cache = new Map([
        ['openai/gpt-4o', { input: 99, output: 99 }],
        ['mistralai/other-model-2512', { input: 99, output: 99 }],
      ]);
      const sync = makePricingSync(cache);

      const result = lookupWithVariants(sync, 'mistralai', 'ministral-14b-latest');

      expect(result).toBeNull();
      // Confirm the -latest scan path WAS reached.
      expect(sync.getAll).toHaveBeenCalled();
    });

    it('returns null when alias would apply but the aliased key is also missing', () => {
      const cache = new Map<string, { input: number; output: number }>();
      const sync = makePricingSync(cache);

      const result = lookupWithVariants(sync, 'mistralai', 'open-mistral-nemo');

      expect(result).toBeNull();
      const calls = sync.lookupPricing.mock.calls.map((c) => c[0]);
      expect(calls).toContain('mistralai/open-mistral-nemo');
      expect(calls).toContain('mistralai/mistral-nemo');
    });

    it('returns null when only an unrelated provider has a similar entry', () => {
      // Cross-provider isolation: prefix must be respected at every step.
      const cache = new Map([['anthropic/claude-sonnet-4.6', { input: 99, output: 99 }]]);

      const result = lookupWithVariants(makePricingSync(cache), 'openai', 'claude-sonnet-4-6');

      expect(result).toBeNull();
    });
  });

  describe('Google-variant-strip reachability', () => {
    it('is only reached after every prior step missed', () => {
      const cache = new Map([['google/gemini-2.5-pro', { input: 27, output: 27 }]]);
      const sync = makePricingSync(cache);

      const result = lookupWithVariants(sync, 'google', 'gemini-2.5-pro-preview-03-25');

      expect(result).toEqual({ input: 27, output: 27 });
      const calls = sync.lookupPricing.mock.calls.map((c) => c[0]);
      expect(calls[0]).toBe('google/gemini-2.5-pro-preview-03-25');
      expect(calls.indexOf('google/gemini-2.5-pro')).toBeGreaterThan(0);
    });
  });
});
