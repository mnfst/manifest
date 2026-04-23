import {
  collectChatGptSseResponse,
  fromResponsesResponse,
  toResponsesRequest,
  transformResponsesStreamChunk,
} from './chatgpt-adapter';

describe('chatgpt-adapter', () => {
  describe('toResponsesRequest', () => {
    it('drops system/developer messages from input but lifts them into instructions', () => {
      const body = {
        messages: [
          { role: 'system', content: 'You are careful.' },
          { role: 'developer', content: 'Use markdown.' },
          { role: 'user', content: 'hi' },
        ],
      };
      const req = toResponsesRequest(body, 'gpt-5.2-codex');
      expect(req.model).toBe('gpt-5.2-codex');
      expect(req.instructions).toBe('You are careful.\n\nUse markdown.');
      expect(req.store).toBe(false);
      expect(req.stream).toBe(true);
      const input = req.input as Array<Record<string, unknown>>;
      expect(input).toHaveLength(1);
      expect(input[0].role).toBe('user');
    });

    it('honours explicit stream: false from the caller', () => {
      const body = {
        stream: false,
        messages: [{ role: 'user', content: 'hi' }],
      };
      const req = toResponsesRequest(body, 'gpt-5');
      expect(req.stream).toBe(false);
    });

    it('converts assistant tool_calls to function_call items and keeps any preceding text', () => {
      const body = {
        messages: [
          { role: 'user', content: 'run foo' },
          {
            role: 'assistant',
            content: 'thinking…',
            tool_calls: [{ id: 'call-1', function: { name: 'foo', arguments: '{"a":1}' } }],
          },
          { role: 'tool', tool_call_id: 'call-1', content: 'ok' },
        ],
      };
      const req = toResponsesRequest(body, 'gpt-5');
      const input = req.input as Array<Record<string, unknown>>;
      // user, assistant text, function_call, function_call_output
      expect(input).toHaveLength(4);
      expect(input[0].role).toBe('user');
      expect(input[1]).toMatchObject({ role: 'assistant' });
      expect(input[2]).toMatchObject({
        type: 'function_call',
        call_id: 'call-1',
        name: 'foo',
        arguments: '{"a":1}',
      });
      expect(input[3]).toMatchObject({
        type: 'function_call_output',
        call_id: 'call-1',
        output: 'ok',
      });
    });

    it('falls back to a UUID call_id when a tool message omits tool_call_id', () => {
      const body = {
        messages: [{ role: 'tool', content: 'result' }],
      };
      const req = toResponsesRequest(body, 'gpt-5');
      const input = req.input as Array<Record<string, unknown>>;
      expect(input[0].type).toBe('function_call_output');
      expect(typeof input[0].call_id).toBe('string');
      expect((input[0].call_id as string).length).toBeGreaterThan(0);
    });

    it('serialises tools through convertTools when provided', () => {
      const body = {
        messages: [{ role: 'user', content: 'hi' }],
        tools: [
          {
            type: 'function',
            function: { name: 'add', parameters: { type: 'object' } },
          },
        ],
      };
      const req = toResponsesRequest(body, 'gpt-5');
      expect(req.tools).toEqual([
        { type: 'function', name: 'add', parameters: { type: 'object' } },
      ]);
    });

    // Integration-style check for the api.openai.com/v1/responses branch:
    // Codex-family models (e.g. gpt-5.3-codex) route through this adapter
    // when hit with an API key. The output must be a valid Responses API
    // request body, not leak any Chat Completions-only fields.
    it('produces a valid Responses API body for a Codex model with tools', () => {
      const chatCompletionsBody = {
        model: 'gpt-4o', // Should be overridden by the argument
        messages: [{ role: 'user', content: 'Write a hello world in Python.' }],
        stream: false,
        max_tokens: 1024,
        temperature: 0.5,
        tools: [
          {
            type: 'function',
            function: {
              name: 'run_code',
              description: 'Execute code in a sandbox',
              parameters: {
                type: 'object',
                properties: { code: { type: 'string' } },
                required: ['code'],
              },
            },
          },
        ],
      };

      const req = toResponsesRequest(chatCompletionsBody, 'gpt-5.3-codex');

      // Required Responses API fields.
      expect(req.model).toBe('gpt-5.3-codex');
      expect(req.store).toBe(false);
      expect(req.stream).toBe(false);
      expect(req).toHaveProperty('instructions');
      expect(typeof req.instructions).toBe('string');

      // input is an array of { role, content } items, NOT a `messages` array.
      expect(Array.isArray(req.input)).toBe(true);
      const input = req.input as Array<Record<string, unknown>>;
      expect(input).toHaveLength(1);
      expect(input[0].role).toBe('user');
      expect(Array.isArray(input[0].content)).toBe(true);
      const content = input[0].content as Array<Record<string, unknown>>;
      expect(content[0]).toMatchObject({
        type: 'input_text',
        text: 'Write a hello world in Python.',
      });

      // Tools are flattened — no nested `function` wrapper.
      expect(req.tools).toEqual([
        {
          type: 'function',
          name: 'run_code',
          description: 'Execute code in a sandbox',
          parameters: {
            type: 'object',
            properties: { code: { type: 'string' } },
            required: ['code'],
          },
        },
      ]);

      // None of the Chat Completions-only fields must leak into the body
      // — OpenAI's /v1/responses endpoint rejects or ignores them.
      expect(req).not.toHaveProperty('messages');
      expect(req).not.toHaveProperty('max_tokens');
    });
  });

  describe('fromResponsesResponse', () => {
    it('assembles a Chat Completion envelope with text output', () => {
      const out = fromResponsesResponse(
        {
          output: [
            {
              type: 'message',
              content: [
                { type: 'output_text', text: 'Hello ' },
                { type: 'output_text', text: 'world' },
              ],
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 2,
            total_tokens: 12,
            input_tokens_details: { cached_tokens: 3 },
          },
        },
        'gpt-5',
      );
      expect(out.object).toBe('chat.completion');
      expect(out.model).toBe('gpt-5');
      const choices = out.choices as Array<Record<string, unknown>>;
      expect(choices[0].finish_reason).toBe('stop');
      expect((choices[0].message as Record<string, unknown>).content).toBe('Hello world');
      expect(out.usage).toMatchObject({
        prompt_tokens: 10,
        completion_tokens: 2,
        total_tokens: 12,
        cache_read_tokens: 3,
        cache_creation_tokens: 0,
      });
    });

    it('assembles a tool_calls envelope and sets finish_reason accordingly', () => {
      const out = fromResponsesResponse(
        {
          output: [{ type: 'function_call', call_id: 'c1', name: 'foo', arguments: '{"x":1}' }],
        },
        'gpt-5',
      );
      const choices = out.choices as Array<Record<string, unknown>>;
      expect(choices[0].finish_reason).toBe('tool_calls');
      const message = choices[0].message as Record<string, unknown>;
      expect(message.content).toBeNull();
      expect(message.tool_calls).toEqual([
        {
          id: 'c1',
          type: 'function',
          function: { name: 'foo', arguments: '{"x":1}' },
        },
      ]);
    });

    it('defaults missing usage fields to zero', () => {
      const out = fromResponsesResponse({ output: [] }, 'gpt-5');
      expect(out.usage).toEqual({
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
      });
    });

    it('tolerates message output items with no content field', () => {
      const out = fromResponsesResponse({ output: [{ type: 'message' }] }, 'gpt-5');
      const choices = out.choices as Array<Record<string, unknown>>;
      expect((choices[0].message as Record<string, unknown>).content).toBeNull();
    });
  });

  describe('transformResponsesStreamChunk', () => {
    function parseFrame(frame: string | null) {
      if (!frame) return null;
      const first = frame.split('\n\n')[0];
      return JSON.parse(first.replace(/^data: /, ''));
    }

    it('returns null for irrelevant events', () => {
      expect(
        transformResponsesStreamChunk('event: response.created\ndata: {}', 'gpt-5'),
      ).toBeNull();
      expect(transformResponsesStreamChunk('', 'gpt-5')).toBeNull();
    });

    it('converts output_text.delta events into a Chat Completion content delta', () => {
      const chunk = 'event: response.output_text.delta\ndata: {"delta":"hi"}';
      const parsed = parseFrame(transformResponsesStreamChunk(chunk, 'gpt-5'));
      expect(parsed.choices[0]).toEqual({
        index: 0,
        delta: { content: 'hi' },
        finish_reason: null,
      });
    });

    it('converts function_call_arguments.delta into a tool_calls.arguments delta', () => {
      const chunk =
        'event: response.function_call_arguments.delta\ndata: {"delta":"foo","output_index":1}';
      const parsed = parseFrame(transformResponsesStreamChunk(chunk, 'gpt-5'));
      expect(parsed.choices[0].delta.tool_calls).toEqual([
        { index: 1, function: { arguments: 'foo' } },
      ]);
    });

    it('converts output_item.added (function_call) into a tool_calls announcement', () => {
      const chunk =
        'event: response.output_item.added\ndata: {"output_index":2,"item":{"type":"function_call","call_id":"c1","name":"foo"}}';
      const parsed = parseFrame(transformResponsesStreamChunk(chunk, 'gpt-5'));
      expect(parsed.choices[0].delta.tool_calls).toEqual([
        {
          index: 2,
          id: 'c1',
          type: 'function',
          function: { name: 'foo', arguments: '' },
        },
      ]);
    });

    it('ignores output_item.added events for non-function items', () => {
      const chunk =
        'event: response.output_item.added\ndata: {"output_index":0,"item":{"type":"message"}}';
      expect(transformResponsesStreamChunk(chunk, 'gpt-5')).toBeNull();
    });

    it('emits a finish frame + [DONE] on response.completed with usage', () => {
      const chunk =
        'event: response.completed\ndata: {"response":{"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3,"input_tokens_details":{"cached_tokens":1}},"output":[]}}';
      const raw = transformResponsesStreamChunk(chunk, 'gpt-5');
      expect(raw).not.toBeNull();
      expect(raw!.trim().endsWith('data: [DONE]')).toBe(true);
      const first = raw!.split('\n\n')[0];
      const parsed = JSON.parse(first.replace(/^data: /, ''));
      expect(parsed.choices[0].finish_reason).toBe('stop');
      expect(parsed.usage).toMatchObject({ prompt_tokens: 1, completion_tokens: 2 });
    });

    it('marks finish_reason=tool_calls when the completed response had function_call items', () => {
      const chunk =
        'event: response.completed\ndata: {"response":{"output":[{"type":"function_call"}]}}';
      const raw = transformResponsesStreamChunk(chunk, 'gpt-5');
      const first = raw!.split('\n\n')[0];
      const parsed = JSON.parse(first.replace(/^data: /, ''));
      expect(parsed.choices[0].finish_reason).toBe('tool_calls');
      // No usage attached.
      expect(parsed.usage).toBeUndefined();
    });
  });

  describe('collectChatGptSseResponse', () => {
    it('collects text deltas and completed usage into a non-streaming envelope', () => {
      const sse = [
        'event: response.output_text.delta\ndata: {"delta":"Hello "}',
        'event: response.output_text.delta\ndata: {"delta":"world"}',
        'event: response.completed\ndata: {"response":{"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}',
      ].join('\n\n');
      const out = collectChatGptSseResponse(sse, 'gpt-5');
      const choices = out.choices as Array<Record<string, unknown>>;
      expect((choices[0].message as Record<string, unknown>).content).toBe('Hello world');
      expect(choices[0].finish_reason).toBe('stop');
      expect(out.usage).toMatchObject({ prompt_tokens: 1, completion_tokens: 2 });
    });

    it('reconstructs tool calls across multiple deltas and reports finish_reason=tool_calls', () => {
      const sse = [
        'event: response.output_item.added\ndata: {"output_index":0,"item":{"type":"function_call","call_id":"c1","name":"foo"}}',
        'event: response.function_call_arguments.delta\ndata: {"output_index":0,"delta":"{\\"x"}',
        'event: response.function_call_arguments.delta\ndata: {"output_index":0,"delta":"\\":1}"}',
        'event: response.completed\ndata: {"response":{"output":[{"type":"function_call"}]}}',
      ].join('\n\n');
      const out = collectChatGptSseResponse(sse, 'gpt-5');
      const choices = out.choices as Array<Record<string, unknown>>;
      const message = choices[0].message as Record<string, unknown>;
      expect(choices[0].finish_reason).toBe('tool_calls');
      expect(message.tool_calls).toEqual([
        {
          id: 'c1',
          type: 'function',
          function: { name: 'foo', arguments: '{"x":1}' },
        },
      ]);
    });

    it('ignores malformed SSE events and falls back to zero usage', () => {
      const sse = 'event: response.output_text.delta\ndata: not-json';
      const out = collectChatGptSseResponse(sse, 'gpt-5');
      expect(out.usage).toEqual({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
      const choices = out.choices as Array<Record<string, unknown>>;
      expect((choices[0].message as Record<string, unknown>).content).toBeNull();
    });

    it('drops function_call_arguments deltas that arrive for an unknown output_index', () => {
      // No output_item.added ever arrives, so the arguments delta should be ignored.
      const sse = [
        'event: response.function_call_arguments.delta\ndata: {"output_index":7,"delta":"lost"}',
        'event: response.completed\ndata: {"response":{"output":[]}}',
      ].join('\n\n');
      const out = collectChatGptSseResponse(sse, 'gpt-5');
      const choices = out.choices as Array<Record<string, unknown>>;
      expect((choices[0].message as Record<string, unknown>).tool_calls).toBeUndefined();
      expect(choices[0].finish_reason).toBe('stop');
    });
  });
});
