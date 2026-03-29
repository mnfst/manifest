import { convertAssistantToolCalls, convertTools, convertContent } from '../chatgpt-helpers';

describe('chatgpt-helpers converters', () => {
  describe('convertAssistantToolCalls', () => {
    it('should convert a valid tool call with all fields', () => {
      const toolCalls = [
        { id: 'call_1', type: 'function', function: { name: 'search', arguments: '{"q":"cats"}' } },
      ];
      const result = convertAssistantToolCalls(toolCalls);

      expect(result).toEqual([
        { type: 'function_call', call_id: 'call_1', name: 'search', arguments: '{"q":"cats"}' },
      ]);
    });

    it('should return empty array for non-object tool call entries', () => {
      expect(convertAssistantToolCalls(['not-an-object', 42, null, undefined, true])).toEqual([]);
    });

    it('should return empty array when tool call has no function property', () => {
      expect(convertAssistantToolCalls([{ id: 'call_1', type: 'function' }])).toEqual([]);
    });

    it('should return empty array when function is not an object', () => {
      expect(convertAssistantToolCalls([{ id: 'call_1', function: 'not-an-object' }])).toEqual([]);
    });

    it('should generate a UUID when id is not a string', () => {
      const result = convertAssistantToolCalls([
        { id: 123, function: { name: 'search', arguments: '{}' } },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].call_id).toEqual(expect.any(String));
      expect(result[0].call_id).not.toBe(123);
    });

    it('should default name to "unknown" when function.name is not a string', () => {
      const result = convertAssistantToolCalls([
        { id: 'call_1', function: { name: 42, arguments: '{}' } },
      ]);

      expect(result).toEqual([
        { type: 'function_call', call_id: 'call_1', name: 'unknown', arguments: '{}' },
      ]);
    });

    it('should default arguments to "{}" when function.arguments is not a string', () => {
      const result = convertAssistantToolCalls([
        { id: 'call_1', function: { name: 'search', arguments: null } },
      ]);

      expect(result).toEqual([
        { type: 'function_call', call_id: 'call_1', name: 'search', arguments: '{}' },
      ]);
    });

    it('should generate UUID for missing id field', () => {
      const result = convertAssistantToolCalls([{ function: { name: 'fn', arguments: '{}' } }]);

      expect(result).toHaveLength(1);
      expect(typeof result[0].call_id).toBe('string');
      expect((result[0].call_id as string).length).toBeGreaterThan(0);
    });

    it('should handle mixed valid and invalid tool calls', () => {
      const result = convertAssistantToolCalls([
        null,
        { id: 'call_1', function: { name: 'search', arguments: '{}' } },
        'string',
        { id: 'call_2', function: 'not-object' },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].call_id).toBe('call_1');
    });

    it('should return empty array for empty input', () => {
      expect(convertAssistantToolCalls([])).toEqual([]);
    });
  });

  describe('convertTools', () => {
    it('should convert a function tool with all optional fields', () => {
      const result = convertTools([
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather',
            parameters: { type: 'object' },
            strict: true,
          },
        },
      ]);

      expect(result).toEqual([
        {
          type: 'function',
          name: 'get_weather',
          description: 'Get weather',
          parameters: { type: 'object' },
          strict: true,
        },
      ]);
    });

    it('should convert a function tool with only name', () => {
      const result = convertTools([{ type: 'function', function: { name: 'my_fn' } }]);
      expect(result).toEqual([{ type: 'function', name: 'my_fn' }]);
    });

    it('should pass through non-function type tools unchanged', () => {
      const result = convertTools([{ type: 'code_interpreter', config: { some: 'value' } }]);
      expect(result).toEqual([{ type: 'code_interpreter', config: { some: 'value' } }]);
    });

    it('should pass through function type with non-object function field', () => {
      const result = convertTools([{ type: 'function', function: 'not-an-object' }] as Record<
        string,
        unknown
      >[]);
      expect(result).toEqual([{ type: 'function', function: 'not-an-object' }]);
    });

    it('should handle strict set to false', () => {
      const result = convertTools([{ type: 'function', function: { name: 'fn', strict: false } }]);
      expect(result).toEqual([{ type: 'function', name: 'fn', strict: false }]);
    });

    it('should handle empty tools array', () => {
      expect(convertTools([])).toEqual([]);
    });

    it('should convert multiple tools mixing function and non-function types', () => {
      const result = convertTools([
        { type: 'function', function: { name: 'fn1', description: 'Desc' } },
        { type: 'web_search' },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'function', name: 'fn1', description: 'Desc' });
      expect(result[1]).toEqual({ type: 'web_search' });
    });
  });

  describe('convertContent', () => {
    it('should wrap null content in empty text part', () => {
      expect(convertContent(null, 'user')).toEqual([{ type: 'input_text', text: '' }]);
    });

    it('should wrap undefined content in empty text part', () => {
      expect(convertContent(undefined, 'user')).toEqual([{ type: 'input_text', text: '' }]);
    });

    it('should use output_text type for assistant role with null content', () => {
      expect(convertContent(null, 'assistant')).toEqual([{ type: 'output_text', text: '' }]);
    });

    it('should wrap string content in a text part', () => {
      expect(convertContent('Hello', 'user')).toEqual([{ type: 'input_text', text: 'Hello' }]);
    });

    it('should use output_text type for assistant string content', () => {
      expect(convertContent('Response', 'assistant')).toEqual([
        { type: 'output_text', text: 'Response' },
      ]);
    });

    it('should return non-array non-string content as-is', () => {
      expect(convertContent(42, 'user')).toBe(42);
      expect(convertContent(true, 'user')).toBe(true);
    });

    it('should return object content as-is when not an array', () => {
      const objContent = { custom: 'data' };
      expect(convertContent(objContent, 'user')).toBe(objContent);
    });

    it('should remap text type parts in array content', () => {
      const result = convertContent(
        [
          { type: 'text', text: 'Hello' },
          { type: 'image_url', image_url: { url: 'http://example.com' } },
        ],
        'user',
      ) as { type: string }[];

      expect(result[0].type).toBe('input_text');
      expect(result[1].type).toBe('image_url');
    });

    it('should remap text type to output_text for assistant array content', () => {
      const result = convertContent([{ type: 'text', text: 'Answer' }], 'assistant') as {
        type: string;
      }[];
      expect(result[0].type).toBe('output_text');
    });

    it('should preserve non-text parts in arrays', () => {
      const result = convertContent([{ type: 'audio', data: 'base64' }], 'user') as {
        type: string;
      }[];
      expect(result[0].type).toBe('audio');
    });
  });
});
