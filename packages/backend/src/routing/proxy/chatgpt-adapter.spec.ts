import {
  toResponsesRequest,
  fromResponsesResponse,
  transformResponsesStreamChunk,
} from './chatgpt-adapter';

describe('chatgpt-adapter', () => {
  describe('toResponsesRequest', () => {
    it('converts a basic chat completions request', () => {
      const body = {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
        ],
        stream: true,
      };

      const result = toResponsesRequest(body, 'gpt-4o') as Record<string, unknown>;

      expect(result.model).toBe('gpt-4o');
      expect(result.stream).toBe(true);
      expect(result.store).toBe(false);
      expect(result.instructions).toBe('You are helpful');
      const input = result.input as { role: string; content: unknown }[];
      expect(input).toHaveLength(1);
      expect(input[0].role).toBe('user');
    });

    it('respects stream: false from the caller', () => {
      const body = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      };

      const result = toResponsesRequest(body, 'gpt-4o') as Record<string, unknown>;
      expect(result.stream).toBe(false);
    });

    it('defaults stream to true when not specified', () => {
      const body = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = toResponsesRequest(body, 'gpt-4o') as Record<string, unknown>;
      expect(result.stream).toBe(true);
    });

    it('converts assistant messages with output_text type', () => {
      const body = {
        messages: [{ role: 'assistant', content: 'I can help!' }],
        stream: true,
      };

      const result = toResponsesRequest(body, 'gpt-4o') as Record<string, unknown>;
      const input = result.input as { role: string; content: { type: string; text: string }[] }[];
      expect(input[0].content[0].type).toBe('output_text');
    });

    it('converts array content with text type', () => {
      const body = {
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        stream: true,
      };

      const result = toResponsesRequest(body, 'gpt-4o') as Record<string, unknown>;
      const input = result.input as { role: string; content: { type: string; text: string }[] }[];
      expect(input[0].content[0].type).toBe('input_text');
    });

    it('passes through non-text array content unchanged', () => {
      const body = {
        messages: [{ role: 'user', content: [{ type: 'image_url', url: 'http://...' }] }],
        stream: true,
      };

      const result = toResponsesRequest(body, 'gpt-4o') as Record<string, unknown>;
      const input = result.input as { role: string; content: { type: string }[] }[];
      expect(input[0].content[0].type).toBe('image_url');
    });

    it('passes through non-string, non-array content unchanged', () => {
      const body = {
        messages: [{ role: 'user', content: 42 }],
        stream: true,
      };

      const result = toResponsesRequest(body, 'gpt-4o') as Record<string, unknown>;
      const input = result.input as { role: string; content: unknown }[];
      expect(input[0].content).toBe(42);
    });

    it('handles empty messages', () => {
      const body = { messages: [], stream: true };
      const result = toResponsesRequest(body, 'gpt-4o') as Record<string, unknown>;
      expect(result.input).toEqual([]);
    });

    it('handles missing messages', () => {
      const body = { stream: true };
      const result = toResponsesRequest(body, 'gpt-4o') as Record<string, unknown>;
      expect(result.input).toEqual([]);
    });

    it('does not set instructions when no system message', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      };

      const result = toResponsesRequest(body, 'gpt-4o') as Record<string, unknown>;
      expect(result.instructions).toBeUndefined();
    });

    it('does not set instructions when system content is non-string', () => {
      const body = {
        messages: [
          { role: 'system', content: [{ type: 'text', text: 'Hello' }] },
          { role: 'user', content: 'Hi' },
        ],
        stream: true,
      };

      const result = toResponsesRequest(body, 'gpt-4o') as Record<string, unknown>;
      expect(result.instructions).toBeUndefined();
    });
  });

  describe('fromResponsesResponse', () => {
    it('converts a responses API response to chat completions format', () => {
      const data = {
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Hello!' }],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      };

      const result = fromResponsesResponse(data, 'gpt-4o') as Record<string, unknown>;

      expect(result.object).toBe('chat.completion');
      expect(result.model).toBe('gpt-4o');
      const choices = result.choices as { message: { content: string } }[];
      expect(choices[0].message.content).toBe('Hello!');
      const usage = result.usage as Record<string, number>;
      expect(usage.prompt_tokens).toBe(10);
      expect(usage.completion_tokens).toBe(5);

      // ID should have consistent length: "chatcmpl-" + 29 chars
      const id = result.id as string;
      expect(id).toMatch(/^chatcmpl-[a-f0-9]{29}$/);
    });

    it('handles empty output', () => {
      const data = { output: [] };
      const result = fromResponsesResponse(data, 'gpt-4o') as Record<string, unknown>;
      const choices = result.choices as { message: { content: string } }[];
      expect(choices[0].message.content).toBe('');
    });

    it('handles missing usage', () => {
      const data = { output: [] };
      const result = fromResponsesResponse(data, 'gpt-4o') as Record<string, unknown>;
      const usage = result.usage as Record<string, number>;
      expect(usage.prompt_tokens).toBe(0);
    });

    it('skips non-message output items', () => {
      const data = {
        output: [
          { type: 'function_call', name: 'test' },
          { type: 'message', content: [{ type: 'output_text', text: 'Result' }] },
        ],
      };

      const result = fromResponsesResponse(data, 'gpt-4o') as Record<string, unknown>;
      const choices = result.choices as { message: { content: string } }[];
      expect(choices[0].message.content).toBe('Result');
    });

    it('skips message items with missing content', () => {
      const data = { output: [{ type: 'message' }] };
      const result = fromResponsesResponse(data, 'gpt-4o') as Record<string, unknown>;
      const choices = result.choices as { message: { content: string } }[];
      expect(choices[0].message.content).toBe('');
    });

    it('skips non-output_text content parts', () => {
      const data = {
        output: [
          {
            type: 'message',
            content: [
              { type: 'input_text', text: 'ignored' },
              { type: 'output_text', text: 'kept' },
            ],
          },
        ],
      };

      const result = fromResponsesResponse(data, 'gpt-4o') as Record<string, unknown>;
      const choices = result.choices as { message: { content: string } }[];
      expect(choices[0].message.content).toBe('kept');
    });

    it('handles missing output key', () => {
      const data = {};
      const result = fromResponsesResponse(data, 'gpt-4o') as Record<string, unknown>;
      const choices = result.choices as { message: { content: string } }[];
      expect(choices[0].message.content).toBe('');
    });
  });

  describe('transformResponsesStreamChunk', () => {
    it('transforms text delta event', () => {
      const chunk = 'event: response.output_text.delta\ndata: {"delta":"Hello"}';
      const result = transformResponsesStreamChunk(chunk, 'gpt-4o');
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result!.replace('data: ', '').replace('\n\n', ''));
      expect(parsed.choices[0].delta.content).toBe('Hello');
      // Streaming chunk ID should also be 29 chars after prefix
      expect(parsed.id).toMatch(/^chatcmpl-[a-f0-9]{29}$/);
    });

    it('transforms completed event with usage and DONE', () => {
      const chunk =
        'event: response.completed\ndata: {"response":{"usage":{"input_tokens":5,"output_tokens":3,"total_tokens":8}}}';
      const result = transformResponsesStreamChunk(chunk, 'gpt-4o');
      expect(result).toContain('"finish_reason":"stop"');
      expect(result).toContain('[DONE]');
      expect(result).toContain('"prompt_tokens":5');
    });

    it('returns null for irrelevant events', () => {
      const chunk = 'event: response.output_item.added\ndata: {}';
      expect(transformResponsesStreamChunk(chunk, 'gpt-4o')).toBeNull();
    });

    it('returns null for empty chunks', () => {
      expect(transformResponsesStreamChunk('', 'gpt-4o')).toBeNull();
    });

    it('returns null when text delta data is not valid JSON', () => {
      const chunk = 'event: response.output_text.delta\ndata: not-json';
      expect(transformResponsesStreamChunk(chunk, 'gpt-4o')).toBeNull();
    });

    it('handles text delta with non-string delta field', () => {
      const chunk = 'event: response.output_text.delta\ndata: {"delta":42}';
      const result = transformResponsesStreamChunk(chunk, 'gpt-4o');
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result!.replace('data: ', '').replace('\n\n', ''));
      expect(parsed.choices[0].delta.content).toBe('');
    });

    it('handles completed event without usage', () => {
      const chunk = 'event: response.completed\ndata: {"response":{}}';
      const result = transformResponsesStreamChunk(chunk, 'gpt-4o');
      expect(result).toContain('"finish_reason":"stop"');
      expect(result).toContain('[DONE]');
    });

    it('handles completed event with invalid JSON', () => {
      const chunk = 'event: response.completed\ndata: not-json';
      const result = transformResponsesStreamChunk(chunk, 'gpt-4o');
      expect(result).toContain('[DONE]');
    });

    it('handles pre-processed data without data: prefix', () => {
      const chunk = 'event: response.output_text.delta\n{"delta":"test"}';
      const result = transformResponsesStreamChunk(chunk, 'gpt-4o');
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result!.replace('data: ', '').replace('\n\n', ''));
      expect(parsed.choices[0].delta.content).toBe('test');
    });
  });
});
