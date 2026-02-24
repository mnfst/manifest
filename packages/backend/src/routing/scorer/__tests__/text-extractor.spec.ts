import {
  extractUserTexts,
  countConversationMessages,
  combinedText,
} from '../text-extractor';

describe('extractUserTexts', () => {
  it('returns empty for empty messages', () => {
    expect(extractUserTexts([])).toEqual([]);
  });

  it('returns empty for system message only', () => {
    expect(
      extractUserTexts([{ role: 'system', content: 'You are a helper' }]),
    ).toEqual([]);
  });

  it('returns empty for developer message only', () => {
    expect(
      extractUserTexts([{ role: 'developer', content: 'instructions' }]),
    ).toEqual([]);
  });

  it('extracts single user message with string content', () => {
    const result = extractUserTexts([
      { role: 'user', content: 'hello world' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('hello world');
    expect(result[0].positionWeight).toBe(1.0);
  });

  it('extracts text from Anthropic array content', () => {
    const result = extractUserTexts([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this' },
          { type: 'image', source: { type: 'base64', data: 'abc' } },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Analyze this');
  });

  it('extracts text from OpenAI array content', () => {
    const result = extractUserTexts([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', image_url: { url: 'https://example.com/img.png' } },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('What is this?');
  });

  it('returns empty for image-only content array', () => {
    const result = extractUserTexts([
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', data: 'abc' } },
        ],
      },
    ]);
    expect(result).toHaveLength(0);
  });

  it('assigns position weights: 1.0, 0.5, 0.25', () => {
    const result = extractUserTexts([
      { role: 'user', content: 'first message' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second message' },
      { role: 'user', content: 'third message' },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0].positionWeight).toBe(0.25);
    expect(result[1].positionWeight).toBe(0.5);
    expect(result[2].positionWeight).toBe(1.0);
  });

  it('only extracts user text, counts all non-system for depth', () => {
    const messages = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
      { role: 'tool', content: '{"result": 42}' },
    ];
    const result = extractUserTexts(messages);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Hello');
  });

  it('gracefully handles content: null', () => {
    const result = extractUserTexts([
      { role: 'user', content: null },
    ]);
    expect(result).toHaveLength(0);
  });

  it('gracefully handles content: undefined', () => {
    const result = extractUserTexts([
      { role: 'user', content: undefined },
    ]);
    expect(result).toHaveLength(0);
  });

  it('gracefully handles missing content field', () => {
    const result = extractUserTexts([{ role: 'user' }]);
    expect(result).toHaveLength(0);
  });

  it('converts number content to string', () => {
    const result = extractUserTexts([{ role: 'user', content: 42 }]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('42');
  });

  it('skips empty string content', () => {
    const result = extractUserTexts([{ role: 'user', content: '' }]);
    expect(result).toHaveLength(0);
  });

  it('joins multiple text blocks from array content with spaces', () => {
    const result = extractUserTexts([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'text', text: 'World' },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Hello World');
  });

  it('assigns weight 0.25 to all messages older than the second-to-last', () => {
    const result = extractUserTexts([
      { role: 'user', content: 'first' },
      { role: 'user', content: 'second' },
      { role: 'user', content: 'third' },
      { role: 'user', content: 'fourth' },
    ]);
    expect(result).toHaveLength(4);
    expect(result[0].positionWeight).toBe(0.25);
    expect(result[1].positionWeight).toBe(0.25);
    expect(result[2].positionWeight).toBe(0.5);
    expect(result[3].positionWeight).toBe(1.0);
  });

  it('preserves original message index across non-user messages', () => {
    const result = extractUserTexts([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second' },
    ]);
    expect(result[0].messageIndex).toBe(1);
    expect(result[1].messageIndex).toBe(3);
  });

  it('skips assistant role messages from text extraction', () => {
    const result = extractUserTexts([
      { role: 'assistant', content: 'I can help' },
    ]);
    expect(result).toHaveLength(0);
  });
});

describe('countConversationMessages', () => {
  it('returns 0 for empty messages', () => {
    expect(countConversationMessages([])).toBe(0);
  });

  it('excludes system and developer messages', () => {
    expect(
      countConversationMessages([
        { role: 'system', content: 'sys' },
        { role: 'developer', content: 'dev' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ]),
    ).toBe(2);
  });

  it('counts tool and assistant messages', () => {
    expect(
      countConversationMessages([
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'tool', content: '{}' },
      ]),
    ).toBe(3);
  });
});

describe('combinedText', () => {
  it('joins chunks with newlines', () => {
    const result = combinedText([
      { text: 'hello', positionWeight: 1, messageIndex: 0 },
      { text: 'world', positionWeight: 0.5, messageIndex: 1 },
    ]);
    expect(result).toBe('hello\nworld');
  });

  it('returns empty string for empty array', () => {
    expect(combinedText([])).toBe('');
  });
});
