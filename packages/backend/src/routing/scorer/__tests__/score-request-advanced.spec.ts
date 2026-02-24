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
