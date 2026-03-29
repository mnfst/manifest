import { toResponsesRequest } from '../chatgpt-adapter';

describe('ChatGPT Adapter – toResponsesRequest', () => {
  it('converts string content to input_text parts and sets default instructions', () => {
    const body = {
      messages: [{ role: 'user', content: 'Hello world' }],
    };
    const result = toResponsesRequest(body, 'gpt-5');

    expect(result.model).toBe('gpt-5');
    expect(result.input).toEqual([
      { role: 'user', content: [{ type: 'input_text', text: 'Hello world' }] },
    ]);
    expect(result.stream).toBe(true);
    expect(result.store).toBe(false);
    expect(result.instructions).toBe('You are a helpful assistant.');
  });

  it('extracts system message as instructions', () => {
    const body = {
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
      ],
    };
    const result = toResponsesRequest(body, 'gpt-5.3-codex');

    expect(result.instructions).toBe('You are helpful.');
    expect(result.input).toEqual([{ role: 'user', content: [{ type: 'input_text', text: 'Hi' }] }]);
  });

  it('extracts developer message as instructions', () => {
    const body = {
      messages: [
        { role: 'developer', content: 'Follow the house style.' },
        { role: 'user', content: 'Hi' },
      ],
    };
    const result = toResponsesRequest(body, 'gpt-5.3-codex');

    expect(result.instructions).toBe('Follow the house style.');
    expect(result.input).toEqual([{ role: 'user', content: [{ type: 'input_text', text: 'Hi' }] }]);
  });

  it('combines system and developer text blocks into instructions', () => {
    const body = {
      messages: [
        { role: 'system', content: [{ type: 'text', text: 'Be helpful.' }] },
        { role: 'developer', content: [{ type: 'text', text: 'Prefer concise answers.' }] },
        { role: 'user', content: 'Hi' },
      ],
    };
    const result = toResponsesRequest(body, 'gpt-5.3-codex');

    expect(result.instructions).toBe('Be helpful.\n\nPrefer concise answers.');
  });

  it('remaps multipart "text" type to "input_text" for user messages', () => {
    const body = {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    };
    const result = toResponsesRequest(body, 'gpt-5');
    const input = result.input as { content: { type: string }[] }[];

    expect(input[0].content[0].type).toBe('input_text');
  });

  it('normalizes null content into an empty text part', () => {
    const body = { messages: [{ role: 'user', content: null }] };
    const result = toResponsesRequest(body, 'gpt-5');

    expect(result.input).toEqual([{ role: 'user', content: [{ type: 'input_text', text: '' }] }]);
  });

  it('remaps content to "output_text" for assistant messages', () => {
    const body = {
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello there!' },
      ],
    };
    const result = toResponsesRequest(body, 'gpt-5');
    const input = result.input as { role: string; content: { type: string; text: string }[] }[];

    expect(input[0].content[0].type).toBe('input_text');
    expect(input[1].content[0].type).toBe('output_text');
    expect(input[1].content[0].text).toBe('Hello there!');
  });

  it('remaps multipart "text" to "output_text" for assistant messages', () => {
    const body = {
      messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Response' }] }],
    };
    const result = toResponsesRequest(body, 'gpt-5');
    const input = result.input as { content: { type: string }[] }[];

    expect(input[0].content[0].type).toBe('output_text');
  });

  it('preserves non-text content part types', () => {
    const body = {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this' },
            { type: 'image_url', image_url: { url: 'http://example.com/img.png' } },
          ],
        },
      ],
    };
    const result = toResponsesRequest(body, 'gpt-5');
    const input = result.input as { content: { type: string }[] }[];

    expect(input[0].content[0].type).toBe('input_text');
    expect(input[0].content[1].type).toBe('image_url');
  });

  it('filters system and developer messages from input array', () => {
    const body = {
      messages: [
        { role: 'system', content: 'Be concise.' },
        { role: 'developer', content: 'Use markdown.' },
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Answer' },
        { role: 'user', content: 'Follow-up' },
      ],
    };
    const result = toResponsesRequest(body, 'gpt-5');
    const input = result.input as { role: string }[];

    expect(input).toHaveLength(3);
    expect(
      input.every((message) => message.role !== 'system' && message.role !== 'developer'),
    ).toBe(true);
  });

  it('handles missing messages gracefully', () => {
    const result = toResponsesRequest({}, 'gpt-5');

    expect(result.input).toEqual([]);
    expect(result.instructions).toBe('You are a helpful assistant.');
  });

  it('extracts text parts from multipart system content', () => {
    const body = {
      messages: [
        { role: 'system', content: [{ type: 'text', text: 'parts' }] },
        { role: 'user', content: 'Hi' },
      ],
    };
    const result = toResponsesRequest(body, 'gpt-5');

    expect(result.instructions).toBe('parts');
  });

  it('falls back to default instructions when system content has no text', () => {
    const body = {
      messages: [
        { role: 'system', content: [{ type: 'image_url', image_url: { url: 'http://x.test' } }] },
        { role: 'user', content: 'Hi' },
      ],
    };
    const result = toResponsesRequest(body, 'gpt-5');

    expect(result.instructions).toBe('You are a helpful assistant.');
  });

  it('falls back to default instructions when developer content is null', () => {
    const body = {
      messages: [
        { role: 'developer', content: null },
        { role: 'user', content: 'Hi' },
      ],
    };
    const result = toResponsesRequest(body, 'gpt-5');

    expect(result.instructions).toBe('You are a helpful assistant.');
    expect(result.input).toEqual([{ role: 'user', content: [{ type: 'input_text', text: 'Hi' }] }]);
  });
});
