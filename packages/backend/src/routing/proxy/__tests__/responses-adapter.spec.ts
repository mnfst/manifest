import {
  collectResponsesSseResponse,
  createResponsesStreamTransformer,
  fromChatCompletionResponse,
  toChatCompletionsRequest,
  toNativeResponsesRequest,
} from '../responses-adapter';
import { createAnthropicStreamTransformer } from '../anthropic-adapter';

/** Ordered list of every event payload's `type` in a concatenated SSE string. */
function eventTypes(sse: string): string[] {
  const types: string[] = [];
  for (const line of sse.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const json = line.slice(6).trim();
    if (json === '[DONE]') {
      types.push('[DONE]');
      continue;
    }
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed?.type === 'string') types.push(parsed.type);
    } catch {
      /* ignore */
    }
  }
  return types;
}

/** Parses the data payload of the first event with the given `type`. */
function firstEventData(sse: string, type: string): Record<string, any> | null {
  for (const line of sse.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const json = line.slice(6).trim();
    if (json === '[DONE]') continue;
    try {
      const parsed = JSON.parse(json);
      if (parsed?.type === type) return parsed;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Parses every event payload with the given `type`. */
function allEventData(sse: string, type: string): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (const line of sse.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const json = line.slice(6).trim();
    if (json === '[DONE]') continue;
    try {
      const parsed = JSON.parse(json);
      if (parsed?.type === type) events.push(parsed);
    } catch {
      /* ignore */
    }
  }
  return events;
}

describe('Responses adapter', () => {
  describe('toChatCompletionsRequest', () => {
    it('converts string input, instructions, tools, and max_output_tokens', () => {
      const result = toChatCompletionsRequest({
        model: 'gpt-5',
        instructions: 'Be concise.',
        input: 'Hello',
        max_output_tokens: 123,
        temperature: 0.2,
        top_p: 0.9,
        stream: true,
        metadata: { trace: 'abc' },
        store: true,
        user: 'user-1',
        parallel_tool_calls: false,
        tools: [
          {
            type: 'function',
            name: 'lookup',
            description: 'Lookup data',
            parameters: { type: 'object' },
            strict: true,
          },
        ],
        tool_choice: { type: 'function', name: 'lookup' },
      });

      expect(result.messages).toEqual([
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Hello' },
      ]);
      expect(result.max_tokens).toBe(123);
      expect(result.temperature).toBe(0.2);
      expect(result.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'lookup',
            description: 'Lookup data',
            parameters: { type: 'object' },
            strict: true,
          },
        },
      ]);
      expect(result.tool_choice).toEqual({ type: 'function', function: { name: 'lookup' } });
    });

    it('maps Responses json_schema text format to Chat Completions response_format', () => {
      const result = toChatCompletionsRequest({
        input: 'Return patient data.',
        text: {
          format: {
            type: 'json_schema',
            name: 'patient_summary',
            description: 'Structured patient summary',
            schema: {
              type: 'object',
              properties: { summary: { type: 'string' } },
              required: ['summary'],
              additionalProperties: false,
            },
            strict: true,
          },
        },
      });

      expect(result.response_format).toEqual({
        type: 'json_schema',
        json_schema: {
          name: 'patient_summary',
          description: 'Structured patient summary',
          schema: {
            type: 'object',
            properties: { summary: { type: 'string' } },
            required: ['summary'],
            additionalProperties: false,
          },
          strict: true,
        },
      });
    });

    it('converts custom tools to string-input functions and drops hosted tools', () => {
      const result = toChatCompletionsRequest({
        input: 'Run the command.',
        tools: [
          { type: 'custom', name: 'shell', description: 'Run a shell command' },
          { type: 'web_search_preview' },
        ],
        tool_choice: { type: 'custom', name: 'shell' },
      });

      expect(result.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'shell',
            description: 'Run a shell command',
            parameters: {
              type: 'object',
              properties: { input: { type: 'string' } },
              required: ['input'],
              additionalProperties: false,
            },
          },
        },
      ]);
      expect(result.tool_choice).toEqual({ type: 'function', function: { name: 'shell' } });
    });

    it.each(['auto', 'required', 'none'])(
      'keeps %s tool_choice when at least one fallback tool remains',
      (toolChoice) => {
        const result = toChatCompletionsRequest({
          input: 'Use the local tool.',
          tools: [{ type: 'function', name: 'local_lookup', parameters: { type: 'object' } }],
          tool_choice: toolChoice,
        });

        expect(result.tool_choice).toBe(toolChoice);
      },
    );

    it('drops a hosted tool choice when that tool cannot cross the fallback boundary', () => {
      const result = toChatCompletionsRequest({
        input: 'Search the web.',
        tools: [
          { type: 'function', name: 'local_lookup', parameters: { type: 'object' } },
          { type: 'web_search_preview' },
        ],
        tool_choice: { type: 'web_search_preview' },
      });

      expect(result.tools).toEqual([
        expect.objectContaining({ function: expect.objectContaining({ name: 'local_lookup' }) }),
      ]);
      expect(result).not.toHaveProperty('tool_choice');
    });

    it.each(['auto', 'required', 'none'])(
      'drops %s tool_choice when every Responses tool is hosted',
      (toolChoice) => {
        const result = toChatCompletionsRequest({
          input: 'Search the web.',
          tools: [{ type: 'web_search_preview' }, { type: 'mcp', server_label: 'docs' }],
          tool_choice: toolChoice,
        });

        expect(result).not.toHaveProperty('tools');
        expect(result).not.toHaveProperty('tool_choice');
      },
    );

    it('drops a forced function choice when its tool was not converted', () => {
      const result = toChatCompletionsRequest({
        input: 'Run it.',
        tools: [{ type: 'custom', name: 'shell' }],
        tool_choice: { type: 'custom', name: 'missing_tool' },
      });

      expect(result.tools).toHaveLength(1);
      expect(result).not.toHaveProperty('tool_choice');
    });

    it('maps Responses json_object text format to Chat Completions response_format', () => {
      const result = toChatCompletionsRequest({
        input: 'Return JSON.',
        text: { format: { type: 'json_object' } },
      });

      expect(result.response_format).toEqual({ type: 'json_object' });
    });

    it('omits Chat Completions response_format for text or absent Responses formats', () => {
      expect(
        toChatCompletionsRequest({
          input: 'Return text.',
          text: { format: { type: 'text' } },
        }),
      ).not.toHaveProperty('response_format');
      expect(toChatCompletionsRequest({ input: 'Return text.' })).not.toHaveProperty(
        'response_format',
      );
    });

    it('converts item lists, images, function calls, and tool outputs', () => {
      const result = toChatCompletionsRequest({
        input: [
          'first',
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'look' },
              { type: 'input_image', image_url: 'https://example.test/image.png' },
            ],
          },
          { role: 'user', content: [{ type: 'input_text', text: 'single text' }] },
          { role: 'user', content: [{ type: 'input_audio', audio: 'abc' }] },
          { role: 'assistant', content: [{ type: 'output_text', text: 'done' }] },
          { type: 'function_call', call_id: 'call_1', name: 'search', arguments: '{"q":"x"}' },
          { type: 'function_call_output', call_id: 'call_1', output: { ok: true } },
        ],
        tools: [{ type: 'web_search_preview' }],
        tool_choice: 'auto',
      });

      expect(result.messages).toEqual([
        { role: 'user', content: 'first' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'look' },
            { type: 'image_url', image_url: { url: 'https://example.test/image.png' } },
          ],
        },
        { role: 'user', content: 'single text' },
        { role: 'user', content: [{ type: 'input_audio', audio: 'abc' }] },
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
      expect(result).not.toHaveProperty('tools');
      expect(result).not.toHaveProperty('tool_choice');
    });

    it('normalizes Responses developer messages for older Chat fallback providers', () => {
      const result = toChatCompletionsRequest({
        input: [{ role: 'developer', content: [{ type: 'input_text', text: 'Be concise.' }] }],
      });

      expect(result.messages).toEqual([{ role: 'system', content: 'Be concise.' }]);
    });

    it('converts custom tool-call history through the Chat function shape', () => {
      const result = toChatCompletionsRequest({
        input: [
          {
            type: 'custom_tool_call',
            call_id: 'call_shell',
            name: 'shell',
            input: 'echo hello',
          },
          {
            type: 'custom_tool_call_output',
            call_id: 'call_shell',
            output: 'hello',
          },
        ],
      });

      expect(result.messages).toEqual([
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_shell',
              type: 'function',
              function: { name: 'shell', arguments: '{"input":"echo hello"}' },
            },
          ],
        },
        { role: 'tool', tool_call_id: 'call_shell', content: 'hello' },
      ]);
    });

    it('uses safe defaults for malformed input items', () => {
      const result = toChatCompletionsRequest({
        input: [
          42,
          { role: 1, content: 7 },
          { type: 'function_call' },
          { type: 'function_call_output', output: undefined },
        ],
      });
      const messages = result.messages as Record<string, unknown>[];

      expect(messages[0]).toEqual({ role: 'user', content: 7 });
      expect(messages[1]).toMatchObject({
        role: 'assistant',
        content: null,
        tool_calls: [{ type: 'function', function: { name: 'unknown', arguments: '{}' } }],
      });
      expect(messages[2]).toMatchObject({ role: 'tool', content: '' });
    });
  });

  it('builds native Responses requests with resolved model and default flags', () => {
    expect(toNativeResponsesRequest({ input: 'hi' }, 'gpt-4o')).toEqual({
      input: 'hi',
      model: 'gpt-4o',
      stream: false,
      store: false,
    });
    expect(toNativeResponsesRequest({ input: 'hi', stream: true, store: true }, 'gpt-4o')).toEqual({
      input: 'hi',
      model: 'gpt-4o',
      stream: true,
      store: true,
    });
  });

  it('can add default instructions for native Responses backends that require them', () => {
    expect(
      toNativeResponsesRequest({ input: 'hi' }, 'gpt-5.4', { defaultInstructions: true }),
    ).toMatchObject({
      input: 'hi',
      model: 'gpt-5.4',
      instructions: 'You are a helpful assistant.',
    });

    expect(
      toNativeResponsesRequest(
        { input: 'hi', instructions: 'Follow the house style.' },
        'gpt-5.4',
        { defaultInstructions: true },
      ).instructions,
    ).toBe('Follow the house style.');
  });

  it('can normalize SDK Responses input for native backends that require input lists', () => {
    expect(toNativeResponsesRequest({ input: 'hi' }, 'gpt-5.4', { inputList: true }).input).toEqual(
      [{ role: 'user', content: [{ type: 'input_text', text: 'hi' }] }],
    );

    expect(
      toNativeResponsesRequest(
        {
          input: [
            'first',
            { role: 'user', content: 'second' },
            { role: 'assistant', content: [{ type: 'text', text: 'third' }] },
            { type: 'function_call_output', call_id: 'call_1', output: 'ok' },
            42,
          ],
        },
        'gpt-5.4',
        { inputList: true },
      ).input,
    ).toEqual([
      { role: 'user', content: [{ type: 'input_text', text: 'first' }] },
      { role: 'user', content: [{ type: 'input_text', text: 'second' }] },
      { role: 'assistant', content: [{ type: 'output_text', text: 'third' }] },
      { type: 'function_call_output', call_id: 'call_1', output: 'ok' },
    ]);
  });

  it('passes typed non-message Responses items through when normalizing native input', () => {
    const reasoning = { type: 'reasoning', id: 'rs_1', summary: [] };
    const itemReference = { type: 'item_reference', id: 'fc_1' };
    const result = toNativeResponsesRequest(
      {
        input: [{ type: 'message', role: 'user', content: 'hello' }, reasoning, itemReference],
      },
      'gpt-5.4',
    ).input as unknown[];

    expect(result).toEqual([
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello' }] },
      reasoning,
      itemReference,
    ]);
    expect(result[1]).toBe(reasoning);
    expect(result[2]).toBe(itemReference);
  });

  it('does not add roles to typed non-message Responses items in native input lists', () => {
    const reasoning = { type: 'reasoning', id: 'rs_1', summary: [] };
    const itemReference = { type: 'item_reference', id: 'fc_1' };
    const result = toNativeResponsesRequest(
      {
        input: [
          { type: 'message', role: 'assistant', content: [{ type: 'text', text: 'done' }] },
          reasoning,
          itemReference,
        ],
      },
      'gpt-5.4',
      { inputList: true },
    ).input as unknown[];

    expect(result).toEqual([
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'done' }] },
      reasoning,
      itemReference,
    ]);
    expect(result[1]).toBe(reasoning);
    expect(result[2]).toBe(itemReference);
  });

  it('normalizes legacy image_url content parts in native Responses input lists', () => {
    expect(
      toNativeResponsesRequest(
        {
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: 'look' },
                {
                  type: 'image_url',
                  image_url: { url: 'https://example.test/image.png', detail: 'low' },
                },
              ],
            },
          ],
        },
        'gpt-5.4',
      ).input,
    ).toEqual([
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'look' },
          {
            type: 'input_image',
            image_url: 'https://example.test/image.png',
            detail: 'low',
          },
        ],
      },
    ]);
  });

  it('can force streaming for native backends that always return SSE', () => {
    expect(
      toNativeResponsesRequest({ input: 'hi', stream: false }, 'gpt-5.4', {
        forceStream: true,
      }).stream,
    ).toBe(true);
  });

  it('strips Codex-subscription unsupported params and forces store=false', () => {
    const result = toNativeResponsesRequest(
      {
        input: 'hi',
        temperature: 0.3,
        top_p: 0.5,
        max_output_tokens: 50,
        metadata: { x: '1' },
        safety_identifier: 'probe',
        prompt_cache_retention: '24h',
        truncation: 'auto',
        store: true,
      },
      'gpt-5.4-mini',
      { stripCodexUnsupported: true },
    );
    expect(result).not.toHaveProperty('temperature');
    expect(result).not.toHaveProperty('top_p');
    expect(result).not.toHaveProperty('max_output_tokens');
    expect(result).not.toHaveProperty('metadata');
    expect(result).not.toHaveProperty('safety_identifier');
    expect(result).not.toHaveProperty('prompt_cache_retention');
    expect(result).not.toHaveProperty('truncation');
    expect(result.store).toBe(false);
  });

  it('preserves Codex-subscription unsupported params when the strip flag is off', () => {
    const result = toNativeResponsesRequest(
      { input: 'hi', temperature: 0.3, top_p: 0.5 },
      'gpt-5.4-mini',
    );
    expect(result.temperature).toBe(0.3);
    expect(result.top_p).toBe(0.5);
  });

  describe('fromChatCompletionResponse', () => {
    it('converts text, tool calls, and usage to a Response object', () => {
      const result = fromChatCompletionResponse(
        {
          id: 'chatcmpl_1',
          object: 'chat.completion',
          created: 1234,
          model: 'gpt-4o',
          choices: [
            {
              message: {
                content: [{ type: 'text', text: 'Hello' }],
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'lookup', arguments: '{"id":1}' },
                  },
                ],
              },
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 3,
            total_tokens: 13,
            cache_read_tokens: 4,
          },
        },
        'fallback-model',
      );

      expect(result.object).toBe('response');
      expect(result.created_at).toBe(1234);
      expect(result.model).toBe('gpt-4o');
      expect(result.output).toEqual([
        expect.objectContaining({
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Hello', annotations: [] }],
        }),
        expect.objectContaining({
          type: 'function_call',
          call_id: 'call_1',
          name: 'lookup',
          arguments: '{"id":1}',
        }),
      ]);
      expect(result.usage).toEqual({
        input_tokens: 10,
        input_tokens_details: { cached_tokens: 4 },
        output_tokens: 3,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: 13,
      });
    });

    it('restores a Chat function result to a custom tool call', () => {
      const result = fromChatCompletionResponse(
        {
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_shell',
                    type: 'function',
                    function: { name: 'shell', arguments: '{"input":"echo hello"}' },
                  },
                ],
              },
            },
          ],
        },
        'claude-sonnet-4',
        { toolTypesByName: { shell: 'custom' } },
      );

      expect(result.output).toEqual([
        expect.objectContaining({
          type: 'custom_tool_call',
          call_id: 'call_shell',
          name: 'shell',
          input: 'echo hello',
          status: 'completed',
        }),
      ]);
    });

    it.each([
      ['"echo hello"', 'echo hello'],
      ['already raw input', 'already raw input'],
    ])('restores custom input from %s', (argumentsValue, expectedInput) => {
      const result = fromChatCompletionResponse(
        {
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_shell',
                    type: 'function',
                    function: { name: 'shell', arguments: argumentsValue },
                  },
                ],
              },
            },
          ],
        },
        'claude-sonnet-4',
        { toolTypesByName: { shell: 'custom' } },
      );

      expect(result.output).toEqual([
        expect.objectContaining({ type: 'custom_tool_call', input: expectedInput }),
      ]);
    });

    it('handles missing choices, non-string content, and missing usage', () => {
      const result = fromChatCompletionResponse({ choices: [{ message: { content: 7 } }] }, 'm');
      expect(result.model).toBe('m');
      expect(result.output).toEqual([]);
      expect(result.usage).toBeNull();
    });

    it('keeps tool calls when the structured-output tool name does not match', () => {
      const result = fromChatCompletionResponse(
        {
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'lookup', arguments: '{"id":1}' },
                  },
                ],
              },
            },
          ],
        },
        'claude-sonnet-4',
        { structuredOutputToolName: 'patient_summary' },
      );

      expect(result.output).toEqual([
        expect.objectContaining({
          type: 'function_call',
          call_id: 'call_1',
          name: 'lookup',
          arguments: '{"id":1}',
        }),
      ]);
    });

    it('uses safe defaults for malformed structured-output tool calls', () => {
      const result = fromChatCompletionResponse(
        {
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  null,
                  { id: 'bad_call', type: 'function' },
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'patient_summary' },
                  },
                ],
              },
            },
          ],
        },
        'claude-sonnet-4',
        {
          structuredOutputToolName: 'patient_summary',
          textFormat: { type: 'text' },
        },
      );

      expect(result.output).toEqual([
        expect.objectContaining({
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '{}', annotations: [] }],
        }),
      ]);
      expect(result.text).toEqual({ format: { type: 'text' } });
    });

    it('unwraps the configured structured-output tool call into response text', () => {
      const schema = { type: 'object', properties: { title: { type: 'string' } } };
      const result = fromChatCompletionResponse(
        {
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'patient_summary', arguments: '{"title":"ok"}' },
                  },
                ],
              },
            },
          ],
        },
        'claude-sonnet-4',
        {
          structuredOutputToolName: 'patient_summary',
          textFormat: {
            type: 'json_schema',
            name: 'patient_summary',
            description: 'Patient summary',
            schema,
            strict: true,
          },
        },
      );

      expect(result.output).toEqual([
        expect.objectContaining({
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '{"title":"ok"}', annotations: [] }],
        }),
      ]);
      expect(result.text).toEqual({
        format: {
          type: 'json_schema',
          name: 'patient_summary',
          description: 'Patient summary',
          schema,
          strict: true,
        },
      });
    });
  });

  describe('collectResponsesSseResponse', () => {
    it('returns the completed response object when present', () => {
      const response = {
        id: 'resp_1',
        object: 'response',
        output: [{ type: 'message' }],
        usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
      };
      const result = collectResponsesSseResponse(
        `event: response.completed\ndata: ${JSON.stringify({ response })}\n\n`,
      );

      expect(result).toEqual(response);
    });

    it('keeps collected text when the completed response omits output', () => {
      const response = {
        id: 'resp_1',
        object: 'response',
        output: [],
        usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
      };
      const result = collectResponsesSseResponse(
        [
          'event: response.output_text.delta\ndata: {"delta":"Hi"}',
          `event: response.completed\ndata: ${JSON.stringify({ response })}`,
          '',
        ].join('\n\n'),
      );

      expect(result.output).toEqual([
        expect.objectContaining({
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Hi', annotations: [] }],
        }),
      ]);
    });

    it('falls back to collected output text and ignores malformed events', () => {
      const result = collectResponsesSseResponse(
        [
          'event: response.output_text.delta\ndata: {"delta":"Hi"}',
          'event: response.output_text.delta\ndata: not-json',
          '',
        ].join('\n\n'),
      );

      expect(result.object).toBe('response');
      expect(result.output).toEqual([
        expect.objectContaining({
          type: 'message',
          content: [{ type: 'output_text', text: 'Hi', annotations: [] }],
        }),
      ]);
    });

    it('collects function_call items emitted via output_item.added + arguments.delta', () => {
      // Codex Responses streams the tool call via item.added + delta events
      // and ships `response.completed` with `output: []`. Without the SSE
      // collector picking up these events, the SDK sees an empty output
      // array even though tokens were billed.
      const completed = {
        id: 'resp_1',
        object: 'response',
        output: [],
        usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
      };
      const sse = [
        'event: response.output_item.added\ndata: {"output_index":0,"item":{"type":"function_call","id":"fc_1","call_id":"call_1","name":"get_weather","arguments":""}}',
        'event: response.function_call_arguments.delta\ndata: {"output_index":0,"delta":"{\\"city\\":"}',
        'event: response.function_call_arguments.delta\ndata: {"output_index":0,"delta":"\\"Paris\\"}"}',
        `event: response.completed\ndata: ${JSON.stringify({ response: completed })}`,
        '',
      ].join('\n\n');

      const result = collectResponsesSseResponse(sse);
      const output = result.output as Array<Record<string, unknown>>;

      expect(output).toHaveLength(1);
      expect(output[0]).toEqual(
        expect.objectContaining({
          type: 'function_call',
          id: 'fc_1',
          call_id: 'call_1',
          name: 'get_weather',
          arguments: '{"city":"Paris"}',
        }),
      );
    });

    it('preserves text output alongside a function call at a non-zero output_index', () => {
      const completed = {
        id: 'resp_2',
        object: 'response',
        output: [],
        usage: { input_tokens: 8, output_tokens: 4, total_tokens: 12 },
      };
      const sse = [
        'event: response.output_text.delta\ndata: {"delta":"Let me check."}',
        'event: response.output_item.added\ndata: {"output_index":1,"item":{"type":"function_call","id":"fc_2","call_id":"call_2","name":"search"}}',
        'event: response.function_call_arguments.delta\ndata: {"output_index":1,"delta":"{\\"q\\":\\"test\\"}"}',
        `event: response.completed\ndata: ${JSON.stringify({ response: completed })}`,
        '',
      ].join('\n\n');

      const result = collectResponsesSseResponse(sse);
      const output = result.output as Array<Record<string, unknown>>;

      // Text-then-function order is preserved: text first (added by
      // withCollectedTextOutput), function_call second.
      expect(output).toHaveLength(2);
      expect(output[0]).toEqual(
        expect.objectContaining({
          type: 'message',
          content: [{ type: 'output_text', text: 'Let me check.', annotations: [] }],
        }),
      );
      expect(output[1]).toEqual(
        expect.objectContaining({
          type: 'function_call',
          id: 'fc_2',
          call_id: 'call_2',
          name: 'search',
          arguments: '{"q":"test"}',
        }),
      );
    });

    it('prefers the authoritative item from response.output_item.done', () => {
      const completed = {
        id: 'resp_3',
        object: 'response',
        output: [],
        usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
      };
      const sse = [
        'event: response.output_item.added\ndata: {"output_index":0,"item":{"type":"function_call","id":"fc_3","call_id":"call_3","name":"get_weather"}}',
        'event: response.function_call_arguments.delta\ndata: {"output_index":0,"delta":"{\\"city\\":"}',
        // Truncate the partial deltas — `done` carries the authoritative state.
        'event: response.output_item.done\ndata: {"output_index":0,"item":{"type":"function_call","id":"fc_3","call_id":"call_3","name":"get_weather","arguments":"{\\"city\\":\\"Paris\\"}","status":"completed"}}',
        `event: response.completed\ndata: ${JSON.stringify({ response: completed })}`,
        '',
      ].join('\n\n');

      const result = collectResponsesSseResponse(sse);
      const output = result.output as Array<Record<string, unknown>>;

      expect(output).toHaveLength(1);
      expect(output[0]).toEqual(
        expect.objectContaining({
          type: 'function_call',
          id: 'fc_3',
          arguments: '{"city":"Paris"}',
          status: 'completed',
        }),
      );
    });

    it('reads final args from response.function_call_arguments.done with nested item shape', () => {
      // Documented Responses-API variant: { output_index, item: { arguments } }.
      const completed = {
        id: 'resp_done_nested',
        object: 'response',
        output: [],
        usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
      };
      const sse = [
        'event: response.output_item.added\ndata: {"output_index":0,"item":{"type":"function_call","id":"fc_n","call_id":"call_n","name":"get_weather"}}',
        'event: response.function_call_arguments.done\ndata: {"output_index":0,"item":{"type":"function_call","id":"fc_n","call_id":"call_n","name":"get_weather","arguments":"{\\"city\\":\\"Paris\\"}"}}',
        `event: response.completed\ndata: ${JSON.stringify({ response: completed })}`,
        '',
      ].join('\n\n');

      const result = collectResponsesSseResponse(sse);
      const output = result.output as Array<Record<string, unknown>>;

      expect(output).toHaveLength(1);
      expect(output[0]).toEqual(
        expect.objectContaining({ id: 'fc_n', arguments: '{"city":"Paris"}' }),
      );
    });

    it('uses response.function_call_arguments.done as the authoritative final arguments', () => {
      // Some streams skip per-character deltas (e.g. no-argument calls) and
      // only ship the final argument string via `.arguments.done`.
      const completed = {
        id: 'resp_done',
        object: 'response',
        output: [],
        usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
      };
      const sse = [
        'event: response.output_item.added\ndata: {"output_index":0,"item":{"type":"function_call","id":"fc_d","call_id":"call_d","name":"get_weather"}}',
        'event: response.function_call_arguments.done\ndata: {"output_index":0,"item_id":"fc_d","arguments":"{\\"city\\":\\"Paris\\"}"}',
        `event: response.completed\ndata: ${JSON.stringify({ response: completed })}`,
        '',
      ].join('\n\n');

      const result = collectResponsesSseResponse(sse);
      const output = result.output as Array<Record<string, unknown>>;

      expect(output).toHaveLength(1);
      expect(output[0]).toEqual(
        expect.objectContaining({
          type: 'function_call',
          id: 'fc_d',
          arguments: '{"city":"Paris"}',
        }),
      );
    });

    it('does not duplicate function_call items already present in completed.output', () => {
      const completed = {
        id: 'resp_4',
        object: 'response',
        output: [
          {
            type: 'function_call',
            id: 'fc_4',
            call_id: 'call_4',
            name: 'get_weather',
            arguments: '{"city":"Paris"}',
            status: 'completed',
          },
        ],
        usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
      };
      const sse = [
        'event: response.output_item.added\ndata: {"output_index":0,"item":{"type":"function_call","id":"fc_4","call_id":"call_4","name":"get_weather"}}',
        'event: response.function_call_arguments.delta\ndata: {"output_index":0,"delta":"{\\"city\\":\\"Paris\\"}"}',
        `event: response.completed\ndata: ${JSON.stringify({ response: completed })}`,
        '',
      ].join('\n\n');

      const result = collectResponsesSseResponse(sse);
      const output = result.output as Array<Record<string, unknown>>;

      expect(output).toHaveLength(1);
      expect(output[0]).toEqual(
        expect.objectContaining({ id: 'fc_4', arguments: '{"city":"Paris"}' }),
      );
    });

    it('dedupes by call_id when streamed item omits the output id', () => {
      // Upstream may emit `output_item.added` without `item.id` while still
      // including the call already in `completed.output`. Without call_id
      // dedupe we would append a duplicate and the SDK caller would execute
      // the same tool twice.
      const completed = {
        id: 'resp_5',
        object: 'response',
        output: [
          {
            type: 'function_call',
            id: 'fc_5',
            call_id: 'call_5',
            name: 'get_weather',
            arguments: '{"city":"Paris"}',
            status: 'completed',
          },
        ],
        usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
      };
      const sse = [
        // No `id` on the streamed item — only call_id is reliably present.
        'event: response.output_item.added\ndata: {"output_index":0,"item":{"type":"function_call","call_id":"call_5","name":"get_weather"}}',
        'event: response.function_call_arguments.delta\ndata: {"output_index":0,"delta":"{\\"city\\":\\"Paris\\"}"}',
        `event: response.completed\ndata: ${JSON.stringify({ response: completed })}`,
        '',
      ].join('\n\n');

      const result = collectResponsesSseResponse(sse);
      const output = result.output as Array<Record<string, unknown>>;

      expect(output).toHaveLength(1);
      expect(output[0]).toEqual(expect.objectContaining({ id: 'fc_5', call_id: 'call_5' }));
    });
  });

  describe('createResponsesStreamTransformer', () => {
    it('opens the message item and content part before the first text delta', () => {
      const t = createResponsesStreamTransformer('gpt-4o');
      const out =
        t.transform('{"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}') ?? '';

      // Lifecycle envelope must precede the delta so strict Responses clients
      // (Pi/OpenClaw) accept the text instead of rendering an empty message.
      expect(eventTypes(out)).toEqual([
        'response.created',
        'response.in_progress',
        'response.output_item.added',
        'response.content_part.added',
        'response.output_text.delta',
      ]);

      const added = firstEventData(out, 'response.output_item.added')!;
      expect(added.item).toMatchObject({
        type: 'message',
        role: 'assistant',
        status: 'in_progress',
      });
      expect(added.item.content).toEqual([]);

      // The delta must reference the same item_id the item was opened with.
      const delta = firstEventData(out, 'response.output_text.delta')!;
      expect(delta.item_id).toBe(added.item.id);
      expect(delta.delta).toBe('Hello');
    });

    it('opens the item exactly once across multiple deltas', () => {
      const t = createResponsesStreamTransformer('gpt-4o');
      t.transform('{"choices":[{"delta":{"content":"Hel"}}]}');
      const second = t.transform('{"choices":[{"delta":{"content":"lo"}}]}') ?? '';

      expect(eventTypes(second)).toEqual(['response.output_text.delta']);
      expect(firstEventData(second, 'response.output_text.delta')!.delta).toBe('lo');
    });

    it('closes the part and item and emits a populated completed event with [DONE]', () => {
      const t = createResponsesStreamTransformer('gpt-4o');
      const opened = t.transform('{"choices":[{"delta":{"content":"Hello"}}]}') ?? '';
      t.transform('{"choices":[{"delta":{"content":"!"}}]}');
      const tail =
        t.transform(
          '{"model":"gpt-4o","choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1576,"completion_tokens":32,"total_tokens":1608}}',
        ) ?? '';
      const end = t.finalize() ?? '';

      expect(eventTypes(end)).toEqual([
        'response.output_text.done',
        'response.content_part.done',
        'response.output_item.done',
        'response.completed',
        '[DONE]',
      ]);

      const itemId = firstEventData(opened, 'response.output_item.added')!.item.id;
      const textDone = firstEventData(end, 'response.output_text.done')!;
      expect(textDone.text).toBe('Hello!');
      expect(textDone.item_id).toBe(itemId);

      const itemDone = firstEventData(end, 'response.output_item.done')!;
      expect(itemDone.item.id).toBe(itemId);
      expect(itemDone.item.status).toBe('completed');
      expect(itemDone.item.content).toEqual([
        { type: 'output_text', text: 'Hello!', annotations: [] },
      ]);

      // The completed event must carry the assembled message in `output`
      // (the bug: it shipped `output: []`), plus usage and a matching id.
      const completed = firstEventData(end, 'response.completed')!;
      expect(completed.response.status).toBe('completed');
      expect(completed.response.output).toEqual([
        expect.objectContaining({
          id: itemId,
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Hello!', annotations: [] }],
        }),
      ]);
      expect(completed.response.usage).toMatchObject({
        input_tokens: 1576,
        output_tokens: 32,
        total_tokens: 1608,
      });
      // `finish_reason` chunk carried no text delta, so the tail before finalize
      // is empty.
      expect(tail).toBe('');
    });

    it('turns an upstream stream error into response.failed and never fabricates completion', () => {
      const t = createResponsesStreamTransformer('claude-sonnet-4');
      t.transform('{"choices":[{"delta":{"content":"partial"}}]}');
      const failed =
        t.transform(
          '{"error":{"message":"Too many requests","type":"rate_limit_error","status":429}}',
        ) ?? '';

      expect(eventTypes(failed)).toEqual(['response.failed', '[DONE]']);
      const event = firstEventData(failed, 'response.failed')!;
      expect(event.response).toMatchObject({
        status: 'failed',
        completed_at: null,
        error: { code: 'rate_limit_error', message: 'Too many requests' },
        output: [],
      });
      expect(failed).not.toContain('response.completed');
      expect(t.finalize()).toBeNull();
      expect(t.transform('{"choices":[{"delta":{"content":"ignored"}}]}')).toBeNull();
    });

    it('keeps an Anthropic fallback stream error terminal through the composed Codex path', () => {
      const fromAnthropic = createAnthropicStreamTransformer('claude-sonnet-4-6');
      const toResponses = createResponsesStreamTransformer('claude-sonnet-4-6');
      const chatError = fromAnthropic(
        'event: error\n{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
      );
      const responsesError = toResponses.transform(chatError ?? '') ?? '';

      expect(eventTypes(responsesError)).toEqual([
        'response.created',
        'response.in_progress',
        'response.failed',
        '[DONE]',
      ]);
      expect(responsesError).not.toContain('response.completed');
      expect(toResponses.finalize()).toBeNull();
    });

    it('streams fragmented parallel function calls with stable output indexes', () => {
      const t = createResponsesStreamTransformer('claude-sonnet-4');
      const text =
        t.transform(JSON.stringify({ choices: [{ delta: { content: 'Checking' } }] })) ?? '';
      const first =
        t.transform(
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_lookup',
                      function: { name: 'lookup', arguments: '{"id":' },
                    },
                    {
                      index: 1,
                      id: 'call_search',
                      function: { name: 'search', arguments: '{"q":"' },
                    },
                  ],
                },
              },
            ],
          }),
        ) ?? '';
      const second =
        t.transform(
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 0, function: { arguments: '1}' } },
                    { index: 1, function: { arguments: 'docs"}' } },
                  ],
                },
              },
            ],
          }),
        ) ?? '';
      const end = t.finalize() ?? '';

      expect(firstEventData(text, 'response.output_item.added')!.output_index).toBe(0);
      const added = allEventData(first, 'response.output_item.added');
      expect(added.map((event) => event.output_index)).toEqual([1, 2]);
      expect(added.map((event) => event.item)).toEqual([
        expect.objectContaining({
          type: 'function_call',
          call_id: 'call_lookup',
          name: 'lookup',
          arguments: '',
        }),
        expect.objectContaining({
          type: 'function_call',
          call_id: 'call_search',
          name: 'search',
          arguments: '',
        }),
      ]);

      expect(
        allEventData(first + second, 'response.function_call_arguments.delta').map((event) => [
          event.output_index,
          event.delta,
        ]),
      ).toEqual([
        [1, '{"id":'],
        [2, '{"q":"'],
        [1, '1}'],
        [2, 'docs"}'],
      ]);
      expect(
        allEventData(end, 'response.function_call_arguments.done').map((event) => [
          event.output_index,
          event.arguments,
        ]),
      ).toEqual([
        [1, '{"id":1}'],
        [2, '{"q":"docs"}'],
      ]);
      expect(
        allEventData(end, 'response.output_item.done').map((event) => event.output_index),
      ).toEqual([0, 1, 2]);

      const completed = firstEventData(end, 'response.completed')!;
      expect(completed.response.output).toEqual([
        expect.objectContaining({
          type: 'message',
          content: [expect.objectContaining({ text: 'Checking' })],
        }),
        expect.objectContaining({
          type: 'function_call',
          call_id: 'call_lookup',
          arguments: '{"id":1}',
        }),
        expect.objectContaining({
          type: 'function_call',
          call_id: 'call_search',
          arguments: '{"q":"docs"}',
        }),
      ]);
    });

    it('buffers custom arguments until the name identifies their Responses type', () => {
      const t = createResponsesStreamTransformer('claude-sonnet-4', {
        toolTypesByName: { shell: 'custom' },
      });
      const beforeName =
        t.transform(
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_shell',
                      function: { arguments: '{"input":"echo ' },
                    },
                  ],
                },
              },
            ],
          }),
        ) ?? '';
      const named =
        t.transform(
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [{ index: 0, function: { name: 'shell', arguments: 'hello"}' } }],
                },
              },
            ],
          }),
        ) ?? '';
      const end = t.finalize() ?? '';

      expect(allEventData(beforeName, 'response.output_item.added')).toEqual([]);
      expect(firstEventData(named, 'response.output_item.added')).toMatchObject({
        output_index: 0,
        item: {
          type: 'custom_tool_call',
          call_id: 'call_shell',
          name: 'shell',
          input: '',
        },
      });
      expect(firstEventData(named, 'response.custom_tool_call_input.delta')).toMatchObject({
        output_index: 0,
        delta: 'echo hello',
      });
      expect(firstEventData(end, 'response.custom_tool_call_input.done')).toMatchObject({
        output_index: 0,
        input: 'echo hello',
      });
      expect(firstEventData(end, 'response.output_item.done')!.item).toMatchObject({
        type: 'custom_tool_call',
        input: 'echo hello',
        status: 'completed',
      });
      expect(firstEventData(end, 'response.completed')!.response.output).toEqual([
        expect.objectContaining({ type: 'custom_tool_call', input: 'echo hello' }),
      ]);
    });

    it.each([
      ['"echo hello"', 'echo hello'],
      ['raw shell input', 'raw shell input'],
      ['{}', '{}'],
    ])('streams and finalizes custom input encoded as %s', (argumentsValue, expectedInput) => {
      const t = createResponsesStreamTransformer('claude-sonnet-4', {
        toolTypesByName: { shell: 'custom' },
      });
      const out =
        t.transform(
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_shell',
                      function: { name: 'shell', arguments: argumentsValue },
                    },
                  ],
                },
              },
            ],
          }),
        ) ?? '';
      const end = t.finalize() ?? '';

      const deltas = allEventData(out, 'response.custom_tool_call_input.delta');
      if (expectedInput !== '{}') {
        expect(deltas).toEqual([expect.objectContaining({ delta: expectedInput })]);
      }
      expect(firstEventData(end, 'response.custom_tool_call_input.done')).toMatchObject({
        input: expectedInput,
      });
    });

    it('buffers an incomplete wrapped custom input but streams already-raw input immediately', () => {
      const wrapped = createResponsesStreamTransformer('claude-sonnet-4', {
        toolTypesByName: { shell: 'custom' },
      });
      const wrappedOut =
        wrapped.transform(
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_wrapped',
                      function: { name: 'shell', arguments: '{"input":"echo' },
                    },
                  ],
                },
              },
            ],
          }),
        ) ?? '';
      expect(allEventData(wrappedOut, 'response.custom_tool_call_input.delta')).toEqual([]);

      const raw = createResponsesStreamTransformer('claude-sonnet-4', {
        toolTypesByName: { shell: 'custom' },
      });
      const rawOut =
        raw.transform(
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_raw',
                      function: { name: 'shell', arguments: 'echo now' },
                    },
                  ],
                },
              },
            ],
          }),
        ) ?? '';
      expect(firstEventData(rawOut, 'response.custom_tool_call_input.delta')).toMatchObject({
        delta: 'echo now',
      });
    });

    it('streams configured structured-output tool arguments as response text', () => {
      const t = createResponsesStreamTransformer('claude-sonnet-4', {
        structuredOutputToolName: 'patient_summary',
        textFormat: { type: 'json_object' },
        toolTypesByName: { patient_summary: 'custom' },
      });
      const first =
        t.transform(
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"toolu_1","function":{"name":"patient_summary","arguments":"{\\"title\\""}}]}}]}\n\n',
        ) ?? '';
      const second =
        t.transform(
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"ok\\"}"}}]}}]}\n\n',
        ) ?? '';
      const end = t.finalize() ?? '';

      expect(firstEventData(first, 'response.output_text.delta')!.delta).toBe('{"title"');
      expect(firstEventData(second, 'response.output_text.delta')!.delta).toBe(':"ok"}');
      expect(eventTypes(first + second)).not.toContain('response.custom_tool_call_input.delta');
      const completed = firstEventData(end, 'response.completed')!;
      expect(completed.response.output).toEqual([
        expect.objectContaining({
          type: 'message',
          content: [{ type: 'output_text', text: '{"title":"ok"}', annotations: [] }],
        }),
      ]);
      expect(completed.response.text).toEqual({ format: { type: 'json_object' } });
    });

    it('opens an empty structured-output message during finalization', () => {
      const t = createResponsesStreamTransformer('claude-sonnet-4', {
        structuredOutputToolName: 'patient_summary',
      });
      const out =
        t.transform(
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'toolu_empty',
                      function: { name: 'patient_summary', arguments: '' },
                    },
                  ],
                },
              },
            ],
          }),
        ) ?? '';
      const end = t.finalize() ?? '';

      expect(eventTypes(out)).not.toContain('response.output_item.added');
      expect(eventTypes(end)).toContain('response.output_item.added');
      expect(firstEventData(end, 'response.completed')!.response.output).toEqual([
        expect.objectContaining({ type: 'message' }),
      ]);
    });

    it('ignores malformed structured-output stream tool-call entries', () => {
      const t = createResponsesStreamTransformer('claude-sonnet-4', {
        structuredOutputToolName: 'patient_summary',
      });
      const out =
        t.transform(
          'data: {"choices":[{"delta":{"tool_calls":[null,{"index":1},{"function":{"name":"patient_summary","arguments":"{}"}}]}}]}\n\n',
        ) ?? '';

      expect(firstEventData(out, 'response.output_text.delta')!.delta).toBe('{}');
      const completed = firstEventData(t.finalize() ?? '', 'response.completed')!;
      expect(completed.response.output).toEqual([
        expect.objectContaining({
          type: 'message',
          content: [{ type: 'output_text', text: '{}', annotations: [] }],
        }),
      ]);
    });

    it('emits no item events and an empty output for usage-only streams', () => {
      const t = createResponsesStreamTransformer('gpt-4o');
      const out =
        t.transform(
          '{"model":"gpt-4o","choices":[],"usage":{"prompt_tokens":5,"completion_tokens":0,"total_tokens":5}}',
        ) ?? '';
      const end = t.finalize() ?? '';

      expect(eventTypes(out)).toEqual(['response.created', 'response.in_progress']);
      expect(eventTypes(end)).toEqual(['response.completed', '[DONE]']);
      expect(firstEventData(end, 'response.completed')!.response.output).toEqual([]);
      expect(firstEventData(end, 'response.completed')!.response.usage).toMatchObject({
        input_tokens: 5,
      });
    });

    it('still emits created, completed, and [DONE] when the stream is empty', () => {
      const t = createResponsesStreamTransformer('gpt-4o');
      const end = t.finalize() ?? '';

      expect(eventTypes(end)).toEqual([
        'response.created',
        'response.in_progress',
        'response.completed',
        '[DONE]',
      ]);
    });

    it('finalize is idempotent and returns null after the stream is closed', () => {
      const t = createResponsesStreamTransformer('gpt-4o');
      expect(t.finalize()).not.toBeNull();
      expect(t.finalize()).toBeNull();
    });

    it('ignores done, empty, malformed, and irrelevant payloads', () => {
      const t = createResponsesStreamTransformer('gpt-4o');
      expect(t.transform('data: [DONE]\n\n')).toBeNull();
      expect(t.transform('')).toBeNull();
      expect(t.transform('data: not-json\n\n')).toBeNull();
    });

    it('keeps created_at stable across created and completed as the clock advances', () => {
      // Advance the wall clock on every Date.now() so a re-derived timestamp
      // would drift between the opening and closing snapshots of the same id.
      let now = 1_700_000_000_000;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
      try {
        const t = createResponsesStreamTransformer('gpt-4o');
        const opened = t.transform('{"choices":[{"delta":{"content":"Hi"}}]}') ?? '';
        const end = t.finalize() ?? '';

        const created = firstEventData(opened, 'response.created')!;
        const completed = firstEventData(end, 'response.completed')!;
        expect(completed.response.id).toBe(created.response.id);
        expect(completed.response.created_at).toBe(created.response.created_at);
        // completed_at must reflect the actual finalize time, not the
        // stream-start timestamp reused for created_at.
        expect(completed.response.completed_at).toBeGreaterThan(completed.response.created_at);
      } finally {
        nowSpy.mockRestore();
      }
    });
  });
});
