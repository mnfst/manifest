import {
  chatCompletionStreamChunkToResponses,
  collectResponsesSseResponse,
  fromChatCompletionResponse,
  toChatCompletionsRequest,
  toNativeResponsesRequest,
} from '../responses-adapter';

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
      expect(result.tools).toEqual([{ type: 'web_search_preview' }]);
      expect(result.tool_choice).toBe('auto');
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

    it('handles missing choices, non-string content, and missing usage', () => {
      const result = fromChatCompletionResponse({ choices: [{ message: { content: 7 } }] }, 'm');
      expect(result.model).toBe('m');
      expect(result.output).toEqual([]);
      expect(result.usage).toBeNull();
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

  describe('chatCompletionStreamChunkToResponses', () => {
    it('converts chat completion content deltas to Responses SSE events', () => {
      const result = chatCompletionStreamChunkToResponses(
        'data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}\n\n',
      );

      expect(result).toContain('event: response.output_text.delta');
      expect(result).toContain('"delta":"Hi"');
    });

    it('converts finish chunks to response.completed events', () => {
      const result = chatCompletionStreamChunkToResponses(
        JSON.stringify({
          model: 'gpt-4o',
          choices: [{ delta: {}, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        }),
      );

      expect(result).toContain('event: response.completed');
      expect(result).toContain('"input_tokens":1');
    });

    it('converts usage-only stream chunks to response.completed events', () => {
      const result = chatCompletionStreamChunkToResponses(
        JSON.stringify({
          model: 'gpt-4o',
          choices: [],
          usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
        }),
      );

      expect(result).toContain('event: response.completed');
      expect(result).toContain('"input_tokens":5');
      expect(result).toContain('"output_tokens":7');
    });

    it('ignores done, empty, malformed, and irrelevant chunks', () => {
      expect(chatCompletionStreamChunkToResponses('data: [DONE]\n\n')).toBeNull();
      expect(chatCompletionStreamChunkToResponses('')).toBeNull();
      expect(chatCompletionStreamChunkToResponses('data: not-json\n\n')).toBeNull();
      expect(chatCompletionStreamChunkToResponses('{"choices":[]}')).toBeNull();
    });
  });
});
