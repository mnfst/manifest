import {
  convertAssistantToolCalls,
  convertContent,
  convertTools,
  extractInstructions,
  extractTextContent,
  formatSSE,
  isObjectRecord,
  safeParse,
} from './chatgpt-helpers';
import { OpenAIMessage } from './proxy-types';

describe('chatgpt-helpers', () => {
  describe('isObjectRecord', () => {
    it('accepts plain object records', () => {
      expect(isObjectRecord({})).toBe(true);
      expect(isObjectRecord({ a: 1 })).toBe(true);
    });

    it('rejects arrays, null, and primitives', () => {
      expect(isObjectRecord(null)).toBe(false);
      expect(isObjectRecord(undefined)).toBe(false);
      expect(isObjectRecord([])).toBe(false);
      expect(isObjectRecord('x')).toBe(false);
      expect(isObjectRecord(42)).toBe(false);
    });
  });

  describe('safeParse', () => {
    it('parses valid JSON', () => {
      expect(safeParse('{"a":1}')).toEqual({ a: 1 });
    });

    it('returns null for malformed JSON', () => {
      expect(safeParse('not-json')).toBeNull();
      expect(safeParse('')).toBeNull();
    });
  });

  describe('convertAssistantToolCalls', () => {
    it('skips entries that are not proper tool call shapes', () => {
      expect(convertAssistantToolCalls([null, 'string', 42, { function: 'not-object' }])).toEqual(
        [],
      );
    });

    it('produces a function_call entry per tool call with explicit id fallback', () => {
      const out = convertAssistantToolCalls([
        { id: 'call-1', function: { name: 'foo', arguments: '{"x":1}' } },
        { function: { name: 'bar' } }, // id missing → random UUID assigned
      ]);
      expect(out).toHaveLength(2);
      expect(out[0]).toEqual({
        type: 'function_call',
        call_id: 'call-1',
        name: 'foo',
        arguments: '{"x":1}',
      });
      expect(out[1].type).toBe('function_call');
      expect(out[1].name).toBe('bar');
      expect(out[1].arguments).toBe('{}');
      expect(typeof out[1].call_id).toBe('string');
      expect((out[1].call_id as string).length).toBeGreaterThan(0);
    });
  });

  describe('convertTools', () => {
    it('rewrites OpenAI function tools into the Responses API format', () => {
      const tools = [
        {
          type: 'function',
          function: {
            name: 'add',
            description: 'add numbers',
            parameters: { type: 'object' },
            strict: true,
          },
        },
      ];
      expect(convertTools(tools)).toEqual([
        {
          type: 'function',
          name: 'add',
          description: 'add numbers',
          parameters: { type: 'object' },
          strict: true,
        },
      ]);
    });

    it('omits optional fields when absent', () => {
      const out = convertTools([{ type: 'function', function: { name: 'noop' } }]);
      expect(out[0]).toEqual({ type: 'function', name: 'noop' });
    });

    it('passes through non-function tools unchanged', () => {
      const tool = { type: 'web_search' };
      expect(convertTools([tool])).toEqual([tool]);
    });
  });

  describe('convertContent', () => {
    it('maps null/undefined content to an empty text part', () => {
      expect(convertContent(null, 'user')).toEqual([{ type: 'input_text', text: '' }]);
      expect(convertContent(undefined, 'assistant')).toEqual([{ type: 'output_text', text: '' }]);
    });

    it('wraps a bare string in the role-appropriate text part', () => {
      expect(convertContent('hi', 'user')).toEqual([{ type: 'input_text', text: 'hi' }]);
      expect(convertContent('hi', 'assistant')).toEqual([{ type: 'output_text', text: 'hi' }]);
    });

    it('renames "text" parts to input_text/output_text but leaves other parts alone', () => {
      const parts = [
        { type: 'text', text: 'hello' },
        { type: 'image_url', image_url: { url: 'x' } },
      ];
      expect(convertContent(parts, 'user')).toEqual([
        { type: 'input_text', text: 'hello' },
        { type: 'image_url', image_url: { url: 'x' } },
      ]);
    });

    it('passes through non-array content unchanged (unusual input)', () => {
      expect(convertContent({ weird: true }, 'user')).toEqual({ weird: true });
    });
  });

  describe('extractInstructions', () => {
    it('joins system and developer text messages with a blank line between them', () => {
      const messages: OpenAIMessage[] = [
        { role: 'system', content: 'A' },
        { role: 'user', content: 'ignored' },
        { role: 'developer', content: 'B' },
      ];
      expect(extractInstructions(messages)).toBe('A\n\nB');
    });

    it('falls back to a default when no instructions are present', () => {
      const messages: OpenAIMessage[] = [{ role: 'user', content: 'hi' }];
      expect(extractInstructions(messages)).toBe('You are a helpful assistant.');
    });
  });

  describe('extractTextContent', () => {
    it('returns strings directly (or null for empty)', () => {
      expect(extractTextContent('hi')).toBe('hi');
      expect(extractTextContent('')).toBeNull();
    });

    it('joins text-ish parts from a multimodal array', () => {
      expect(
        extractTextContent([
          { type: 'text', text: 'a' },
          { type: 'input_text', text: 'b' },
          { type: 'output_text', text: 'c' },
          { type: 'image_url', url: 'x' },
        ]),
      ).toBe('abc');
    });

    it('returns null for non-array, non-string content and for empty results', () => {
      expect(extractTextContent(null)).toBeNull();
      expect(extractTextContent([])).toBeNull();
      expect(extractTextContent([{ type: 'image_url' }])).toBeNull();
    });
  });

  describe('formatSSE', () => {
    it('emits a chat.completion.chunk SSE frame with the given choice and model', () => {
      const frame = formatSSE({ delta: { content: 'hi' }, finish_reason: null }, 'gpt-5.2-codex');
      expect(frame.startsWith('data: ')).toBe(true);
      expect(frame.endsWith('\n\n')).toBe(true);
      const parsed = JSON.parse(frame.slice(6).trim());
      expect(parsed.object).toBe('chat.completion.chunk');
      expect(parsed.model).toBe('gpt-5.2-codex');
      expect(parsed.choices[0]).toEqual({
        index: 0,
        delta: { content: 'hi' },
        finish_reason: null,
      });
    });

    it('appends usage when provided', () => {
      const frame = formatSSE({ delta: {}, finish_reason: 'stop' }, 'gpt-5', { prompt_tokens: 1 });
      const parsed = JSON.parse(frame.slice(6).trim());
      expect(parsed.usage).toEqual({ prompt_tokens: 1 });
    });
  });
});
