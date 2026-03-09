import {
  toAnthropicRequest,
  fromAnthropicResponse,
  transformAnthropicStreamChunk,
  createAnthropicStreamTransformer,
} from '../anthropic-adapter';
import { injectOpenRouterCacheControl } from '../cache-injection';

describe('Anthropic Adapter', () => {
  describe('toAnthropicRequest', () => {
    it('converts basic user message', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hello' }],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');
      const messages = result.messages as Array<{ role: string; content: unknown }>;

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toEqual([{ type: 'text', text: 'Hello' }]);
    });

    it('extracts system messages into top-level system array', () => {
      const body = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hi' },
        ],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');

      const system = result.system as Array<{
        type: string;
        text: string;
        cache_control?: unknown;
      }>;
      expect(system).toHaveLength(1);
      expect(system[0].text).toBe('You are helpful.');
      expect(system[0].cache_control).toEqual({ type: 'ephemeral' });

      const messages = result.messages as Array<{ role: string }>;
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
    });

    it('extracts developer role messages as system blocks', () => {
      const body = {
        messages: [
          { role: 'developer', content: 'Be concise.' },
          { role: 'user', content: 'Hi' },
        ],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');

      const system = result.system as Array<{ type: string; text: string }>;
      expect(system).toHaveLength(1);
      expect(system[0].text).toBe('Be concise.');
    });

    it('injects cache_control on last system block only', () => {
      const body = {
        messages: [
          { role: 'system', content: 'First instruction.' },
          { role: 'system', content: 'Second instruction.' },
          { role: 'user', content: 'Hi' },
        ],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');

      const system = result.system as Array<{ cache_control?: unknown }>;
      expect(system).toHaveLength(2);
      expect(system[0].cache_control).toBeUndefined();
      expect(system[1].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('includes top-level cache_control for automatic caching', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hello' }],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');
      expect(result.cache_control).toEqual({ type: 'ephemeral' });
    });

    it('defaults max_tokens to 4096 when absent', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');
      expect(result.max_tokens).toBe(4096);
    });

    it('uses provided max_tokens', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1000,
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');
      expect(result.max_tokens).toBe(1000);
    });

    it('maps temperature and top_p', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
        temperature: 0.7,
        top_p: 0.9,
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');
      expect(result.temperature).toBe(0.7);
      expect(result.top_p).toBe(0.9);
    });

    it('converts tools with input_schema and injects cache_control on last tool', () => {
      const body = {
        messages: [{ role: 'user', content: 'Search' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'web_search',
              description: 'Search the web',
              parameters: { type: 'object', properties: { query: { type: 'string' } } },
            },
          },
          {
            type: 'function',
            function: {
              name: 'read_file',
              description: 'Read a file',
              parameters: { type: 'object', properties: { path: { type: 'string' } } },
            },
          },
        ],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');

      const tools = result.tools as Array<{
        name: string;
        input_schema: unknown;
        cache_control?: unknown;
      }>;
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('web_search');
      expect(tools[0].input_schema).toEqual({
        type: 'object',
        properties: { query: { type: 'string' } },
      });
      expect(tools[0].cache_control).toBeUndefined();
      expect(tools[1].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('converts tool_calls in assistant messages to tool_use blocks', () => {
      const body = {
        messages: [
          { role: 'user', content: 'Search for cats' },
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'web_search', arguments: '{"query":"cats"}' },
              },
            ],
          },
        ],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');

      const messages = result.messages as Array<{ role: string; content: unknown }>;
      const assistant = messages[1];
      const content = assistant.content as Array<Record<string, unknown>>;
      expect(content).toHaveLength(1);
      expect(content[0]).toEqual({
        type: 'tool_use',
        id: 'call_1',
        name: 'web_search',
        input: { query: 'cats' },
      });
    });

    it('converts tool role messages to user messages with tool_result', () => {
      const body = {
        messages: [{ role: 'tool', tool_call_id: 'call_1', content: '{"results": ["cat1"]}' }],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');

      const messages = result.messages as Array<{ role: string; content: unknown }>;
      expect(messages[0].role).toBe('user');
      const content = messages[0].content as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'call_1',
        content: '{"results": ["cat1"]}',
      });
    });

    it('handles array content blocks in user messages', () => {
      const body = {
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'First' },
              { type: 'text', text: 'Second' },
              { type: 'image', source: { data: 'base64' } },
            ],
          },
        ],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');

      const messages = result.messages as Array<{ content: unknown }>;
      const content = messages[0].content as Array<Record<string, unknown>>;
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: 'text', text: 'First' });
      expect(content[1]).toEqual({ type: 'text', text: 'Second' });
    });

    it('handles system message with array content', () => {
      const body = {
        messages: [
          {
            role: 'system',
            content: [
              { type: 'text', text: 'Instruction 1' },
              { type: 'text', text: 'Instruction 2' },
            ],
          },
          { role: 'user', content: 'Hi' },
        ],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');

      const system = result.system as Array<{
        type: string;
        text: string;
        cache_control?: unknown;
      }>;
      expect(system).toHaveLength(2);
      expect(system[0].text).toBe('Instruction 1');
      expect(system[1].text).toBe('Instruction 2');
      expect(system[1].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('skips assistant messages with no content and no tool_calls', () => {
      const body = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant' },
          { role: 'user', content: 'Bye' },
        ],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');

      const messages = result.messages as Array<unknown>;
      expect(messages).toHaveLength(2);
    });

    it('omits system key when no system messages exist', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');
      expect(result.system).toBeUndefined();
    });

    it('converts tool message with non-string content via JSON.stringify', () => {
      const body = {
        messages: [{ role: 'tool', tool_call_id: 'call_1', content: { result: 'data' } }],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');
      const messages = result.messages as Array<{ role: string; content: unknown }>;
      expect(messages[0].role).toBe('user');
      const content = messages[0].content as Array<Record<string, unknown>>;
      expect(content[0].content).toBe('{"result":"data"}');
    });

    it('converts tool message with null content', () => {
      const body = {
        messages: [{ role: 'tool', tool_call_id: 'call_1', content: null }],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');
      const messages = result.messages as Array<{ role: string; content: unknown }>;
      const content = messages[0].content as Array<Record<string, unknown>>;
      expect(content[0].content).toBe('""');
    });

    it('converts tool message without tool_call_id to unknown', () => {
      const body = {
        messages: [{ role: 'tool', content: 'result text' }],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');
      const messages = result.messages as Array<{ role: string; content: unknown }>;
      const content = messages[0].content as Array<Record<string, unknown>>;
      expect(content[0].tool_use_id).toBe('unknown');
    });

    it('handles tool_call with empty arguments string', () => {
      const body = {
        messages: [
          {
            role: 'assistant',
            content: 'Let me call a tool.',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'noop', arguments: '' },
              },
            ],
          },
        ],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');
      const messages = result.messages as Array<{ role: string; content: unknown }>;
      const content = messages[0].content as Array<Record<string, unknown>>;
      // Last block should be the tool_use with empty parsed args
      const toolBlock = content[content.length - 1];
      expect(toolBlock.type).toBe('tool_use');
      expect(toolBlock.input).toEqual({});
    });

    it('skips user messages with no usable content blocks', () => {
      const body = {
        messages: [
          { role: 'user', content: [{ type: 'image', source: { data: 'base64' } }] },
          { role: 'user', content: 'Hello' },
        ],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');
      // The image-only user message should be filtered out (null from convertMessage)
      const messages = result.messages as Array<unknown>;
      expect(messages).toHaveLength(1);
    });

    it('handles body with no messages property', () => {
      const result = toAnthropicRequest({}, 'claude-sonnet-4-20250514');
      const messages = result.messages as Array<unknown>;
      expect(messages).toHaveLength(0);
      expect(result.system).toBeUndefined();
    });

    it('skips tools with no function property', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
        tools: [{ type: 'retrieval' }],
      };
      const result = toAnthropicRequest(body, 'claude-sonnet-4-20250514');
      expect(result.tools).toBeUndefined();
    });
  });

  describe('fromAnthropicResponse', () => {
    it('converts text response', () => {
      const resp = {
        content: [{ type: 'text', text: 'Hello!' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      };

      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');

      expect(result.object).toBe('chat.completion');
      expect(result.model).toBe('claude-sonnet-4-20250514');

      const choices = result.choices as Array<{
        message: Record<string, unknown>;
        finish_reason: string;
      }>;
      expect(choices).toHaveLength(1);
      expect(choices[0].message.role).toBe('assistant');
      expect(choices[0].message.content).toBe('Hello!');
      expect(choices[0].finish_reason).toBe('stop');

      const usage = result.usage as Record<string, unknown>;
      expect(usage.prompt_tokens).toBe(10);
      expect(usage.completion_tokens).toBe(5);
      expect(usage.total_tokens).toBe(15);
    });

    it('maps end_turn to stop', () => {
      const resp = { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');
      const choices = result.choices as Array<{ finish_reason: string }>;
      expect(choices[0].finish_reason).toBe('stop');
    });

    it('maps max_tokens to length', () => {
      const resp = { content: [{ type: 'text', text: 'truncated' }], stop_reason: 'max_tokens' };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');
      const choices = result.choices as Array<{ finish_reason: string }>;
      expect(choices[0].finish_reason).toBe('length');
    });

    it('maps tool_use to tool_calls', () => {
      const resp = {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'web_search',
            input: { query: 'cats' },
          },
        ],
        stop_reason: 'tool_use',
      };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');

      const choices = result.choices as Array<{
        message: Record<string, unknown>;
        finish_reason: string;
      }>;
      expect(choices[0].finish_reason).toBe('tool_calls');

      const toolCalls = choices[0].message.tool_calls as Array<Record<string, unknown>>;
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].id).toBe('toolu_1');
      const fn = toolCalls[0].function as { name: string; arguments: string };
      expect(fn.name).toBe('web_search');
      expect(JSON.parse(fn.arguments)).toEqual({ query: 'cats' });
    });

    it('extracts cache token metrics', () => {
      const resp = {
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 80,
          cache_creation_input_tokens: 20,
        },
      };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');

      const usage = result.usage as Record<string, unknown>;
      expect(usage.cache_read_tokens).toBe(80);
      expect(usage.cache_creation_tokens).toBe(20);
      const details = usage.prompt_tokens_details as { cached_tokens: number };
      expect(details.cached_tokens).toBe(80);
    });

    it('calculates prompt_tokens as input_tokens + cache_read + cache_creation', () => {
      const resp = {
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 80,
          cache_creation_input_tokens: 20,
        },
      };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');

      const usage = result.usage as Record<string, unknown>;
      // prompt_tokens = input(100) + cache_read(80) + cache_creation(20) = 200
      expect(usage.prompt_tokens).toBe(200);
      expect(usage.completion_tokens).toBe(50);
      expect(usage.total_tokens).toBe(250);
    });

    it('calculates prompt_tokens correctly with zero cache tokens', () => {
      const resp = {
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 50, output_tokens: 25 },
      };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');

      const usage = result.usage as Record<string, unknown>;
      // No cache tokens: prompt_tokens = input(50) + 0 + 0 = 50
      expect(usage.prompt_tokens).toBe(50);
      expect(usage.completion_tokens).toBe(25);
      expect(usage.total_tokens).toBe(75);
      expect(usage.cache_read_tokens).toBe(0);
      expect(usage.cache_creation_tokens).toBe(0);
      const details = usage.prompt_tokens_details as { cached_tokens: number };
      expect(details.cached_tokens).toBe(0);
    });

    it('calculates prompt_tokens with only cache_read (no cache_creation)', () => {
      const resp = {
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 30,
          output_tokens: 10,
          cache_read_input_tokens: 200,
        },
      };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');

      const usage = result.usage as Record<string, unknown>;
      // prompt_tokens = input(30) + cache_read(200) + 0 = 230
      expect(usage.prompt_tokens).toBe(230);
      expect(usage.cache_read_tokens).toBe(200);
      expect(usage.cache_creation_tokens).toBe(0);
    });

    it('calculates prompt_tokens with only cache_creation (no cache_read)', () => {
      const resp = {
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 50,
          output_tokens: 20,
          cache_creation_input_tokens: 150,
        },
      };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');

      const usage = result.usage as Record<string, unknown>;
      // prompt_tokens = input(50) + 0 + cache_creation(150) = 200
      expect(usage.prompt_tokens).toBe(200);
      expect(usage.cache_read_tokens).toBe(0);
      expect(usage.cache_creation_tokens).toBe(150);
    });

    it('handles large cache token counts', () => {
      const resp = {
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 500,
          output_tokens: 100,
          cache_read_input_tokens: 50000,
          cache_creation_input_tokens: 10000,
        },
      };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');

      const usage = result.usage as Record<string, unknown>;
      expect(usage.prompt_tokens).toBe(60500);
      expect(usage.total_tokens).toBe(60600);
    });

    it('handles empty content array', () => {
      const resp = { content: [], stop_reason: 'end_turn' };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');

      const choices = result.choices as Array<{ message: Record<string, unknown> }>;
      expect(choices[0].message.content).toBeNull();
    });

    it('handles mixed text and tool_use content', () => {
      const resp = {
        content: [
          { type: 'text', text: 'Let me search for that.' },
          { type: 'tool_use', id: 'toolu_1', name: 'search', input: {} },
        ],
        stop_reason: 'tool_use',
      };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');

      const choices = result.choices as Array<{ message: Record<string, unknown> }>;
      expect(choices[0].message.content).toBe('Let me search for that.');
      expect(choices[0].message.tool_calls).toBeDefined();
    });

    it('omits usage when not present', () => {
      const resp = { content: [{ type: 'text', text: 'hi' }], stop_reason: 'end_turn' };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');
      expect(result.usage).toBeUndefined();
    });

    it('handles missing stop_reason as stop', () => {
      const resp = { content: [{ type: 'text', text: 'ok' }] };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');
      const choices = result.choices as Array<{ finish_reason: string }>;
      expect(choices[0].finish_reason).toBe('stop');
    });

    it('maps unknown stop_reason to stop', () => {
      const resp = { content: [{ type: 'text', text: 'ok' }], stop_reason: 'unknown_reason' };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');
      const choices = result.choices as Array<{ finish_reason: string }>;
      expect(choices[0].finish_reason).toBe('stop');
    });

    it('handles tool_use block with null input', () => {
      const resp = {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'test_tool',
            input: null,
          },
        ],
        stop_reason: 'tool_use',
      };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');
      const choices = result.choices as Array<{ message: Record<string, unknown> }>;
      const toolCalls = choices[0].message.tool_calls as Array<Record<string, unknown>>;
      const fn = toolCalls[0].function as { arguments: string };
      expect(JSON.parse(fn.arguments)).toEqual({});
    });

    it('handles response with no content array', () => {
      const resp = { stop_reason: 'end_turn', usage: { input_tokens: 5, output_tokens: 3 } };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');
      const choices = result.choices as Array<{ message: Record<string, unknown> }>;
      expect(choices[0].message.content).toBeNull();
    });

    it('maps stop_sequence to stop', () => {
      const resp = { content: [{ type: 'text', text: 'ok' }], stop_reason: 'stop_sequence' };
      const result = fromAnthropicResponse(resp, 'claude-sonnet-4-20250514');
      const choices = result.choices as Array<{ finish_reason: string }>;
      expect(choices[0].finish_reason).toBe('stop');
    });
  });

  describe('transformAnthropicStreamChunk', () => {
    it('converts text_delta to OpenAI chunk', () => {
      const chunk =
        'event: content_block_delta\n{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}';
      const result = transformAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514');

      expect(result).toContain('data: ');
      expect(result).toContain('"chat.completion.chunk"');

      const data = JSON.parse(result!.replace('data: ', '').trim());
      expect(data.choices[0].delta.content).toBe('Hello');
      expect(data.choices[0].finish_reason).toBeNull();
    });

    it('converts message_delta with stop_reason and usage to finish + usage chunks', () => {
      const chunk =
        'event: message_delta\n{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":16}}';
      const result = transformAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514');

      // Result contains two SSE events: finish chunk + usage chunk
      const parts = result!.split('\n\n').filter(Boolean);
      expect(parts.length).toBe(2);

      const finish = JSON.parse(parts[0].replace('data: ', ''));
      expect(finish.choices[0].finish_reason).toBe('stop');
      expect(finish.choices[0].delta).toEqual({});

      const usage = JSON.parse(parts[1].replace('data: ', ''));
      expect(usage.choices).toEqual([]);
      expect(usage.usage.completion_tokens).toBe(16);
      expect(usage.usage.prompt_tokens).toBe(0); // no message_start in stateless call
    });

    it('returns null for ping event', () => {
      const chunk = 'event: ping\n{"type":"ping"}';
      const result = transformAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514');
      expect(result).toBeNull();
    });

    it('converts message_start to initial role chunk', () => {
      const chunk =
        'event: message_start\n{"type":"message_start","message":{"id":"msg_01","role":"assistant"}}';
      const result = transformAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514');

      expect(result).toContain('data: ');
      const data = JSON.parse(result!.replace('data: ', '').trim());
      expect(data.choices[0].delta.role).toBe('assistant');
      expect(data.choices[0].delta.content).toBe('');
      expect(data.choices[0].finish_reason).toBeNull();
    });

    it('returns null for content_block_start event without content_block', () => {
      const chunk = 'event: content_block_start\n{"type":"content_block_start"}';
      const result = transformAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514');
      expect(result).toBeNull();
    });

    it('emits tool_calls chunk for content_block_start with tool_use', () => {
      const chunk =
        'event: content_block_start\n{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_xyz","name":"get_weather","input":{}}}';
      const result = transformAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514');
      expect(result).not.toBeNull();
      const data = JSON.parse(result!.replace('data: ', '').trim());
      expect(data.choices[0].delta.tool_calls).toHaveLength(1);
      expect(data.choices[0].delta.tool_calls[0]).toEqual({
        index: 0,
        id: 'toolu_xyz',
        type: 'function',
        function: { name: 'get_weather', arguments: '' },
      });
      expect(data.choices[0].finish_reason).toBeNull();
    });

    it('returns null for content_block_stop event', () => {
      const chunk = 'event: content_block_stop\n{"type":"content_block_stop"}';
      const result = transformAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514');
      expect(result).toBeNull();
    });

    it('returns null for empty chunks', () => {
      expect(transformAnthropicStreamChunk('', 'claude-sonnet-4-20250514')).toBeNull();
      expect(transformAnthropicStreamChunk('  ', 'claude-sonnet-4-20250514')).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      const chunk = 'event: content_block_delta\nnot json';
      expect(transformAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514')).toBeNull();
    });

    it('returns null for input_json_delta when no prior content_block_start (stateless)', () => {
      const chunk =
        'event: content_block_delta\n{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"q"}}';
      const result = transformAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514');
      expect(result).toBeNull();
    });

    it('returns null for event-only chunk with no data payload', () => {
      const chunk = 'event: content_block_start';
      const result = transformAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514');
      expect(result).toBeNull();
    });

    it('returns null for content_block_delta without delta property', () => {
      const chunk = 'event: content_block_delta\n{"type":"content_block_delta"}';
      const result = transformAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514');
      expect(result).toBeNull();
    });

    it('handles message_delta without usage property', () => {
      const chunk =
        'event: message_delta\n{"type":"message_delta","delta":{"stop_reason":"end_turn"}}';
      const result = transformAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514');
      expect(result).not.toBeNull();

      const parts = result!.split('\n\n').filter(Boolean);
      const usage = JSON.parse(parts[1].replace('data: ', ''));
      // outputTokens defaults to 0 when usage is undefined
      expect(usage.usage.completion_tokens).toBe(0);
      expect(usage.usage.prompt_tokens).toBe(0);
      expect(usage.usage.total_tokens).toBe(0);
    });

    it('handles chunk without event prefix (data type fallback)', () => {
      const chunk = '{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}';
      const result = transformAnthropicStreamChunk(chunk, 'claude-sonnet-4-20250514');

      expect(result).toContain('data: ');
      const data = JSON.parse(result!.replace('data: ', '').trim());
      expect(data.choices[0].delta.content).toBe('Hi');
    });
  });

  describe('createAnthropicStreamTransformer (stateful)', () => {
    it('accumulates input tokens from message_start into message_delta usage', () => {
      const transform = createAnthropicStreamTransformer('claude-sonnet-4-20250514');

      // message_start carries input token counts
      const start =
        'event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":42,"cache_read_input_tokens":10,"cache_creation_input_tokens":5}}}';
      transform(start);

      // content delta
      const delta =
        'event: content_block_delta\n{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}';
      const textResult = transform(delta);
      expect(textResult).toContain('"content":"Hi"');

      // message_delta carries output tokens — should combine with stored input tokens
      const end =
        'event: message_delta\n{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":20}}';
      const result = transform(end);

      const parts = result!.split('\n\n').filter(Boolean);
      const usage = JSON.parse(parts[1].replace('data: ', ''));
      // prompt_tokens = input(42) + cache_read(10) + cache_creation(5) = 57
      expect(usage.usage.prompt_tokens).toBe(57);
      expect(usage.usage.completion_tokens).toBe(20);
      expect(usage.usage.total_tokens).toBe(77);
      expect(usage.usage.cache_read_tokens).toBe(10);
      expect(usage.usage.cache_creation_tokens).toBe(5);
      expect(usage.usage.prompt_tokens_details.cached_tokens).toBe(10);
    });

    it('emits tool_calls arguments chunk for input_json_delta after content_block_start', () => {
      const transform = createAnthropicStreamTransformer('claude-sonnet-4-20250514');
      const startChunk =
        'event: content_block_start\n{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_abc","name":"search","input":{}}}';
      transform(startChunk);
      const deltaChunk =
        'event: content_block_delta\n{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"q\\":"}}';
      const result = transform(deltaChunk);
      expect(result).not.toBeNull();
      const data = JSON.parse(result!.replace('data: ', '').trim());
      expect(data.choices[0].delta.tool_calls).toHaveLength(1);
      expect(data.choices[0].delta.tool_calls[0]).toEqual({
        index: 0,
        function: { arguments: '{"q":' },
      });
    });

    it('emits empty arguments for input_json_delta with empty partial_json', () => {
      const transform = createAnthropicStreamTransformer('claude-sonnet-4-20250514');
      const startChunk =
        'event: content_block_start\n{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_1","name":"run","input":{}}}';
      transform(startChunk);
      const deltaChunk =
        'event: content_block_delta\n{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":""}}';
      const result = transform(deltaChunk);
      expect(result).not.toBeNull();
      const data = JSON.parse(result!.replace('data: ', '').trim());
      expect(data.choices[0].delta.tool_calls[0].function.arguments).toBe('');
    });

    it('full tool stream sequence emits all chunks and finish_reason tool_calls', () => {
      const transform = createAnthropicStreamTransformer('claude-sonnet-4-20250514');
      const messageStart =
        'event: message_start\n{"type":"message_start","message":{"id":"msg_1","content":[]}}';
      const roleChunk = transform(messageStart);
      expect(roleChunk).toContain('"role":"assistant"');

      const textBlockStart =
        'event: content_block_start\n{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}';
      expect(transform(textBlockStart)).toBeNull();

      const textDelta =
        'event: content_block_delta\n{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Checking weather."}}';
      const textResult = transform(textDelta);
      expect(textResult).toContain('"content":"Checking weather."');

      const textStop = 'event: content_block_stop\n{"type":"content_block_stop","index":0}';
      expect(transform(textStop)).toBeNull();

      const toolStart =
        'event: content_block_start\n{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_01","name":"get_weather","input":{}}}';
      const toolChunk = transform(toolStart);
      expect(toolChunk).toContain('"tool_calls"');
      const toolData = JSON.parse(toolChunk!.replace('data: ', '').trim());
      expect(toolData.choices[0].delta.tool_calls[0].function.name).toBe('get_weather');

      const argDelta1 =
        'event: content_block_delta\n{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"location\\":"}}';
      transform(argDelta1);
      const argDelta2 =
        'event: content_block_delta\n{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" \\"SF\\""}}';
      transform(argDelta2);

      const toolStop = 'event: content_block_stop\n{"type":"content_block_stop","index":1}';
      expect(transform(toolStop)).toBeNull();

      const messageDelta =
        'event: message_delta\n{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":50}}';
      const endResult = transform(messageDelta);
      const parts = endResult!.split('\n\n').filter(Boolean);
      const finish = JSON.parse(parts[0].replace('data: ', ''));
      expect(finish.choices[0].finish_reason).toBe('tool_calls');
    });

    it('multiple tool calls get correct openai indices and arguments', () => {
      const transform = createAnthropicStreamTransformer('claude-sonnet-4-20250514');
      const start1 =
        'event: content_block_start\n{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_a","name":"tool_a","input":{}}}';
      const chunk1 = transform(start1);
      expect(
        JSON.parse(chunk1!.replace('data: ', '').trim()).choices[0].delta.tool_calls[0],
      ).toMatchObject({
        index: 0,
        id: 'toolu_a',
        function: { name: 'tool_a', arguments: '' },
      });

      const start2 =
        'event: content_block_start\n{"type":"content_block_start","index":2,"content_block":{"type":"tool_use","id":"toolu_b","name":"tool_b","input":{}}}';
      const chunk2 = transform(start2);
      expect(
        JSON.parse(chunk2!.replace('data: ', '').trim()).choices[0].delta.tool_calls[0],
      ).toMatchObject({
        index: 1,
        id: 'toolu_b',
        function: { name: 'tool_b', arguments: '' },
      });

      const delta1 =
        'event: content_block_delta\n{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"a\\":1}"}}';
      const argChunk1 = transform(delta1);
      expect(
        JSON.parse(argChunk1!.replace('data: ', '').trim()).choices[0].delta.tool_calls[0],
      ).toEqual({
        index: 0,
        function: { arguments: '{"a":1}' },
      });

      const delta2 =
        'event: content_block_delta\n{"type":"content_block_delta","index":2,"delta":{"type":"input_json_delta","partial_json":"{\\"b\\":2}"}}';
      const argChunk2 = transform(delta2);
      expect(
        JSON.parse(argChunk2!.replace('data: ', '').trim()).choices[0].delta.tool_calls[0],
      ).toEqual({
        index: 1,
        function: { arguments: '{"b":2}' },
      });
    });

    it('returns null for input_json_delta with unknown content block index', () => {
      const transform = createAnthropicStreamTransformer('claude-sonnet-4-20250514');
      const chunk =
        'event: content_block_delta\n{"type":"content_block_delta","index":99,"delta":{"type":"input_json_delta","partial_json":"x"}}';
      expect(transform(chunk)).toBeNull();
    });
  });

  describe('injectOpenRouterCacheControl', () => {
    it('injects cache_control on last system message (string content)', () => {
      const body: Record<string, unknown> = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hi' },
        ],
      };

      injectOpenRouterCacheControl(body);

      const messages = body.messages as Array<Record<string, unknown>>;
      const sysMsg = messages[0];
      expect(Array.isArray(sysMsg.content)).toBe(true);
      const blocks = sysMsg.content as Array<Record<string, unknown>>;
      expect(blocks[0]).toEqual({
        type: 'text',
        text: 'You are helpful.',
        cache_control: { type: 'ephemeral' },
      });
    });

    it('injects cache_control on last block of array system content', () => {
      const body: Record<string, unknown> = {
        messages: [
          {
            role: 'system',
            content: [
              { type: 'text', text: 'First' },
              { type: 'text', text: 'Second' },
            ],
          },
          { role: 'user', content: 'Hi' },
        ],
      };

      injectOpenRouterCacheControl(body);

      const messages = body.messages as Array<Record<string, unknown>>;
      const blocks = messages[0].content as Array<Record<string, unknown>>;
      expect(blocks[0].cache_control).toBeUndefined();
      expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('injects cache_control on last tool definition', () => {
      const body: Record<string, unknown> = {
        messages: [{ role: 'user', content: 'Hi' }],
        tools: [
          { type: 'function', function: { name: 'a' } },
          { type: 'function', function: { name: 'b' } },
        ],
      };

      injectOpenRouterCacheControl(body);

      const tools = body.tools as Array<Record<string, unknown>>;
      expect(tools[0].cache_control).toBeUndefined();
      expect(tools[1].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('does nothing when no messages', () => {
      const body: Record<string, unknown> = {};
      injectOpenRouterCacheControl(body);
      expect(body).toEqual({});
    });

    it('only injects on the last system/developer message', () => {
      const body: Record<string, unknown> = {
        messages: [
          { role: 'system', content: 'First system' },
          { role: 'user', content: 'Hi' },
          { role: 'system', content: 'Second system' },
        ],
      };

      injectOpenRouterCacheControl(body);

      const messages = body.messages as Array<Record<string, unknown>>;
      // Should only modify the last system message (index 2)
      expect(typeof messages[0].content).toBe('string');
      expect(Array.isArray(messages[2].content)).toBe(true);
    });
  });
});
