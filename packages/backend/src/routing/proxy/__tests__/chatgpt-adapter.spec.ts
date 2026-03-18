import {
  toResponsesRequest,
  fromResponsesResponse,
  transformResponsesStreamChunk,
} from '../chatgpt-adapter';

describe('ChatGPT Adapter', () => {
  describe('toResponsesRequest', () => {
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
      expect(result.input).toEqual([
        { role: 'user', content: [{ type: 'input_text', text: 'Hi' }] },
      ]);
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
      expect(result.input).toEqual([
        { role: 'user', content: [{ type: 'input_text', text: 'Hi' }] },
      ]);
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
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      };
      const result = toResponsesRequest(body, 'gpt-5');
      const input = result.input as { content: { type: string }[] }[];

      expect(input[0].content[0].type).toBe('input_text');
    });

    it('normalizes null content into an empty text part', () => {
      const body = {
        messages: [{ role: 'user', content: null }],
      };
      const result = toResponsesRequest(body, 'gpt-5');

      expect(result.input).toEqual([
        { role: 'user', content: [{ type: 'input_text', text: '' }] },
      ]);
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
        messages: [
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Response' }],
          },
        ],
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
      expect(input.every((message) => message.role !== 'system' && message.role !== 'developer')).toBe(true);
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
      expect(result.input).toEqual([
        { role: 'user', content: [{ type: 'input_text', text: 'Hi' }] },
      ]);
    });

    it('converts assistant tool_calls to Responses API function_call items', () => {
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
                function: { name: 'search', arguments: '{"q":"cats"}' },
              },
            ],
          },
          { role: 'tool', tool_call_id: 'call_1', content: '{"results":["cat1"]}' },
          { role: 'assistant', content: 'I found some cats!' },
        ],
      };
      const result = toResponsesRequest(body, 'gpt-5');
      const input = result.input as Record<string, unknown>[];

      expect(input).toHaveLength(4);
      expect(input[1]).toEqual({
        type: 'function_call',
        call_id: 'call_1',
        name: 'search',
        arguments: '{"q":"cats"}',
      });
      expect(input[2]).toEqual({
        type: 'function_call_output',
        call_id: 'call_1',
        output: '{"results":["cat1"]}',
      });
      expect(input[3]).toEqual({
        role: 'assistant',
        content: [{ type: 'output_text', text: 'I found some cats!' }],
      });
    });

    it('emits text content before function_call items when assistant has both', () => {
      const body = {
        messages: [
          {
            role: 'assistant',
            content: 'Let me search for that.',
            tool_calls: [
              { id: 'call_1', type: 'function', function: { name: 'search', arguments: '{}' } },
            ],
          },
        ],
      };
      const result = toResponsesRequest(body, 'gpt-5');
      const input = result.input as Record<string, unknown>[];

      expect(input[0]).toEqual({
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Let me search for that.' }],
      });
      expect(input[1]).toEqual(expect.objectContaining({ type: 'function_call', name: 'search' }));
    });

    it('preserves array-form assistant text before function_call items', () => {
      const body = {
        messages: [
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Let me search for that.' }],
            tool_calls: [
              { id: 'call_1', type: 'function', function: { name: 'search', arguments: '{}' } },
            ],
          },
        ],
      };
      const result = toResponsesRequest(body, 'gpt-5');
      const input = result.input as Record<string, unknown>[];

      expect(input[0]).toEqual({
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Let me search for that.' }],
      });
      expect(input[1]).toEqual(expect.objectContaining({ type: 'function_call', name: 'search' }));
    });

    it('converts tool message to function_call_output', () => {
      const body = {
        messages: [{ role: 'tool', tool_call_id: 'call_1', content: 'result data' }],
      };
      const result = toResponsesRequest(body, 'gpt-5');

      expect(result.input).toEqual([
        {
          type: 'function_call_output',
          call_id: 'call_1',
          output: 'result data',
        },
      ]);
    });

    it('extracts text from array-form tool message content', () => {
      const body = {
        messages: [
          {
            role: 'tool',
            tool_call_id: 'call_1',
            content: [{ type: 'text', text: 'result data' }],
          },
        ],
      };
      const result = toResponsesRequest(body, 'gpt-5');

      expect(result.input).toEqual([
        {
          type: 'function_call_output',
          call_id: 'call_1',
          output: 'result data',
        },
      ]);
    });

    it('converts function role messages to function_call_output', () => {
      const body = {
        messages: [{ role: 'function', content: '{"temp":72}' }],
      };
      const result = toResponsesRequest(body, 'gpt-5');

      expect(result.input).toHaveLength(1);
      expect((result.input as Record<string, unknown>[])[0]).toEqual(
        expect.objectContaining({
          type: 'function_call_output',
          output: '{"temp":72}',
        }),
      );
    });

    it('converts Chat Completions tools to Responses API format', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather for a location',
              parameters: { type: 'object', properties: { location: { type: 'string' } } },
            },
          },
        ],
      };
      const result = toResponsesRequest(body, 'gpt-5');

      expect(result.tools).toEqual([
        {
          type: 'function',
          name: 'get_weather',
          description: 'Get weather for a location',
          parameters: { type: 'object', properties: { location: { type: 'string' } } },
        },
      ]);
    });
  });

  describe('fromResponsesResponse', () => {
    it('converts Responses API output to OpenAI chat completion format', () => {
      const data = {
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Hello there!' }],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      };
      const result = fromResponsesResponse(data, 'gpt-5');

      expect(result.object).toBe('chat.completion');
      expect(result.model).toBe('gpt-5');
      expect((result.id as string).startsWith('chatcmpl-')).toBe(true);
      expect(typeof result.created).toBe('number');

      const choices = result.choices as {
        index: number;
        message: { role: string; content: string };
      }[];
      expect(choices).toHaveLength(1);
      expect(choices[0].message.role).toBe('assistant');
      expect(choices[0].message.content).toBe('Hello there!');
      expect(choices[0].index).toBe(0);

      const usage = result.usage as Record<string, number>;
      expect(usage.prompt_tokens).toBe(10);
      expect(usage.completion_tokens).toBe(5);
      expect(usage.total_tokens).toBe(15);
    });

    it('concatenates multiple text parts', () => {
      const data = {
        output: [
          {
            type: 'message',
            content: [
              { type: 'output_text', text: 'Part 1. ' },
              { type: 'output_text', text: 'Part 2.' },
            ],
          },
        ],
      };
      const result = fromResponsesResponse(data, 'gpt-5');
      const choices = result.choices as { message: { content: string } }[];

      expect(choices[0].message.content).toBe('Part 1. Part 2.');
    });

    it('converts function_call output items to tool_calls', () => {
      const data = {
        output: [
          {
            type: 'function_call',
            call_id: 'call_abc',
            name: 'get_weather',
            arguments: '{"location":"Paris"}',
          },
        ],
      };
      const result = fromResponsesResponse(data, 'gpt-5');
      const choices = result.choices as {
        message: {
          content: string | null;
          tool_calls?: {
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }[];
        };
        finish_reason: string;
      }[];

      expect(choices[0].message.content).toBeNull();
      expect(choices[0].message.tool_calls).toEqual([
        {
          id: 'call_abc',
          type: 'function',
          function: { name: 'get_weather', arguments: '{"location":"Paris"}' },
        },
      ]);
      expect(choices[0].finish_reason).toBe('tool_calls');
    });

    it('combines text and function_call output items', () => {
      const data = {
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Let me check.' }],
          },
          {
            type: 'function_call',
            call_id: 'call_1',
            name: 'search',
            arguments: '{}',
          },
        ],
      };
      const result = fromResponsesResponse(data, 'gpt-5');
      const choices = result.choices as {
        message: { content: string | null; tool_calls?: unknown[] };
        finish_reason: string;
      }[];

      expect(choices[0].message.content).toBe('Let me check.');
      expect(choices[0].message.tool_calls).toHaveLength(1);
      expect(choices[0].finish_reason).toBe('tool_calls');
    });

    it('handles empty output', () => {
      const result = fromResponsesResponse({}, 'gpt-5');
      const choices = result.choices as { message: { content: string | null } }[];

      expect(choices[0].message.content).toBeNull();
    });

    it('handles output item with no content', () => {
      const data = {
        output: [{ type: 'message' }],
      };
      const result = fromResponsesResponse(data, 'gpt-5');
      const choices = result.choices as { message: { content: string | null } }[];

      expect(choices[0].message.content).toBeNull();
    });

    it('defaults usage to zeros when missing', () => {
      const data = { output: [] };
      const result = fromResponsesResponse(data, 'gpt-5');
      const usage = result.usage as Record<string, number>;

      expect(usage.prompt_tokens).toBe(0);
      expect(usage.completion_tokens).toBe(0);
      expect(usage.total_tokens).toBe(0);
    });
  });

  describe('transformResponsesStreamChunk', () => {
    it('converts output_text delta to chat completion chunk', () => {
      const chunk = 'event: response.output_text.delta\ndata: {"delta":"Hello"}';
      const result = transformResponsesStreamChunk(chunk, 'gpt-5');

      expect(result).not.toBeNull();
      expect(result).toContain('data: ');
      expect(result).toContain('"chat.completion.chunk"');

      const json = JSON.parse(result!.replace('data: ', '').trim());
      expect(json.choices[0].delta.content).toBe('Hello');
      expect(json.choices[0].finish_reason).toBeNull();
      expect(json.model).toBe('gpt-5');
    });

    it('converts response.completed to finish + DONE', () => {
      const chunk = 'event: response.completed\ndata: {}';
      const result = transformResponsesStreamChunk(chunk, 'gpt-5');

      expect(result).not.toBeNull();
      expect(result).toContain('"finish_reason":"stop"');
      expect(result).toContain('data: [DONE]');
    });

    it('extracts usage from response.completed event', () => {
      const data = JSON.stringify({
        response: {
          usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
        },
      });
      const chunk = `event: response.completed\ndata: ${data}`;
      const result = transformResponsesStreamChunk(chunk, 'gpt-5');

      expect(result).not.toBeNull();
      const finishLine = result!.split('\n').find((line) => line.startsWith('data: {'));
      const json = JSON.parse(finishLine!.replace('data: ', ''));
      expect(json.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
      });
    });

    it('returns null for irrelevant events', () => {
      const chunk = 'event: response.created\ndata: {"id":"resp_123"}';
      const result = transformResponsesStreamChunk(chunk, 'gpt-5');

      expect(result).toBeNull();
    });

    it('returns null for empty input', () => {
      expect(transformResponsesStreamChunk('', 'gpt-5')).toBeNull();
    });

    it('returns null for malformed JSON in delta event', () => {
      const chunk = 'event: response.output_text.delta\ndata: not-json';
      const result = transformResponsesStreamChunk(chunk, 'gpt-5');

      expect(result).toBeNull();
    });

    it('handles delta with non-string delta field', () => {
      const chunk = 'event: response.output_text.delta\ndata: {"delta":42}';
      const result = transformResponsesStreamChunk(chunk, 'gpt-5');

      expect(result).not.toBeNull();
      const json = JSON.parse(result!.replace('data: ', '').trim());
      expect(json.choices[0].delta.content).toBe('');
    });

    it('handles pre-processed chunks (data: prefix stripped by parseSseEvents)', () => {
      const chunk = 'event: response.output_text.delta\n{"delta":"Hi"}';
      const result = transformResponsesStreamChunk(chunk, 'gpt-5');

      expect(result).not.toBeNull();
      const json = JSON.parse(result!.replace('data: ', '').trim());
      expect(json.choices[0].delta.content).toBe('Hi');
    });

    it('returns null for empty lines only', () => {
      const result = transformResponsesStreamChunk('   ', 'gpt-5');
      expect(result).toBeNull();
    });

    it('converts function_call_arguments.delta to tool_calls chunk', () => {
      const chunk =
        'event: response.function_call_arguments.delta\ndata: {"delta":"{\\"loc","output_index":0}';
      const result = transformResponsesStreamChunk(chunk, 'gpt-5');

      expect(result).not.toBeNull();
      const json = JSON.parse(result!.replace('data: ', '').trim());
      expect(json.choices[0].delta.tool_calls[0].function.arguments).toBe('{"loc');
      expect(json.choices[0].delta.tool_calls[0].index).toBe(0);
    });

    it('converts output_item.added for function_call to tool_calls header', () => {
      const data = JSON.stringify({
        output_index: 0,
        item: { type: 'function_call', call_id: 'call_abc', name: 'get_weather' },
      });
      const chunk = `event: response.output_item.added\ndata: ${data}`;
      const result = transformResponsesStreamChunk(chunk, 'gpt-5');

      expect(result).not.toBeNull();
      const json = JSON.parse(result!.replace('data: ', '').trim());
      expect(json.choices[0].delta.tool_calls[0]).toEqual(
        expect.objectContaining({
          id: 'call_abc',
          type: 'function',
          function: { name: 'get_weather', arguments: '' },
        }),
      );
    });

    it('returns null for output_item.added with non-function_call type', () => {
      const data = JSON.stringify({
        output_index: 0,
        item: { type: 'message', role: 'assistant' },
      });
      const chunk = `event: response.output_item.added\ndata: ${data}`;
      const result = transformResponsesStreamChunk(chunk, 'gpt-5');

      expect(result).toBeNull();
    });

    it('sets finish_reason to tool_calls when response has function_call output', () => {
      const data = JSON.stringify({
        response: {
          output: [{ type: 'function_call', call_id: 'call_1', name: 'search' }],
          usage: { input_tokens: 5, output_tokens: 10, total_tokens: 15 },
        },
      });
      const chunk = `event: response.completed\ndata: ${data}`;
      const result = transformResponsesStreamChunk(chunk, 'gpt-5');

      expect(result).not.toBeNull();
      expect(result).toContain('"finish_reason":"tool_calls"');
    });
  });
});
