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

  it('can force streaming for native backends that always return SSE', () => {
    expect(
      toNativeResponsesRequest({ input: 'hi', stream: false }, 'gpt-5.4', {
        forceStream: true,
      }).stream,
    ).toBe(true);
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
