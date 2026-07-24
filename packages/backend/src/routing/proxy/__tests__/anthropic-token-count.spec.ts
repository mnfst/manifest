import { countAnthropicInputTokens } from '../anthropic-token-count';

describe('countAnthropicInputTokens', () => {
  it('returns a positive count for an empty or malformed body', () => {
    expect(countAnthropicInputTokens(null)).toBe(1);
    expect(countAnthropicInputTokens({})).toBe(1);
  });

  it('counts system text, messages, and tool definitions', () => {
    const messageOnly = countAnthropicInputTokens({
      messages: [{ role: 'user', content: 'Explain this repository.' }],
    });
    const withSystemAndTools = countAnthropicInputTokens({
      system: 'You are a coding assistant.',
      messages: [{ role: 'user', content: 'Explain this repository.' }],
      tools: [
        {
          name: 'read_file',
          description: 'Read a file from the repository',
          input_schema: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path'],
          },
        },
      ],
    });

    expect(messageOnly).toBeGreaterThan(1);
    expect(withSystemAndTools).toBeGreaterThan(messageOnly);
  });

  it('uses a fixed image estimate instead of counting base64 bytes as text', () => {
    const makeBody = (data: string) => ({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data },
            },
          ],
        },
      ],
    });

    expect(countAnthropicInputTokens(makeBody('a'))).toBe(
      countAnthropicInputTokens(makeBody('a'.repeat(100_000))),
    );
  });

  it('does not recurse forever on repeated object references', () => {
    const content: Record<string, unknown> = { type: 'text', text: 'hello' };
    content.self = content;

    expect(
      countAnthropicInputTokens({ messages: [{ role: 'user', content: [content, content] }] }),
    ).toBeGreaterThan(1);
  });

  it('counts scalar metadata and tolerates cyclic arrays', () => {
    const cyclic: unknown[] = [42, true];
    cyclic.push(cyclic);

    const count = countAnthropicInputTokens({
      system: cyclic,
      messages: [{ role: 'user', content: false }],
    });

    expect(count).toBeGreaterThan(1);
  });
});
