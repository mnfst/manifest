import {
  scoreTokenCount,
  scoreNestedListDepth,
  scoreConditionalLogic,
  scoreCodeToProse,
  scoreConstraintDensity,
} from '../dimensions/structural-dimensions';

describe('scoreTokenCount', () => {
  it('returns negative for very short text', () => {
    expect(scoreTokenCount('hi')).toBeLessThan(0);
  });

  it('returns positive for long text (2000+ chars)', () => {
    expect(scoreTokenCount('x'.repeat(2000))).toBeGreaterThan(0);
  });

  it('returns near zero for ~200 token text', () => {
    const score = scoreTokenCount('x'.repeat(800));
    expect(score).toBeGreaterThanOrEqual(-0.1);
    expect(score).toBeLessThanOrEqual(0.1);
  });

  it('returns -0.5 for text under 50 tokens (< 200 chars)', () => {
    expect(scoreTokenCount('hello')).toBe(-0.5);
  });

  it('returns 0.5 for text over 500 tokens (> 2000 chars)', () => {
    expect(scoreTokenCount('x'.repeat(2100))).toBe(0.5);
  });

  it('interpolates between 200 and 500 tokens', () => {
    const score = scoreTokenCount('x'.repeat(1400));
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(0.3);
  });

  it('returns exactly -0.5 at boundary of 50 tokens (200 chars)', () => {
    expect(scoreTokenCount('x'.repeat(199))).toBe(-0.5);
  });
});

describe('scoreNestedListDepth', () => {
  it('returns 0 for flat text', () => {
    expect(scoreNestedListDepth('just some text')).toBe(0);
  });

  it('returns positive for nested lists', () => {
    const text = '- item\n  - sub-item\n    - deep item';
    expect(scoreNestedListDepth(text)).toBeGreaterThan(0);
  });

  it('detects numbered list indentation', () => {
    const text = '  1. first\n    2. second';
    expect(scoreNestedListDepth(text)).toBeGreaterThan(0);
  });

  it('returns 0.3 for single indent level', () => {
    const text = '  - item one\n  - item two';
    expect(scoreNestedListDepth(text)).toBe(0.3);
  });

  it('returns 0.9 for 3+ indent levels', () => {
    const text = '  - top\n    - mid\n      - deep\n        - deeper';
    expect(scoreNestedListDepth(text)).toBe(0.9);
  });
});

describe('scoreConditionalLogic', () => {
  it('returns 0 when no conditionals', () => {
    expect(scoreConditionalLogic('simple text')).toBe(0);
  });

  it('returns positive for "if...then...otherwise"', () => {
    const text =
      'if the user is admin then show dashboard, otherwise redirect';
    expect(scoreConditionalLogic(text)).toBeGreaterThan(0);
  });

  it('returns high score for 3+ conditionals', () => {
    const text =
      'if x then y. unless z happens. depending on the result, assuming it works, given that the input is valid';
    expect(scoreConditionalLogic(text)).toBe(0.9);
  });

  it('returns 0.3 for exactly one conditional', () => {
    expect(scoreConditionalLogic('otherwise do something else')).toBe(0.3);
  });

  it('returns 0.6 for exactly two conditionals', () => {
    expect(
      scoreConditionalLogic('unless it fails, in case of error handle it'),
    ).toBe(0.6);
  });

  it('detects "provided that" pattern', () => {
    expect(scoreConditionalLogic('provided that x is true')).toBe(0.3);
  });

  it('detects "on condition" pattern', () => {
    expect(scoreConditionalLogic('on condition that it works')).toBe(0.3);
  });
});

describe('scoreCodeToProse', () => {
  it('returns 0 for no code', () => {
    expect(scoreCodeToProse('just plain text')).toBe(0);
  });

  it('returns positive for text with code fences', () => {
    const text = 'Look at this:\n```js\nconst x = 1;\nconst y = 2;\n```\ndone';
    expect(scoreCodeToProse(text)).toBeGreaterThan(0);
  });

  it('handles unclosed code fence', () => {
    const text = 'Here is code:\n```\nconst x = 1;\nmore code';
    expect(() => scoreCodeToProse(text)).not.toThrow();
  });

  it('detects inline code at 0.5 weight', () => {
    const text = 'use `const` and `let` in your code';
    expect(scoreCodeToProse(text)).toBeGreaterThan(0);
  });

  it('returns 0 for empty text', () => {
    expect(scoreCodeToProse('')).toBe(0);
  });

  it('caps at 0.9 for text that is almost entirely code', () => {
    const code = '```\n' + 'const x = 1;\n'.repeat(100) + '```';
    expect(scoreCodeToProse(code)).toBeLessThanOrEqual(0.9);
  });
});

describe('scoreConstraintDensity', () => {
  it('returns 0 for no constraints', () => {
    expect(scoreConstraintDensity('just text')).toBe(0);
  });

  it('returns positive for constraint-rich text', () => {
    const text =
      'at most 5 items, at least 2 required, exactly 3 columns, must not exceed limit';
    expect(scoreConstraintDensity(text)).toBeGreaterThan(0);
  });

  it('detects big-O notation', () => {
    const text =
      'implement an algorithm with O(n log n) time complexity and O(1) space';
    expect(scoreConstraintDensity(text)).toBeGreaterThan(0);
  });

  it('returns 0 for empty text', () => {
    expect(scoreConstraintDensity('')).toBe(0);
  });

  it('returns 0 for whitespace-only text', () => {
    expect(scoreConstraintDensity('   \n\t  ')).toBe(0);
  });

  it('returns 0 for text with no constraint patterns', () => {
    const text = 'This is a long sentence with many words and lots of filler text to make it lengthy enough but nothing special going on here just a plain paragraph about everyday activities like walking running and swimming in the lake on a sunny afternoon during the summer months when the weather is nice.';
    expect(scoreConstraintDensity(text)).toBe(0);
  });

  it('detects "between X and Y" pattern', () => {
    const text = 'between 10 and 20 items must be selected';
    expect(scoreConstraintDensity(text)).toBeGreaterThan(0);
  });

  it('detects "must be" and "should not" patterns', () => {
    const text = 'input must be valid and should not be empty';
    expect(scoreConstraintDensity(text)).toBeGreaterThan(0);
  });
});
