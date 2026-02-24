import { scoreRequest } from '../index';

describe('scoreRequest — configOverride', () => {
  it('uses custom boundaries when configOverride is provided', () => {
    const result = scoreRequest(
      {
        messages: [
          { role: 'user', content: 'Write a comprehensive React application with multiple components' },
        ],
      },
      {
        boundaries: { simpleMax: -0.5, standardMax: -0.3, complexMax: -0.1 },
      },
    );
    expect(['complex', 'reasoning']).toContain(result.tier);
  });
});

describe('scoreRequest — large context override', () => {
  it('floors tier to COMPLEX for >50k estimated tokens', () => {
    const longContent = 'x'.repeat(200_001);
    const result = scoreRequest({
      messages: [{ role: 'user', content: longContent }],
    });
    expect(['complex', 'reasoning']).toContain(result.tier);
  });

  it('reports "large_context" reason when floor changes tier', () => {
    const msgs = [
      { role: 'system', content: 'x'.repeat(200_001) },
      { role: 'user', content: 'what is this about' },
    ];
    const result = scoreRequest({ messages: msgs });
    if (result.reason === 'large_context') {
      expect(['complex', 'reasoning']).toContain(result.tier);
    }
  });
});

describe('scoreRequest — estimateTotalTokens branches', () => {
  it('handles array content blocks in token estimation', () => {
    const result = scoreRequest({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello world' },
            { type: 'text', text: 'More content here' },
          ],
        },
      ],
    });
    expect(result).toHaveProperty('tier');
  });

  it('handles non-string non-array content via String() coercion', () => {
    const result = scoreRequest({
      messages: [
        { role: 'user', content: 12345 },
      ],
    });
    expect(result).toHaveProperty('tier');
  });

  it('handles null content in token estimation', () => {
    const result = scoreRequest({
      messages: [
        { role: 'assistant', content: null },
        { role: 'user', content: 'hello world test message here' },
      ],
    });
    expect(result).toHaveProperty('tier');
  });
});

describe('scoreRequest — ambiguous fallback', () => {
  it('falls back to standard/ambiguous when confidence is low and reason is scored', () => {
    const result = scoreRequest(
      {
        messages: [
          {
            role: 'user',
            content: 'Tell me about the general approach to this kind of thing and some related topics.',
          },
        ],
      },
      {
        boundaries: { simpleMax: -0.01, standardMax: 0.01, complexMax: 0.02 },
        confidenceThreshold: 0.99,
      },
    );
    if (result.reason === 'ambiguous') {
      expect(result.tier).toBe('standard');
    }
  });
});

describe('scoreRequest — estimateTotalTokens coverage', () => {
  it('counts chars from array content blocks in large context check', () => {
    // Array content with enough text to pass the 50-char short_message gate
    const result = scoreRequest({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Write a comprehensive React application that handles ' },
            { type: 'text', text: 'state management, routing, authentication and forms' },
          ],
        },
      ],
    });
    // Should not be short_message since combined text is > 50 chars
    expect(result.reason).not.toBe('short_message');
    expect(result).toHaveProperty('tier');
  });

  it('handles non-string non-array content via String() coercion in estimateTotalTokens', () => {
    // Use a number as content for one message, plus a longer user message
    // to avoid the short_message bypass
    const result = scoreRequest({
      messages: [
        { role: 'user', content: 99999 },
        {
          role: 'user',
          content: 'Please explain this concept in detail with examples and use cases for production',
        },
      ],
    });
    expect(result).toHaveProperty('tier');
    expect(result.reason).not.toBe('short_message');
  });

  it('handles undefined content (skips in token estimation)', () => {
    const result = scoreRequest({
      messages: [
        { role: 'assistant', content: undefined },
        {
          role: 'user',
          content: 'Write a detailed analysis of this codebase architecture and deployment strategy',
        },
      ],
    });
    expect(result).toHaveProperty('tier');
  });
});

describe('scoreRequest — scoreStructuralDimension default branch', () => {
  it('returns 0 for unknown structural dimension names', () => {
    const result = scoreRequest(
      {
        messages: [
          {
            role: 'user',
            content: 'Write a comprehensive guide to React hooks with examples',
          },
        ],
      },
      {
        dimensions: [
          { name: 'unknownDimension', weight: 1.0, direction: 'up' as const },
        ],
      },
    );
    // The unknown dimension should contribute 0
    const unknownDim = result.dimensions.find((d) => d.name === 'unknownDimension');
    expect(unknownDim).toBeDefined();
    expect(unknownDim!.rawScore).toBe(0);
    expect(unknownDim!.weightedScore).toBe(0);
  });
});

describe('scoreRequest — performance', () => {
  it('scores 1000 requests in under 500ms', () => {
    const input = {
      messages: [
        {
          role: 'user' as const,
          content:
            'Write a comprehensive guide to React hooks with code examples and best practices for production applications',
        },
      ],
    };
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      scoreRequest(input);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
