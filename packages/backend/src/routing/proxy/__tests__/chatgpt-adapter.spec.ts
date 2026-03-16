import {
  toResponsesRequest,
  fromResponsesResponse,
  transformResponsesStreamChunk,
} from '../chatgpt-adapter';

describe('ChatGPT Adapter', () => {
  describe('toResponsesRequest', () => {
    it('converts string content to input_text parts', () => {
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
      expect(result.instructions).toBeUndefined();
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

    it('filters system messages from input array', () => {
      const body = {
        messages: [
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'Question' },
          { role: 'assistant', content: 'Answer' },
          { role: 'user', content: 'Follow-up' },
        ],
      };
      const result = toResponsesRequest(body, 'gpt-5');
      const input = result.input as { role: string }[];

      expect(input).toHaveLength(3);
      expect(input.every((m) => m.role !== 'system')).toBe(true);
    });

    it('handles missing messages gracefully', () => {
      const result = toResponsesRequest({}, 'gpt-5');

      expect(result.input).toEqual([]);
      expect(result.instructions).toBeUndefined();
    });

    it('ignores non-string system content', () => {
      const body = {
        messages: [
          { role: 'system', content: [{ type: 'text', text: 'parts' }] },
          { role: 'user', content: 'Hi' },
        ],
      };
      const result = toResponsesRequest(body, 'gpt-5');

      expect(result.instructions).toBeUndefined();
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

    it('skips non-message output items', () => {
      const data = {
        output: [
          { type: 'function_call', name: 'search', arguments: '{}' },
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Result' }],
          },
        ],
      };
      const result = fromResponsesResponse(data, 'gpt-5');
      const choices = result.choices as { message: { content: string } }[];
      expect(choices[0].message.content).toBe('Result');
    });

    it('handles empty output', () => {
      const result = fromResponsesResponse({}, 'gpt-5');
      const choices = result.choices as { message: { content: string } }[];
      expect(choices[0].message.content).toBe('');
    });

    it('handles output item with no content', () => {
      const data = {
        output: [{ type: 'message' }],
      };
      const result = fromResponsesResponse(data, 'gpt-5');
      const choices = result.choices as { message: { content: string } }[];
      expect(choices[0].message.content).toBe('');
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
      // The finish chunk before [DONE] should contain usage
      const finishLine = result!.split('\n').find((l) => l.startsWith('data: {'));
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
      // parseSseEvents strips "data: " prefix, so transform receives "event: ...\n{json}"
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
  });
});
