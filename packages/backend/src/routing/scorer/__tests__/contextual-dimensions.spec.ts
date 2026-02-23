import {
  scoreExpectedOutputLength,
  scoreRepetitionRequests,
  scoreToolCount,
  scoreConversationDepth,
} from '../dimensions/contextual-dimensions';

describe('scoreExpectedOutputLength', () => {
  it('returns 0 for simple text', () => {
    expect(scoreExpectedOutputLength('say hi')).toBe(0);
  });

  it('returns positive for "comprehensive guide"', () => {
    expect(
      scoreExpectedOutputLength('write a comprehensive guide'),
    ).toBeGreaterThan(0);
  });

  it('boosts score with high max_tokens', () => {
    const withoutTokens = scoreExpectedOutputLength('some text');
    const withTokens = scoreExpectedOutputLength('some text', 8500);
    expect(withTokens).toBeGreaterThan(withoutTokens);
  });

  it('caps at 0.9', () => {
    expect(
      scoreExpectedOutputLength(
        'write a comprehensive, detailed, thorough, exhaustive guide',
        10000,
      ),
    ).toBeLessThanOrEqual(0.9);
  });

  it('returns 0.6 for 2+ length signals without max_tokens', () => {
    expect(
      scoreExpectedOutputLength('write a comprehensive, detailed report'),
    ).toBe(0.6);
  });

  it('adds 0.2 for max_tokens between 4001 and 8000', () => {
    const without = scoreExpectedOutputLength('some text');
    const with5k = scoreExpectedOutputLength('some text', 5000);
    expect(with5k - without).toBeCloseTo(0.2);
  });

  it('does not boost for max_tokens <= 4000', () => {
    const without = scoreExpectedOutputLength('some text');
    const with3k = scoreExpectedOutputLength('some text', 3000);
    expect(with3k).toBe(without);
  });
});

describe('scoreRepetitionRequests', () => {
  it('returns 0 for no pattern', () => {
    expect(scoreRepetitionRequests('just some text')).toBe(0);
  });

  it('returns positive for "give me 5 options"', () => {
    expect(scoreRepetitionRequests('give me 5 options')).toBeGreaterThan(
      0,
    );
  });

  it('returns 0 for "1 option"', () => {
    expect(scoreRepetitionRequests('give me 1 option')).toBe(0);
  });

  it('returns high score for 10+ variations', () => {
    expect(
      scoreRepetitionRequests('generate 15 examples'),
    ).toBeGreaterThanOrEqual(0.9);
  });

  it('returns 0.3 for "2 variations"', () => {
    expect(scoreRepetitionRequests('give me 2 variations')).toBe(0.3);
  });

  it('returns 0.3 for "3 alternatives"', () => {
    expect(scoreRepetitionRequests('provide 3 alternatives')).toBe(0.3);
  });

  it('matches "ways to" pattern', () => {
    expect(scoreRepetitionRequests('list 5 ways to do it')).toBeGreaterThan(0);
  });
});

describe('scoreToolCount', () => {
  it('returns 0 for undefined tools', () => {
    expect(scoreToolCount()).toBe(0);
  });

  it('returns 0 for empty tools array', () => {
    expect(scoreToolCount([])).toBe(0);
  });

  it('returns 0.1 for 1-2 tools', () => {
    expect(scoreToolCount([{}, {}])).toBe(0.1);
  });

  it('returns 0.6 for 6-10 tools', () => {
    const tools = Array.from({ length: 8 }, () => ({}));
    expect(scoreToolCount(tools)).toBe(0.6);
  });

  it('boosts score for specific tool_choice', () => {
    const tools = [{}];
    expect(
      scoreToolCount(tools, { type: 'tool', name: 'get_weather' }),
    ).toBeGreaterThan(scoreToolCount(tools));
  });

  it('boosts for tool_choice "any"', () => {
    expect(scoreToolCount([{}], 'any')).toBeGreaterThan(
      scoreToolCount([{}]),
    );
  });

  it('returns 0 for tool_choice "none"', () => {
    const tools = Array.from({ length: 5 }, () => ({}));
    expect(scoreToolCount(tools, 'none')).toBe(0);
  });

  it('returns 0.3 for 3-5 tools', () => {
    const tools = Array.from({ length: 4 }, () => ({}));
    expect(scoreToolCount(tools)).toBe(0.3);
  });

  it('returns 0.9 for 11+ tools', () => {
    const tools = Array.from({ length: 15 }, () => ({}));
    expect(scoreToolCount(tools)).toBe(0.9);
  });

  it('boosts for tool_choice "required"', () => {
    expect(scoreToolCount([{}], 'required')).toBeGreaterThan(
      scoreToolCount([{}]),
    );
  });

  it('caps boosted score at 0.9', () => {
    const tools = Array.from({ length: 15 }, () => ({}));
    expect(scoreToolCount(tools, 'required')).toBeLessThanOrEqual(0.9);
  });
});

describe('scoreConversationDepth', () => {
  it('returns 0 for 1-2 messages', () => {
    expect(scoreConversationDepth(2)).toBe(0);
  });

  it('returns moderate score for 15 messages', () => {
    const score = scoreConversationDepth(15);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(0.5);
  });

  it('returns 0.7 for 20+ messages', () => {
    expect(scoreConversationDepth(25)).toBe(0.7);
  });

  it('returns 0.1 for 3-5 messages', () => {
    expect(scoreConversationDepth(4)).toBe(0.1);
  });

  it('returns 0.3 for 6-10 messages', () => {
    expect(scoreConversationDepth(8)).toBe(0.3);
  });

  it('returns 0 for exactly 1 message', () => {
    expect(scoreConversationDepth(1)).toBe(0);
  });
});
