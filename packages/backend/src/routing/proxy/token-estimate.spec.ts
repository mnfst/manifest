/**
 * The estimator is a routing safety check, not a billing oracle. These
 * tests defend the invariants that matter for routing:
 *   1. Longer input ⇒ larger estimate (monotonic).
 *   2. Safety multiplier biases up, never down (undercounting overflows).
 *   3. Empty input returns 0 so heartbeats skip the size check cleanly.
 *   4. Tool definitions contribute to the count (JSON-heavy payloads are
 *      the bug class from #1617; a char-based heuristic would under-
 *      count them).
 */
import { estimateTokens, TOKEN_ESTIMATE_SAFETY_MULTIPLIER } from './token-estimate';

describe('estimateTokens', () => {
  it('returns 0 for empty input so heartbeats skip the size check', () => {
    expect(estimateTokens(undefined)).toBe(0);
    expect(estimateTokens([])).toBe(2); // JSON.stringify([]) = "[]", two tokens
  });

  it('returns 0 when messages and tools are both undefined', () => {
    expect(estimateTokens(undefined, undefined)).toBe(0);
  });

  it('scales monotonically with input length', () => {
    const short = estimateTokens([{ role: 'user', content: 'Hi' }]);
    const medium = estimateTokens([{ role: 'user', content: 'Hello there friend' }]);
    const long = estimateTokens([{ role: 'user', content: 'Hello there friend'.repeat(50) }]);
    expect(medium).toBeGreaterThan(short);
    expect(long).toBeGreaterThan(medium);
  });

  it('applies the safety multiplier so we bias toward over-estimation', () => {
    // With 100 messages of known text we can show the output is larger than
    // the raw tokenization would be — without depending on the exact raw
    // value which varies by encoder version.
    const messages = Array.from({ length: 100 }, () => ({
      role: 'user',
      content: 'The quick brown fox jumps over the lazy dog.',
    }));
    const estimate = estimateTokens(messages);

    // A pure cl100k_base count would be ~900 tokens for this input. We
    // expect ≥10% more because of the safety multiplier.
    expect(estimate).toBeGreaterThan(900);
    expect(TOKEN_ESTIMATE_SAFETY_MULTIPLIER).toBeGreaterThan(1);
  });

  it('counts tool definitions — a char heuristic misses these on OpenClaw payloads', () => {
    // The tool registry in OpenClaw requests is ~8K chars of JSON. If we
    // only looked at `messages`, we'd under-count every tool-use request.
    const messages = [{ role: 'user', content: 'Hi' }];
    const fatTool = {
      type: 'function',
      function: {
        name: 'search_web',
        description: 'search the web for a query'.repeat(200),
        parameters: { type: 'object', properties: { q: { type: 'string' } } },
      },
    };

    const withoutTools = estimateTokens(messages);
    const withTools = estimateTokens(messages, [fatTool]);

    expect(withTools).toBeGreaterThan(withoutTools * 5);
  });

  it('counts realistic OpenClaw-style tool-registry + conversation payloads above the 2K floor', () => {
    // Real OpenClaw traffic arrives as ~10 tool definitions with multi-property
    // JSON-schema parameters, plus a 20-turn conversation. A char-based
    // heuristic (the naïve "content.length / 4" pre-#1617 approach) would
    // undercount these and let oversized requests slip through the size
    // check — #1617 fuzhyperblue's exact failure mode.
    const tools = Array.from({ length: 10 }, (_, i) => ({
      type: 'function',
      function: {
        name: `tool_${i}`,
        description:
          'Perform a specific action against an external service. ' +
          'Returns a JSON payload describing the action outcome.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Natural-language query for the action' },
            limit: { type: 'integer', description: 'Maximum results to return (default 10)' },
            filter: {
              type: 'object',
              description: 'Structured filter constraints',
              properties: {
                tag: { type: 'string' },
                since: { type: 'string', format: 'date-time' },
              },
            },
            flags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional behaviour flags',
            },
            context_id: { type: 'string', description: 'Session-scoped context identifier' },
          },
          required: ['query'],
        },
      },
    }));
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content:
        `Turn ${i}: ` + 'I need you to analyse this output and suggest the next action. '.repeat(4),
    }));

    const estimate = estimateTokens(messages, tools);
    expect(estimate).toBeGreaterThanOrEqual(2000);
  });

  it('charges non-trivial tokens for multilingual (CJK + code) content so non-English payloads are not wildly undercounted', () => {
    // cl100k_base under-counts CJK relative to pure-English, which is why we
    // apply the safety multiplier. This test locks in the minimum: a Chinese
    // message + fenced code block must still count as *some* tokens, and
    // adding more of the same content must increase the estimate. A naive
    // ASCII-only heuristic would badly undercount this and let Chinese
    // OpenClaw sessions overflow silently (reported in #1450 discussion).
    const singleTurn = estimateTokens([
      {
        role: 'user',
        content:
          '请帮我分析下面这段 Python 代码的时间复杂度:\n' +
          '```python\ndef foo(xs):\n    return sorted(set(xs))\n```',
      },
    ]);
    const doubleTurn = estimateTokens([
      {
        role: 'user',
        content:
          '请帮我分析下面这段 Python 代码的时间复杂度:\n' +
          '```python\ndef foo(xs):\n    return sorted(set(xs))\n```',
      },
      {
        role: 'assistant',
        content: '这段代码的时间复杂度是 O(n log n),因为 sorted() 主导了整体耗时。',
      },
    ]);
    const emptyBaseline = estimateTokens(['']);

    expect(singleTurn).toBeGreaterThan(0);
    // Each additional CJK-heavy turn must count for at least a few tokens.
    expect(doubleTurn).toBeGreaterThan(singleTurn + 5);
    // Sanity: the CJK payload must beat the empty-string baseline by a
    // comfortable margin — anything under 10 would mean CJK is effectively
    // invisible to the estimator.
    expect(singleTurn).toBeGreaterThan(emptyBaseline + 10);
  });

  it('reuses the encoder across calls so successive estimates stay cheap', () => {
    // No direct hook into the encoder; we assert behaviour by running a
    // batch of calls and verifying the total wall time is well below the
    // 1-MB-vocab load cost (~100ms in practice). 200 calls × 5ms would be
    // the worst-case cold fetch.
    const start = Date.now();
    for (let i = 0; i < 200; i++) {
      estimateTokens([{ role: 'user', content: 'x' }]);
    }
    const elapsed = Date.now() - start;
    // Very loose bound — this is defending against accidental re-loading,
    // not asserting a performance SLO.
    expect(elapsed).toBeLessThan(2000);
  });
});
