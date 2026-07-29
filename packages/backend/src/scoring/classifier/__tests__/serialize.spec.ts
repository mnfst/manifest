import { scrub, serializeRequest, type ChatRequest } from '../serialize';

describe('scrub', () => {
  it('returns falsy text untouched', () => {
    expect(scrub('')).toBe('');
  });

  it('masks every secret shape in one pass', () => {
    const input = [
      'mail me at dev.user+tag@example.com',
      // No dotted TLD, so the email rule leaves it to the URL-credential rule.
      'https://user:hunter2@localhost/x',
      '/Users/guillaume/code /home/guillaume/code C:\\Users\\Guillaume\\code',
      'api_key: "abcdefgh12345678"',
      'sk-abcdefghijklmnop',
      'resp_abcdefghijklmnop',
      'deadbeefdeadbeefdeadbeef',
      '192.168.1.254',
      '123456789012345',
    ].join(' ');

    const out = scrub(input);

    expect(out).toContain('<EMAIL>');
    expect(out).toContain('https://<CRED>@localhost/x');
    expect(out).toContain('/Users/<USER>');
    expect(out).toContain('/home/<USER>');
    expect(out).toContain('C:\\Users\\<USER>');
    expect(out).toContain('<SECRET>');
    expect(out).toContain('<ID>');
    expect(out).toContain('<HEX>');
    expect(out).toContain('<IP>');
    expect(out).toContain('<NUM>');
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('sk-abcdefghijklmnop');
  });
});

describe('serializeRequest', () => {
  it('renders META with python-style scalars for an empty request', () => {
    expect(serializeRequest({})).toBe('META: turns=0 tools=0 max_tokens=None tool_choice=None');
  });

  it('renders non-null META scalars (number, string, object)', () => {
    const out = serializeRequest({
      max_tokens: 512,
      tool_choice: { type: 'function', function: { name: 'search' } },
    });
    expect(out).toContain('max_tokens=512');
    expect(out).toContain('tool_choice={"type":"function"');

    expect(serializeRequest({ tool_choice: 'auto' })).toContain('tool_choice=auto');
  });

  it('lists tool names from both OpenAI and Anthropic shapes and skips nameless tools', () => {
    const out = serializeRequest({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ function: { name: 'search' } }, { name: 'bash' }, {}],
    });
    expect(out).toContain('TOOLS: search, bash');
  });

  it('flattens string, array, nested-array, image and object content', () => {
    const out = serializeRequest({
      messages: [
        {
          role: 'user',
          content: [
            'lead text',
            [{ text: 'nested part' }],
            { type: 'image_url', image_url: { url: 'https://x/y.png' } },
            { type: 'text', text: 'tail text' },
            { content: 'inner content' },
            { type: 'text', text: '' },
            { type: 'thinking' },
          ],
        },
      ],
    });
    expect(out).toContain('LATEST_USER: lead text nested part [image] tail text inner content');
  });

  it('keeps an empty latest-user turn from breaking the cap', () => {
    const out = serializeRequest({ messages: [{ role: 'user', content: '' }] });
    expect(out).toContain('LATEST_USER: ');
  });

  it('stringifies non-string, non-array content', () => {
    expect(serializeRequest({ messages: [{ role: 'user', content: 42 }] })).toContain(
      'LATEST_USER: 42',
    );
  });

  it('falls back to tool-call names, then to a bare marker', () => {
    const out = serializeRequest({
      messages: [
        { role: 'user', content: 'go' },
        { role: 'assistant', tool_calls: [{ function: { name: 'read_file' } }, {}] },
        { role: 'assistant', tool_calls: [] },
        { role: 'tool', content: 'done' },
      ],
    });
    expect(out).toContain('ASSISTANT: [calls: read_file]');
    expect(out).toContain('ASSISTANT: [tool_call]');
  });

  it('labels a message with no role as unknown and drops empty ones', () => {
    const out = serializeRequest({
      messages: [{ content: 'orphan turn' }, { content: '' }, { role: 'user', content: 'go' }],
    });
    expect(out).toContain('UNKNOWN: orphan turn');
    expect(out.split('\n').filter((l) => l.trim().startsWith(':'))).toHaveLength(0);
  });

  it('keeps only the last `keepLast` non-system turns and never repeats the latest user', () => {
    const messages = Array.from({ length: 12 }, (_, i) => ({
      role: 'assistant',
      content: `turn ${i}`,
    }));
    messages.push({ role: 'user', content: 'final question' });

    const out = serializeRequest({ messages }, 3);

    expect(out).toContain('LATEST_USER: final question');
    expect(out).toContain('ASSISTANT: turn 10');
    expect(out).toContain('ASSISTANT: turn 11');
    expect(out).not.toContain('turn 9');
    // The latest user message is not echoed inside RECENT.
    expect(out.match(/final question/g)).toHaveLength(1);
  });

  it('emits FIRST_USER only when it differs from the latest user', () => {
    const single = serializeRequest({ messages: [{ role: 'user', content: 'only one' }] });
    expect(single).not.toContain('FIRST_USER');

    const multi = serializeRequest({
      messages: [
        { role: 'user', content: 'opening ask' },
        { role: 'user', content: 'follow up' },
      ],
    });
    expect(multi).toContain('FIRST_USER: opening ask');
    expect(multi).toContain('LATEST_USER: follow up');
  });

  it('appends the system prompt last', () => {
    const out = serializeRequest({
      messages: [
        { role: 'system', content: 'you are a router' },
        { role: 'user', content: 'hello' },
      ],
    });
    expect(out).toContain('SYSTEM: you are a router');
    expect(out).not.toContain('RECENT:');
  });

  it('caps long turns and truncates the whole serialization', () => {
    const long = 'word '.repeat(400).trim();
    const capped = serializeRequest({ messages: [{ role: 'user', content: long }] });
    expect(capped).toContain('…');

    const truncated = serializeRequest({ messages: [{ role: 'user', content: long }] }, 8, 120);
    expect(truncated).toHaveLength(122);
    expect(truncated.endsWith(' …')).toBe(true);
  });
});

describe('ChatRequest typing', () => {
  it('accepts a full OpenAI-shaped body', () => {
    const request: ChatRequest = {
      model: 'auto',
      max_tokens: null,
      tool_choice: 'none',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ name: 'bash' }],
    };
    expect(serializeRequest(request)).toContain('max_tokens=None');
  });
});
