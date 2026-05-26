import {
  coerceContentToText,
  detectRequestBodyFormat,
  extractAssistantReply,
  extractRecordedConversationMessages,
  extractRequestMessages,
  extractResponseMessages,
  extractRequestTools,
  normalizeRole,
} from '../src/chat-message';

describe('chat-message recording helpers', () => {
  it('extracts OpenAI chat-completions messages unchanged', () => {
    const messages = [{ role: 'user', content: 'hello' }];

    expect(extractRequestMessages({ messages })).toBe(messages);
    expect(detectRequestBodyFormat({ messages })).toBe('openai');
  });

  it('extracts OpenAI Responses string input and instructions as turns', () => {
    expect(
      extractRequestMessages({
        instructions: 'Be concise.',
        input: 'Summarize the request.',
      }),
    ).toEqual([
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'Summarize the request.' },
    ]);
    expect(detectRequestBodyFormat({ input: 'Summarize the request.' })).toBe('openai');
  });

  it('extracts OpenAI Responses input items, function calls, and tool outputs', () => {
    const messages = extractRequestMessages({
      input: [
        'first',
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'look' },
            { type: 'input_image', image_url: 'https://example.test/image.png' },
          ],
        },
        { role: 'assistant', content: [{ type: 'output_text', text: 'done' }] },
        { type: 'function_call', call_id: 'call_1', name: 'search', arguments: '{"q":"x"}' },
        { type: 'function_call_output', call_id: 'call_1', output: { ok: true } },
      ],
    });

    expect(messages).toEqual([
      { role: 'user', content: 'first' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'look' },
          { type: 'image_url', image_url: { url: 'https://example.test/image.png' } },
        ],
      },
      { role: 'assistant', content: [{ type: 'text', text: 'done' }] },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'search', arguments: '{"q":"x"}' },
          },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '{"ok":true}' },
    ]);
    expect(detectRequestBodyFormat({ input: [] })).toBe('openai');
  });

  it('extracts Responses API function tools for the tools tab', () => {
    expect(
      extractRequestTools({
        tools: [
          {
            type: 'function',
            name: 'lookup',
            description: 'Lookup data',
            parameters: { type: 'object' },
          },
          { type: 'web_search_preview' },
        ],
      }),
    ).toEqual([
      { type: 'function', function: { name: 'lookup', description: 'Lookup data' } },
      { type: 'web_search_preview', function: { name: 'web_search_preview' } },
    ]);
  });

  it('coerces Responses image parts into readable placeholders', () => {
    expect(
      coerceContentToText([
        { type: 'input_text', text: 'look' },
        { type: 'input_image', image_url: 'https://example.test/image.png' },
      ]),
    ).toBe('look\n[image]');
  });

  it('normalizes known roles and rejects unknown role values', () => {
    expect(normalizeRole('system')).toBe('system');
    expect(normalizeRole('user')).toBe('user');
    expect(normalizeRole('assistant')).toBe('assistant');
    expect(normalizeRole('tool')).toBe('tool');
    expect(normalizeRole('developer')).toBe('unknown');
  });

  it('coerces fallback content shapes to readable text', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(coerceContentToText(null)).toBe('');
    expect(coerceContentToText('ready')).toBe('ready');
    expect(coerceContentToText({ ok: true })).toBe('{"ok":true}');
    expect(coerceContentToText(circular)).toBe('[object Object]');
    expect(
      coerceContentToText([undefined, 'ignored', { type: 'input_audio' }, { text: 123 }]),
    ).toBe('');
  });

  it('handles compact and malformed Responses input items defensively', () => {
    expect(
      extractRequestMessages({
        instructions: '   ',
        input: [
          { role: 'user', content: 'direct user text' },
          { role: 'user', content: [{ type: 'input_text', text: 'single user text' }] },
          { role: 'assistant', content: [{ type: 'file_search_call', id: 'fs_1' }] },
          { role: 123, content: 7 },
          { type: 'function_call' },
          { type: 'function_call_output' },
          { type: 'function_call_output', call_id: 'call_2', output: 'done' },
          42,
        ],
      }),
    ).toEqual([
      { role: 'user', content: 'direct user text' },
      { role: 'user', content: 'single user text' },
      { role: 'assistant', content: [{ type: 'file_search_call', id: 'fs_1' }] },
      { role: 'user', content: 7 },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: undefined,
            type: 'function',
            function: { name: 'unknown', arguments: '{}' },
          },
        ],
      },
      { role: 'tool', tool_call_id: undefined, content: '' },
      { role: 'tool', tool_call_id: 'call_2', content: 'done' },
    ]);
    expect(extractRequestMessages(null)).toEqual([]);
  });

  it('handles missing, existing, and malformed request tools', () => {
    const existingTool = {
      type: 'function',
      function: { name: 'lookup', description: 'Lookup data' },
    };

    expect(extractRequestTools(null)).toEqual([]);
    expect(extractRequestTools({ tools: 'invalid' as unknown as unknown[] })).toEqual([]);
    expect(
      extractRequestTools({
        tools: [existingTool, { type: 'function' }, { label: 'unknown' }, 'invalid'],
      }),
    ).toEqual([
      existingTool,
      { type: 'function', function: { name: undefined, description: undefined } },
      { type: undefined, function: { name: undefined } },
    ]);
  });

  it('detects non-OpenAI request body formats and empty payloads', () => {
    expect(detectRequestBodyFormat(null)).toBe('empty');
    expect(detectRequestBodyFormat({ contents: [] })).toBe('gemini');
    expect(detectRequestBodyFormat({ system: 'Be concise.' })).toBe('claude');
    expect(detectRequestBodyFormat({ prompt: 'hello' })).toBe('unknown');
  });

  it('extracts assistant replies from JSON chat-completions responses', () => {
    expect(extractAssistantReply(null)).toBeNull();
    expect(extractAssistantReply({ type: 'text', body: 'ok' })).toBeNull();
    expect(
      extractAssistantReply({
        type: 'json',
        body: { choices: [{ message: { role: 'assistant', content: 'done' } }] },
      }),
    ).toEqual({ role: 'assistant', content: 'done' });
    expect(extractResponseMessages({ type: 'json', body: { choices: [{}] } })).toEqual([]);
    expect(extractAssistantReply({ type: 'json', body: {} })).toBeNull();
  });

  it('extracts OpenAI Responses output messages as response turns', () => {
    const response = {
      type: 'json',
      body: {
        output: [
          { type: 'reasoning', summary: [] },
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'final answer' }],
          },
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'implicit assistant answer' }],
          },
          { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: '{"id":1}' },
          { type: 'function_call', id: 'call_2' },
          { type: 'function_call' },
        ],
      },
    };

    expect(extractResponseMessages(response)).toEqual([
      { role: 'assistant', content: [{ type: 'text', text: 'final answer' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'implicit assistant answer' }] },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'lookup', arguments: '{"id":1}' },
          },
        ],
      },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_2',
            type: 'function',
            function: { name: 'unknown', arguments: '{}' },
          },
        ],
      },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: undefined,
            type: 'function',
            function: { name: 'unknown', arguments: '{}' },
          },
        ],
      },
    ]);
    expect(extractAssistantReply(response)).toEqual({
      role: 'assistant',
      content: [{ type: 'text', text: 'final answer' }],
    });
  });

  it('appends captured OpenAI responses after request turns', () => {
    expect(
      extractRecordedConversationMessages(
        { input: 'hello' },
        {
          type: 'json',
          body: {
            output: [
              {
                type: 'message',
                role: 'assistant',
                content: [{ type: 'output_text', text: 'hi back' }],
              },
            ],
          },
        },
      ),
    ).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: [{ type: 'text', text: 'hi back' }] },
    ]);
    expect(
      extractRecordedConversationMessages(
        { system: 'Claude system prompt' },
        {
          type: 'json',
          body: {
            output: [
              {
                type: 'message',
                role: 'assistant',
                content: [{ type: 'output_text', text: 'do not append' }],
              },
            ],
          },
        },
      ),
    ).toEqual([]);
  });
});
