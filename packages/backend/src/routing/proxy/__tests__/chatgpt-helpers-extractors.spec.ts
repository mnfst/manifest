import {
  extractInstructions,
  extractTextContent,
  isObjectRecord,
  safeParse,
  formatSSE,
} from '../chatgpt-helpers';
import { OpenAIMessage } from '../proxy-types';

describe('chatgpt-helpers extractors & utilities', () => {
  describe('extractInstructions', () => {
    it('should return default instructions when no system or developer messages', () => {
      const messages: OpenAIMessage[] = [{ role: 'user', content: 'Hello' }];
      expect(extractInstructions(messages)).toBe('You are a helpful assistant.');
    });

    it('should extract system message content', () => {
      const messages: OpenAIMessage[] = [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Hi' },
      ];
      expect(extractInstructions(messages)).toBe('Be concise.');
    });

    it('should extract developer message content', () => {
      const messages: OpenAIMessage[] = [
        { role: 'developer', content: 'Use markdown.' },
        { role: 'user', content: 'Hi' },
      ];
      expect(extractInstructions(messages)).toBe('Use markdown.');
    });

    it('should combine system and developer messages', () => {
      const messages: OpenAIMessage[] = [
        { role: 'system', content: 'Be helpful.' },
        { role: 'developer', content: 'Prefer concise.' },
        { role: 'user', content: 'Hi' },
      ];
      expect(extractInstructions(messages)).toBe('Be helpful.\n\nPrefer concise.');
    });

    it('should return default instructions for empty messages array', () => {
      expect(extractInstructions([])).toBe('You are a helpful assistant.');
    });

    it('should return default when system content is whitespace only', () => {
      const messages: OpenAIMessage[] = [{ role: 'system', content: '   ' }];
      expect(extractInstructions(messages)).toBe('You are a helpful assistant.');
    });

    it('should return default when system content is null', () => {
      const messages: OpenAIMessage[] = [{ role: 'system', content: null }];
      expect(extractInstructions(messages)).toBe('You are a helpful assistant.');
    });

    it('should return default when system content is empty string', () => {
      const messages: OpenAIMessage[] = [{ role: 'system', content: '' }];
      expect(extractInstructions(messages)).toBe('You are a helpful assistant.');
    });

    it('should extract text from multipart system content', () => {
      const messages: OpenAIMessage[] = [
        {
          role: 'system',
          content: [
            { type: 'text', text: 'Part A' },
            { type: 'text', text: ' Part B' },
          ],
        },
      ];
      expect(extractInstructions(messages)).toBe('Part A Part B');
    });
  });

  describe('extractTextContent', () => {
    it('should return string content directly', () => {
      expect(extractTextContent('Hello')).toBe('Hello');
    });

    it('should return null for empty string', () => {
      expect(extractTextContent('')).toBeNull();
    });

    it('should return null for non-array non-string content', () => {
      expect(extractTextContent(42)).toBeNull();
      expect(extractTextContent(true)).toBeNull();
      expect(extractTextContent(null)).toBeNull();
      expect(extractTextContent(undefined)).toBeNull();
      expect(extractTextContent({ key: 'value' })).toBeNull();
    });

    it('should extract text from text-type array parts', () => {
      expect(
        extractTextContent([
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' },
        ]),
      ).toBe('Hello world');
    });

    it('should extract text from input_text type parts', () => {
      expect(extractTextContent([{ type: 'input_text', text: 'Input text' }])).toBe('Input text');
    });

    it('should extract text from output_text type parts', () => {
      expect(extractTextContent([{ type: 'output_text', text: 'Output text' }])).toBe(
        'Output text',
      );
    });

    it('should skip non-text type parts', () => {
      expect(
        extractTextContent([{ type: 'image_url', image_url: { url: 'http://x.test' } }]),
      ).toBeNull();
    });

    it('should return null for empty array', () => {
      expect(extractTextContent([])).toBeNull();
    });

    it('should skip parts where text is not a string', () => {
      expect(extractTextContent([{ type: 'text', text: 123 }])).toBeNull();
    });

    it('should filter out non-object elements from arrays', () => {
      expect(extractTextContent(['string', 42, null, { type: 'text', text: 'valid' }])).toBe(
        'valid',
      );
    });

    it('should return null when all text parts are empty strings', () => {
      expect(extractTextContent([{ type: 'text', text: '' }])).toBeNull();
    });
  });

  describe('isObjectRecord', () => {
    it('should return true for plain objects', () => {
      expect(isObjectRecord({})).toBe(true);
      expect(isObjectRecord({ key: 'value' })).toBe(true);
    });

    it('should return false for null', () => {
      expect(isObjectRecord(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isObjectRecord(undefined)).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isObjectRecord([])).toBe(false);
      expect(isObjectRecord([1, 2, 3])).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isObjectRecord('string')).toBe(false);
      expect(isObjectRecord(42)).toBe(false);
      expect(isObjectRecord(true)).toBe(false);
      expect(isObjectRecord(0)).toBe(false);
      expect(isObjectRecord('')).toBe(false);
      expect(isObjectRecord(false)).toBe(false);
    });
  });

  describe('safeParse', () => {
    it('should parse valid JSON', () => {
      expect(safeParse('{"key":"value"}')).toEqual({ key: 'value' });
    });

    it('should parse JSON with nested objects', () => {
      expect(safeParse('{"a":{"b":1}}')).toEqual({ a: { b: 1 } });
    });

    it('should return null for invalid JSON', () => {
      expect(safeParse('not-json')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(safeParse('')).toBeNull();
    });

    it('should return null for malformed JSON', () => {
      expect(safeParse('{key: value}')).toBeNull();
    });

    it('should parse JSON arrays', () => {
      expect(safeParse('[1,2,3]')).toEqual([1, 2, 3]);
    });
  });

  describe('formatSSE', () => {
    it('should format a basic SSE chunk', () => {
      const result = formatSSE({ delta: { content: 'Hello' }, finish_reason: null }, 'gpt-5');

      expect(result.startsWith('data: ')).toBe(true);
      expect(result.endsWith('\n\n')).toBe(true);

      const json = JSON.parse(result.replace('data: ', ''));
      expect(json.object).toBe('chat.completion.chunk');
      expect(json.model).toBe('gpt-5');
      expect(json.choices).toHaveLength(1);
      expect(json.choices[0].index).toBe(0);
      expect(json.choices[0].delta.content).toBe('Hello');
      expect(json.id.startsWith('chatcmpl-')).toBe(true);
    });

    it('should include usage when provided', () => {
      const result = formatSSE({ delta: {}, finish_reason: 'stop' }, 'gpt-5', {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      });
      const json = JSON.parse(result.replace('data: ', ''));
      expect(json.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });
    });

    it('should not include usage when not provided', () => {
      const result = formatSSE({ delta: {}, finish_reason: 'stop' }, 'gpt-5');
      const json = JSON.parse(result.replace('data: ', ''));
      expect(json.usage).toBeUndefined();
    });

    it('should generate unique ids for each call', () => {
      const choice = { delta: { content: 'a' }, finish_reason: null };
      const json1 = JSON.parse(formatSSE(choice, 'gpt-5').replace('data: ', ''));
      const json2 = JSON.parse(formatSSE(choice, 'gpt-5').replace('data: ', ''));
      expect(json1.id).not.toBe(json2.id);
    });

    it('should use the provided model name', () => {
      const json = JSON.parse(formatSSE({ delta: {} }, 'claude-3-opus').replace('data: ', ''));
      expect(json.model).toBe('claude-3-opus');
    });
  });
});
