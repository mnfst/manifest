import {
  chatCompletionsResponseToMessages,
  createMessagesStreamTransformer,
  extractAnthropicServerTools,
  messagesToChatCompletionsRequest,
} from '../anthropic-messages-adapter';
import { toAnthropicRequest } from '../anthropic-adapter';

describe('Anthropic Messages adapter', () => {
  describe('messagesToChatCompletionsRequest', () => {
    it('converts a basic request with string content', () => {
      const result = messagesToChatCompletionsRequest({
        model: 'claude-sonnet-4',
        max_tokens: 256,
        system: 'Be concise.',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        top_p: 0.9,
        stream: true,
        stop_sequences: ['STOP'],
        metadata: { user_id: 'u1' },
      });

      expect(result).toEqual({
        messages: [
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'Hello' },
        ],
        model: 'claude-sonnet-4',
        max_tokens: 256,
        temperature: 0.7,
        top_p: 0.9,
        stream: true,
        stop: ['STOP'],
        metadata: { user_id: 'u1' },
      });
    });

    it('joins array-form system prompts and ignores non-text parts', () => {
      const result = messagesToChatCompletionsRequest({
        system: [
          { type: 'text', text: 'Line one.' },
          { type: 'text', text: 'Line two.' },
          { type: 'unknown' },
        ],
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(result.messages).toEqual([
        { role: 'system', content: 'Line one.\n\nLine two.' },
        { role: 'user', content: 'hi' },
      ]);
    });

    it('omits system message when system is empty or absent', () => {
      const noSystem = messagesToChatCompletionsRequest({
        messages: [{ role: 'user', content: 'x' }],
      });
      expect(noSystem.messages).toEqual([{ role: 'user', content: 'x' }]);

      const emptyArray = messagesToChatCompletionsRequest({
        system: [],
        messages: [{ role: 'user', content: 'x' }],
      });
      expect(emptyArray.messages).toEqual([{ role: 'user', content: 'x' }]);
    });

    it('keeps text-only multimodal user content as a string', () => {
      const result = messagesToChatCompletionsRequest({
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'just text' }],
          },
        ],
      });
      expect(result.messages).toEqual([{ role: 'user', content: 'just text' }]);
    });

    it('translates base64 and url image blocks into chat-completions image_url parts', () => {
      const result = messagesToChatCompletionsRequest({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'look' },
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: 'AAA' },
              },
              { type: 'image', source: { type: 'url', url: 'https://x.test/y.png' } },
              { type: 'image', source: { type: 'base64', data: 'no-mime' } },
            ],
          },
        ],
      });

      expect(result.messages).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'look' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAA' } },
            { type: 'image_url', image_url: { url: 'https://x.test/y.png' } },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,no-mime' } },
          ],
        },
      ]);
    });

    it('translates assistant tool_use blocks into tool_calls', () => {
      const result = messagesToChatCompletionsRequest({
        messages: [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: "I'll look it up." },
              { type: 'tool_use', id: 'tu_1', name: 'search', input: { q: 'cats' } },
            ],
          },
        ],
      });

      expect(result.messages).toEqual([
        {
          role: 'assistant',
          content: "I'll look it up.",
          tool_calls: [
            {
              id: 'tu_1',
              type: 'function',
              function: { name: 'search', arguments: '{"q":"cats"}' },
            },
          ],
        },
      ]);
    });

    it('keeps assistant tool_use-only messages with content set to null', () => {
      const result = messagesToChatCompletionsRequest({
        messages: [
          {
            role: 'assistant',
            content: [{ type: 'tool_use', id: 'tu_2', name: 'lookup', input: {} }],
          },
        ],
      });
      expect(result.messages).toEqual([
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'tu_2', type: 'function', function: { name: 'lookup', arguments: '{}' } },
          ],
        },
      ]);
    });

    it('converts user tool_result blocks into role=tool messages', () => {
      const result = messagesToChatCompletionsRequest({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 'tu_1', content: 'found 3' },
              { type: 'tool_result', tool_use_id: 'tu_2', content: { rows: 5 } },
            ],
          },
        ],
      });

      expect(result.messages).toEqual([
        { role: 'tool', tool_call_id: 'tu_1', content: 'found 3' },
        { role: 'tool', tool_call_id: 'tu_2', content: '{"rows":5}' },
      ]);
    });

    it('falls back to "unknown" for missing tool ids and synthesizes assistant ids', () => {
      const result = messagesToChatCompletionsRequest({
        messages: [
          { role: 'user', content: [{ type: 'tool_result', content: 'r' }] },
          {
            role: 'assistant',
            content: [{ type: 'tool_use', input: {} }],
          },
        ],
      });

      const messages = result.messages as Array<Record<string, unknown>>;
      expect(messages[0]).toEqual({ role: 'tool', tool_call_id: 'unknown', content: 'r' });
      const assistantMsg = messages[1];
      const toolCalls = assistantMsg.tool_calls as Array<Record<string, unknown>>;
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].id).toMatch(/^[0-9a-f-]{36}$/);
      expect((toolCalls[0].function as Record<string, unknown>).name).toBe('unknown');
    });

    it('translates tools and tool_choice variants', () => {
      const auto = messagesToChatCompletionsRequest({
        messages: [{ role: 'user', content: 'x' }],
        tools: [
          { name: 'search', description: 'Search', input_schema: { type: 'object' } },
          { name: 'noschema' },
        ],
        tool_choice: { type: 'auto' },
      });
      expect(auto.tools).toEqual([
        {
          type: 'function',
          function: { name: 'search', description: 'Search', parameters: { type: 'object' } },
        },
        { type: 'function', function: { name: 'noschema' } },
      ]);
      expect(auto.tool_choice).toBe('auto');

      const any = messagesToChatCompletionsRequest({
        messages: [{ role: 'user', content: 'x' }],
        tool_choice: { type: 'any' },
      });
      expect(any.tool_choice).toBe('required');

      const named = messagesToChatCompletionsRequest({
        messages: [{ role: 'user', content: 'x' }],
        tool_choice: { type: 'tool', name: 'search' },
      });
      expect(named.tool_choice).toEqual({ type: 'function', function: { name: 'search' } });

      const ignoredNamed = messagesToChatCompletionsRequest({
        messages: [{ role: 'user', content: 'x' }],
        tool_choice: { type: 'tool' },
      });
      expect(ignoredNamed.tool_choice).toBeUndefined();
    });

    it('stashes Anthropic server tools and still exposes them to the scorer (issue #1886)', () => {
      const result = messagesToChatCompletionsRequest({
        messages: [{ role: 'user', content: 'x' }],
        tools: [
          { type: 'web_search_20250305', name: 'web_search' },
          { type: 'bash_20250124', name: 'bash' },
          { type: 'mcp_toolset', name: 'mcp' },
          { name: 'my_custom', description: 'c', input_schema: { type: 'object' } },
          { type: 'custom', name: 'explicit_custom', input_schema: { type: 'object' } },
        ],
      });

      // chatBody.tools keeps all five — the scorer reads tool count and
      // function.name and must keep seeing server tools for tier / specificity.
      const tools = result.tools as Array<Record<string, unknown>>;
      expect(tools).toHaveLength(5);
      expect(tools.map((t) => (t.function as Record<string, unknown>).name)).toEqual([
        'web_search',
        'bash',
        'mcp',
        'my_custom',
        'explicit_custom',
      ]);

      // Originals are stashed so toAnthropicRequest can re-emit them with the
      // `type` tag intact.
      expect(result._anthropicServerTools).toEqual([
        { type: 'web_search_20250305', name: 'web_search' },
        { type: 'bash_20250124', name: 'bash' },
        { type: 'mcp_toolset', name: 'mcp' },
      ]);
    });

    it('treats unknown non-custom tool types as custom tools with a safe empty schema (issue #1897)', () => {
      const result = messagesToChatCompletionsRequest({
        messages: [{ role: 'user', content: 'x' }],
        tools: [{ type: 'advisor_20260301', name: 'advisor', description: 'Plan the task' }],
      });

      expect(result._anthropicServerTools).toBeUndefined();
      expect(result.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'advisor',
            description: 'Plan the task',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
          },
        },
      ]);
    });

    it('round-trips unknown typed tools back to Anthropic as custom tools (issue #1897)', () => {
      const chatBody = messagesToChatCompletionsRequest({
        messages: [{ role: 'user', content: 'x' }],
        tools: [
          { type: 'web_search_20250305', name: 'web_search' },
          { type: 'advisor_20260301', name: 'advisor' },
        ],
      });

      const anthropicBody = toAnthropicRequest(chatBody, 'claude-sonnet-4-20250514');
      const tools = anthropicBody.tools as Array<Record<string, unknown>>;

      expect(tools[0]).toMatchObject({ type: 'web_search_20250305', name: 'web_search' });
      expect(tools[1]).toEqual({
        name: 'advisor',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
        cache_control: { type: 'ephemeral' },
      });
    });

    it('adds missing array items in Anthropic tool schemas before OpenAI forwarding', () => {
      const inputSchema = {
        type: 'object',
        properties: {
          codebase_context: {
            anyOf: [{ type: 'string' }, { type: 'object' }, { type: 'array' }],
          },
          existing_items: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      };
      const result = messagesToChatCompletionsRequest({
        messages: [{ role: 'user', content: 'x' }],
        tools: [
          {
            name: 'mcp__revenuecat__create-paywall-ai',
            description: 'Create a paywall',
            input_schema: inputSchema,
          },
        ],
      });

      const tools = result.tools as Array<Record<string, Record<string, unknown>>>;
      expect(tools[0].function.parameters).toEqual({
        type: 'object',
        properties: {
          codebase_context: {
            anyOf: [{ type: 'string' }, { type: 'object' }, { type: 'array', items: {} }],
          },
          existing_items: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      });
      expect(inputSchema.properties.codebase_context.anyOf[2]).toEqual({ type: 'array' });
    });

    it('omits the stash when no server tools are present', () => {
      const result = messagesToChatCompletionsRequest({
        messages: [{ role: 'user', content: 'x' }],
        tools: [{ name: 'plain', input_schema: { type: 'object' } }],
      });
      expect(result._anthropicServerTools).toBeUndefined();
    });

    it('forwards Anthropic-native thinking and top_k onto chatBody', () => {
      const result = messagesToChatCompletionsRequest({
        messages: [{ role: 'user', content: 'x' }],
        thinking: { type: 'enabled', budget_tokens: 1024 },
        top_k: 40,
      });
      expect(result.thinking).toEqual({ type: 'enabled', budget_tokens: 1024 });
      expect(result.top_k).toBe(40);
    });

    it('drops malformed image blocks (unsupported source type) without crashing', () => {
      const result = messagesToChatCompletionsRequest({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'look' },
              { type: 'image', source: { type: 'unknown' } },
            ],
          },
        ],
      });
      expect(result.messages).toEqual([{ role: 'user', content: 'look' }]);
    });

    it('handles assistant turn with plain string content', () => {
      const result = messagesToChatCompletionsRequest({
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello back' },
        ],
      });
      expect(result.messages).toEqual([
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello back' },
      ]);
    });

    it('preserves the original block order when text and tool_result interleave in a user turn', () => {
      // Cubic flagged: emitting all tool_result blocks before user text in
      // the same turn changes input order and could alter prompt semantics.
      // Now we walk content in order and split user messages around
      // tool_result boundaries.
      const result = messagesToChatCompletionsRequest({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'before' },
              { type: 'tool_result', tool_use_id: 'tu_a', content: 'A' },
              { type: 'text', text: 'middle' },
              { type: 'tool_result', tool_use_id: 'tu_b', content: 'B' },
              { type: 'text', text: 'after' },
            ],
          },
        ],
      });
      expect(result.messages).toEqual([
        { role: 'user', content: 'before' },
        { role: 'tool', tool_call_id: 'tu_a', content: 'A' },
        { role: 'user', content: 'middle' },
        { role: 'tool', tool_call_id: 'tu_b', content: 'B' },
        { role: 'user', content: 'after' },
      ]);
    });

    it('echoes Anthropic thinking blocks back as reasoning_content on assistant turns', () => {
      // DeepSeek requires the reasoning trace echoed on follow-up assistant
      // turns. The Anthropic SDK exposes it as a `thinking` block on the
      // assistant message — this verifies the round-trip.
      const result = messagesToChatCompletionsRequest({
        messages: [
          { role: 'user', content: 'use the tool' },
          {
            role: 'assistant',
            content: [
              { type: 'thinking', thinking: 'I should call get_weather.' },
              { type: 'text', text: 'Looking up.' },
              { type: 'tool_use', id: 'tu_1', name: 'get_weather', input: { city: 'Tokyo' } },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: '18C' }],
          },
        ],
      });
      const messages = result.messages as Array<Record<string, unknown>>;
      const assistant = messages.find((m) => m.role === 'assistant')!;
      expect(assistant.reasoning_content).toBe('I should call get_weather.');
      expect(assistant.content).toBe('Looking up.');
      expect(assistant.tool_calls).toBeDefined();
    });

    it('skips malformed message entries', () => {
      const result = messagesToChatCompletionsRequest({
        messages: ['nope', null, { role: 'user', content: 'ok' }],
      } as Record<string, unknown>);
      expect(result.messages).toEqual([{ role: 'user', content: 'ok' }]);
    });
  });

  describe('extractAnthropicServerTools', () => {
    it('returns tools whose type matches a known Anthropic server-tool prefix', () => {
      expect(
        extractAnthropicServerTools([
          { type: 'web_search_20250305', name: 'web_search' },
          { type: 'custom', name: 'c1' },
          { type: 'advisor_20260301', name: 'advisor' },
          { type: 'mcp_toolset', name: 'mcp' },
          { type: 'mcp_toolset_future', name: 'future_mcp' },
          { name: 'c2' },
          { type: 'text_editor_20250728', name: 'str_replace_editor' },
          'not-a-record',
        ]),
      ).toEqual([
        { type: 'web_search_20250305', name: 'web_search' },
        { type: 'mcp_toolset', name: 'mcp' },
        { type: 'text_editor_20250728', name: 'str_replace_editor' },
      ]);
    });

    it('returns an empty array when no server tools are present', () => {
      expect(extractAnthropicServerTools([{ type: 'custom', name: 'c' }])).toEqual([]);
      expect(extractAnthropicServerTools([])).toEqual([]);
    });
  });

  describe('chatCompletionsResponseToMessages', () => {
    it('converts a text-only chat completion into an Anthropic message', () => {
      const result = chatCompletionsResponseToMessages(
        {
          id: 'cc_1',
          model: 'gpt-4o-mini',
          choices: [{ message: { content: 'hello there' }, finish_reason: 'stop' }],
          usage: {
            prompt_tokens: 4,
            completion_tokens: 2,
            cache_read_tokens: 1,
            cache_creation_tokens: 2,
          },
        },
        'gpt-4o-mini',
      );

      expect(result).toEqual({
        id: 'cc_1',
        type: 'message',
        role: 'assistant',
        model: 'gpt-4o-mini',
        content: [{ type: 'text', text: 'hello there' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          // Anthropic's input_tokens excludes cache (= 4 - 1 - 2).
          input_tokens: 1,
          output_tokens: 2,
          cache_creation_input_tokens: 2,
          cache_read_input_tokens: 1,
        },
      });
    });

    it('extracts text from array-shaped content and emits tool_use blocks', () => {
      const result = chatCompletionsResponseToMessages(
        {
          choices: [
            {
              message: {
                content: [
                  { type: 'text', text: 'part1 ' },
                  { type: 'text', text: 'part2' },
                  { not: 'a record' },
                ],
                tool_calls: [
                  {
                    id: 'tc_1',
                    function: { name: 'search', arguments: '{"q":"a"}' },
                  },
                  {
                    function: { name: 'lookup', arguments: 'not-json' },
                  },
                  { not: 'a function' },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
        'fallback',
      );

      expect(result.content).toEqual([
        { type: 'text', text: 'part1 part2' },
        { type: 'tool_use', id: 'tc_1', name: 'search', input: { q: 'a' } },
        expect.objectContaining({ type: 'tool_use', name: 'lookup', input: {} }),
      ]);
      expect(result.stop_reason).toBe('tool_use');
    });

    it('maps stop reasons and falls back to end_turn for unknown values', () => {
      const length = chatCompletionsResponseToMessages(
        { choices: [{ message: { content: 'x' }, finish_reason: 'length' }] },
        'm',
      );
      expect(length.stop_reason).toBe('max_tokens');

      const unknown = chatCompletionsResponseToMessages(
        { choices: [{ message: { content: 'x' }, finish_reason: 'mystery' }] },
        'm',
      );
      expect(unknown.stop_reason).toBe('end_turn');

      const noChoices = chatCompletionsResponseToMessages({ choices: 'bad' as unknown }, 'm');
      expect(noChoices.content).toEqual([]);
      expect(noChoices.stop_reason).toBe('end_turn');
      expect(noChoices.id).toMatch(/^msg_[0-9a-f]{32}$/);
      expect(noChoices.model).toBe('m');
    });

    it('surfaces reasoning_content as a leading thinking block', () => {
      const result = chatCompletionsResponseToMessages(
        {
          choices: [
            {
              message: {
                content: 'The answer is 42.',
                reasoning_content: 'Let me think... yes, 42.',
              },
              finish_reason: 'stop',
            },
          ],
        },
        'deepseek',
      );
      expect(result.content).toEqual([
        { type: 'thinking', thinking: 'Let me think... yes, 42.' },
        { type: 'text', text: 'The answer is 42.' },
      ]);
    });

    it('handles missing content and missing usage gracefully', () => {
      const result = chatCompletionsResponseToMessages(
        { choices: [{ message: {}, finish_reason: 'stop' }] },
        'm',
      );
      expect(result.content).toEqual([]);
      expect(result.usage).toEqual({
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      });
    });
  });

  describe('createMessagesStreamTransformer', () => {
    function flushChunks(
      transformer: { transform: (c: string) => string | null; finalize: () => string | null },
      chunks: string[],
    ): string {
      const out = chunks.map((c) => transformer.transform(c) ?? '').join('');
      const tail = transformer.finalize() ?? '';
      return out + tail;
    }

    it('emits message_start, content_block events, message_delta, and message_stop for plain text', () => {
      const t = createMessagesStreamTransformer('claude-sonnet-4');
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":2}}\n\n',
      ];
      const sse = flushChunks(t, chunks);

      const events = sse
        .split('\n\n')
        .filter(Boolean)
        .map((block) => {
          const eventLine = block.split('\n')[0]!;
          const dataLine = block.split('\n')[1]!;
          return {
            event: eventLine.replace('event: ', ''),
            data: JSON.parse(dataLine.replace('data: ', '')),
          };
        });

      expect(events.map((e) => e.event)).toEqual([
        'message_start',
        'content_block_start',
        'content_block_delta',
        'content_block_delta',
        'content_block_stop',
        'message_delta',
        'message_stop',
      ]);

      expect(events[0].data.message.id).toMatch(/^msg_/);
      expect(events[0].data.message.model).toBe('claude-sonnet-4');
      expect(events[1].data.content_block).toEqual({ type: 'text', text: '' });
      expect(events[2].data.delta).toEqual({ type: 'text_delta', text: 'Hel' });
      expect(events[3].data.delta).toEqual({ type: 'text_delta', text: 'lo' });
      expect(events[5].data.delta).toEqual({ stop_reason: 'end_turn', stop_sequence: null });
      expect(events[5].data.usage).toEqual({
        input_tokens: 3,
        output_tokens: 2,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      });
    });

    it('emits tool_use content_block_start and input_json_delta for tool calls', () => {
      const t = createMessagesStreamTransformer('claude-sonnet-4');
      const sse = flushChunks(t, [
        'data: {"model":"claude","choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc_a","function":{"name":"search","arguments":"{\\"q"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\"x\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
      ]);

      expect(sse).toContain(
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tc_a","name":"search","input":{}}}',
      );
      expect(sse).toContain(
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"q"}}',
      );
      expect(sse).toContain('"stop_reason":"tool_use"');
    });

    it('finalize is idempotent — second call returns null', () => {
      const t = createMessagesStreamTransformer('m');
      t.transform('data: {"choices":[{"delta":{"content":"x"},"finish_reason":"stop"}]}\n\n');
      const first = t.finalize();
      expect(first).toContain('event: message_stop');
      expect(t.finalize()).toBeNull();
    });

    it('starts the message even when only an empty payload is seen (initial chunk)', () => {
      const t = createMessagesStreamTransformer('m');
      const chunk = 'data: {"choices":[{"delta":{}}]}\n\n';
      const out = t.transform(chunk);
      expect(out).toContain('event: message_start');
    });

    it('ignores unparseable payloads without breaking the stream', () => {
      const t = createMessagesStreamTransformer('m');
      expect(t.transform('data: not-json\n\n')).toBeNull();
      expect(t.transform('data: "scalar"\n\n')).toBeNull();
      expect(t.transform('data: [DONE]\n\n')).toBeNull();

      const real = t.transform('data: {"choices":[{"delta":{"content":"a"}}]}\n\n');
      expect(real).toContain('event: message_start');
      expect(real).toContain('"text":"a"');
    });

    it('captures usage from a finish_reason chunk that also carries usage', () => {
      const t = createMessagesStreamTransformer('m');
      const sse = [
        t.transform('data: {"choices":[{"delta":{"content":"x"}}]}\n\n') ?? '',
        t.transform(
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1}}\n\n',
        ) ?? '',
        t.finalize() ?? '',
      ].join('');
      expect(sse).toContain('"input_tokens":1');
      expect(sse).toContain('"output_tokens":1');
    });

    it('falls back to safe stringification when assistant tool input contains circular refs', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const result = messagesToChatCompletionsRequest({
        messages: [
          {
            role: 'assistant',
            content: [{ type: 'tool_use', id: 'tu_c', name: 'cycle', input: circular }],
          },
        ],
      });
      const messages = result.messages as Array<Record<string, unknown>>;
      const toolCalls = messages[0].tool_calls as Array<Record<string, unknown>>;
      expect((toolCalls[0].function as Record<string, unknown>).arguments).toBe('');
    });

    it('handles raw payloads without a `data:` prefix', () => {
      const t = createMessagesStreamTransformer('m');
      const out = t.transform('{"choices":[{"delta":{"content":"raw"}}]}');
      expect(out).toContain('event: message_start');
      expect(out).toContain('"text":"raw"');
    });
  });
});
