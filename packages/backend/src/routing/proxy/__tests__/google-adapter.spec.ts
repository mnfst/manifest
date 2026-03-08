import { toGoogleRequest, fromGoogleResponse, transformGoogleStreamChunk } from '../google-adapter';

describe('Google Adapter', () => {
  describe('toGoogleRequest', () => {
    it('converts basic messages', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hello world' }],
      };
      const result = toGoogleRequest(body, 'gemini-2.0-flash');

      expect(result.contents).toEqual([{ role: 'user', parts: [{ text: 'Hello world' }] }]);
    });

    it('extracts system instruction', () => {
      const body = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hi' },
        ],
      };
      const result = toGoogleRequest(body, 'gemini-2.0-flash');

      expect(result.systemInstruction).toEqual({
        parts: [{ text: 'You are helpful.' }],
      });
      // System message should not appear in contents
      expect(result.contents).toEqual([{ role: 'user', parts: [{ text: 'Hi' }] }]);
    });

    it('maps assistant role to model', () => {
      const body = {
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello!' },
        ],
      };
      const result = toGoogleRequest(body, 'gemini-2.0-flash');
      const contents = result.contents as Array<{ role: string }>;
      expect(contents[1].role).toBe('model');
    });

    it('maps generation config', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.9,
      };
      const result = toGoogleRequest(body, 'gemini-2.0-flash');

      expect(result.generationConfig).toEqual({
        maxOutputTokens: 1000,
        temperature: 0.7,
        topP: 0.9,
      });
    });

    it('converts tools to functionDeclarations', () => {
      const body = {
        messages: [{ role: 'user', content: 'Search for cats' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'web_search',
              description: 'Search the web',
              parameters: { type: 'object', properties: { query: { type: 'string' } } },
            },
          },
        ],
      };
      const result = toGoogleRequest(body, 'gemini-2.0-flash');

      expect(result.tools).toEqual([
        {
          functionDeclarations: [
            {
              name: 'web_search',
              description: 'Search the web',
              parameters: { type: 'object', properties: { query: { type: 'string' } } },
            },
          ],
        },
      ]);
    });

    it('skips system messages with non-string content from systemInstruction', () => {
      const body = {
        messages: [
          { role: 'system', content: { instructions: 'Be helpful' } },
          { role: 'user', content: 'Hi' },
        ],
      };
      const result = toGoogleRequest(body, 'gemini-2.0-flash');

      // Non-string system content is filtered out (only string content makes it)
      expect(result.systemInstruction).toBeUndefined();
    });

    it('joins multiple system messages into one instruction', () => {
      const body = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'Hi' },
        ],
      };
      const result = toGoogleRequest(body, 'gemini-2.0-flash');

      const instruction = result.systemInstruction as { parts: Array<{ text: string }> };
      expect(instruction.parts[0].text).toContain('You are helpful.');
      expect(instruction.parts[0].text).toContain('Be concise.');
    });

    it('handles array content blocks in messages', () => {
      const body = {
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'First part' },
              { type: 'text', text: 'Second part' },
              { type: 'image', source: { data: 'base64' } }, // non-text blocks are skipped
            ],
          },
        ],
      };
      const result = toGoogleRequest(body, 'gemini-2.0-flash');

      const contents = result.contents as Array<{ parts: Array<{ text?: string }> }>;
      expect(contents[0].parts).toHaveLength(2);
      expect(contents[0].parts[0].text).toBe('First part');
      expect(contents[0].parts[1].text).toBe('Second part');
    });

    it('handles tool response messages', () => {
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
          {
            role: 'tool',
            tool_call_id: 'call_1',
            content: '{"results": ["cat1", "cat2"]}',
          },
        ],
      };
      const result = toGoogleRequest(body, 'gemini-2.0-flash');

      const contents = result.contents as Array<{
        role: string;
        parts: Array<Record<string, unknown>>;
      }>;
      // Tool response should be mapped to functionResponse
      const toolContent = contents[2];
      expect(toolContent.role).toBe('user');
      expect(toolContent.parts[0].functionResponse).toEqual({
        name: 'call_1',
        response: { result: '{"results": ["cat1", "cat2"]}' },
      });
    });

    it('uses unknown as fallback name when tool_call_id is missing', () => {
      const body = {
        messages: [
          { role: 'user', content: 'Do something' },
          {
            role: 'tool',
            content: '{"ok": true}',
          },
        ],
      };
      const result = toGoogleRequest(body, 'gemini-2.0-flash');

      const contents = result.contents as Array<{
        role: string;
        parts: Array<Record<string, unknown>>;
      }>;
      expect(contents[1].parts[0].functionResponse).toEqual({
        name: 'unknown',
        response: { result: '{"ok": true}' },
      });
    });

    it('skips messages that produce no parts', () => {
      const body = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant' }, // no content, no tool_calls
          { role: 'user', content: 'Bye' },
        ],
      };
      const result = toGoogleRequest(body, 'gemini-2.0-flash');

      const contents = result.contents as Array<Record<string, unknown>>;
      // assistant with no parts should be skipped
      expect(contents).toHaveLength(2);
    });

    it('returns empty tools when tool has no function property', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
        tools: [{ type: 'retrieval' }], // no function property
      };
      const result = toGoogleRequest(body, 'gemini-2.0-flash');

      expect(result.tools).toBeUndefined();
    });

    it('omits generationConfig when no generation params', () => {
      const body = { messages: [{ role: 'user', content: 'Hi' }] };
      const result = toGoogleRequest(body, 'gemini-2.0-flash');

      expect(result.generationConfig).toBeUndefined();
    });

    it('handles tool_calls in assistant messages', () => {
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
      const result = toGoogleRequest(body, 'gemini-2.0-flash');
      const contents = result.contents as Array<{ parts: Array<Record<string, unknown>> }>;
      expect(contents[1].parts[0].functionCall).toEqual({
        name: 'web_search',
        args: { query: 'cats' },
      });
    });
  });

  describe('fromGoogleResponse', () => {
    it('converts basic text response', () => {
      const google = {
        candidates: [
          {
            content: { parts: [{ text: 'Hello!' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      };

      const result = fromGoogleResponse(google, 'gemini-2.0-flash');

      expect(result.object).toBe('chat.completion');
      expect(result.model).toBe('gemini-2.0-flash');

      const choices = result.choices as Array<{
        message: Record<string, unknown>;
        finish_reason: string;
      }>;
      expect(choices).toHaveLength(1);
      expect(choices[0].message.role).toBe('assistant');
      expect(choices[0].message.content).toBe('Hello!');
      expect(choices[0].finish_reason).toBe('stop');

      const usage = result.usage as Record<string, number>;
      expect(usage.prompt_tokens).toBe(10);
      expect(usage.completion_tokens).toBe(5);
    });

    it('extracts cachedContentTokenCount from usage', () => {
      const google = {
        candidates: [
          {
            content: { parts: [{ text: 'Hello!' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150,
          cachedContentTokenCount: 80,
        },
      };

      const result = fromGoogleResponse(google, 'gemini-2.0-flash');
      const usage = result.usage as Record<string, unknown>;
      expect(usage.cache_read_tokens).toBe(80);
      expect(usage.prompt_tokens).toBe(100);

      const details = usage.prompt_tokens_details as { cached_tokens: number };
      expect(details.cached_tokens).toBe(80);
    });

    it('defaults cachedContentTokenCount to 0 when absent', () => {
      const google = {
        candidates: [
          {
            content: { parts: [{ text: 'Hello!' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      };

      const result = fromGoogleResponse(google, 'gemini-2.0-flash');
      const usage = result.usage as Record<string, unknown>;
      expect(usage.cache_read_tokens).toBe(0);

      const details = usage.prompt_tokens_details as { cached_tokens: number };
      expect(details.cached_tokens).toBe(0);
    });

    it('includes prompt_tokens_details with large cached token counts', () => {
      const google = {
        candidates: [
          {
            content: { parts: [{ text: 'Hello!' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 50000,
          candidatesTokenCount: 1000,
          totalTokenCount: 51000,
          cachedContentTokenCount: 45000,
        },
      };

      const result = fromGoogleResponse(google, 'gemini-2.0-flash');
      const usage = result.usage as Record<string, unknown>;
      expect(usage.cache_read_tokens).toBe(45000);
      expect(usage.prompt_tokens).toBe(50000);
      expect(usage.total_tokens).toBe(51000);

      const details = usage.prompt_tokens_details as { cached_tokens: number };
      expect(details.cached_tokens).toBe(45000);
    });

    it('handles function call response', () => {
      const google = {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: { name: 'search', args: { query: 'cats' } },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      };

      const result = fromGoogleResponse(google, 'gemini-2.0-flash');
      const choices = result.choices as Array<{ message: Record<string, unknown> }>;
      const toolCalls = choices[0].message.tool_calls as Array<Record<string, unknown>>;
      expect(toolCalls).toHaveLength(1);

      const fn = toolCalls[0].function as { name: string; arguments: string };
      expect(fn.name).toBe('search');
      expect(JSON.parse(fn.arguments)).toEqual({ query: 'cats' });
    });

    it('handles empty candidates', () => {
      const result = fromGoogleResponse({ candidates: [] }, 'gemini-2.0-flash');
      const choices = result.choices as unknown[];
      expect(choices).toHaveLength(0);
    });

    it('maps SAFETY finish reason to content_filter', () => {
      const google = {
        candidates: [
          {
            content: { parts: [{ text: '' }] },
            finishReason: 'SAFETY',
          },
        ],
      };
      const result = fromGoogleResponse(google, 'gemini-2.0-flash');
      const choices = result.choices as Array<{ finish_reason: string }>;
      expect(choices[0].finish_reason).toBe('content_filter');
    });

    it('maps RECITATION finish reason to content_filter', () => {
      const google = {
        candidates: [
          {
            content: { parts: [{ text: '' }] },
            finishReason: 'RECITATION',
          },
        ],
      };
      const result = fromGoogleResponse(google, 'gemini-2.0-flash');
      const choices = result.choices as Array<{ finish_reason: string }>;
      expect(choices[0].finish_reason).toBe('content_filter');
    });

    it('maps unknown finish reason to stop', () => {
      const google = {
        candidates: [
          {
            content: { parts: [{ text: 'ok' }] },
            finishReason: 'UNKNOWN_REASON',
          },
        ],
      };
      const result = fromGoogleResponse(google, 'gemini-2.0-flash');
      const choices = result.choices as Array<{ finish_reason: string }>;
      expect(choices[0].finish_reason).toBe('stop');
    });

    it('handles missing finishReason as stop', () => {
      const google = {
        candidates: [
          {
            content: { parts: [{ text: 'ok' }] },
          },
        ],
      };
      const result = fromGoogleResponse(google, 'gemini-2.0-flash');
      const choices = result.choices as Array<{ finish_reason: string }>;
      expect(choices[0].finish_reason).toBe('stop');
    });

    it('omits usage when usageMetadata is absent', () => {
      const google = {
        candidates: [
          {
            content: { parts: [{ text: 'hi' }] },
            finishReason: 'STOP',
          },
        ],
      };
      const result = fromGoogleResponse(google, 'gemini-2.0-flash');
      expect(result.usage).toBeUndefined();
    });

    it('handles no candidates', () => {
      const result = fromGoogleResponse({}, 'gemini-2.0-flash');
      const choices = result.choices as unknown[];
      expect(choices).toHaveLength(0);
    });

    it('returns null content when parts have no text', () => {
      const google = {
        candidates: [
          {
            content: { parts: [{ functionCall: { name: 'test', args: {} } }] },
            finishReason: 'STOP',
          },
        ],
      };
      const result = fromGoogleResponse(google, 'gemini-2.0-flash');
      const choices = result.choices as Array<{ message: Record<string, unknown> }>;
      expect(choices[0].message.content).toBeNull();
    });

    it('maps MAX_TOKENS finish reason to length', () => {
      const google = {
        candidates: [
          {
            content: { parts: [{ text: 'truncated' }] },
            finishReason: 'MAX_TOKENS',
          },
        ],
      };

      const result = fromGoogleResponse(google, 'gemini-2.0-flash');
      const choices = result.choices as Array<{ finish_reason: string }>;
      expect(choices[0].finish_reason).toBe('length');
    });
  });

  describe('transformGoogleStreamChunk', () => {
    it('converts a text chunk to OpenAI SSE format', () => {
      const chunk = JSON.stringify({
        candidates: [
          {
            content: { parts: [{ text: 'Hi' }] },
          },
        ],
      });

      const result = transformGoogleStreamChunk(chunk, 'gemini-2.0-flash');
      expect(result).toContain('data: ');
      expect(result).toContain('"chat.completion.chunk"');

      const data = JSON.parse(result!.replace('data: ', '').trim());
      expect(data.choices[0].delta.content).toBe('Hi');
    });

    it('returns null for empty chunks', () => {
      expect(transformGoogleStreamChunk('', 'gemini-2.0-flash')).toBeNull();
      expect(transformGoogleStreamChunk('  ', 'gemini-2.0-flash')).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(transformGoogleStreamChunk('not json', 'gemini-2.0-flash')).toBeNull();
    });

    it('returns null for chunks without text', () => {
      const chunk = JSON.stringify({ candidates: [{ content: { parts: [] } }] });
      expect(transformGoogleStreamChunk(chunk, 'gemini-2.0-flash')).toBeNull();
    });

    it('emits usage event when usageMetadata is present', () => {
      const chunk = JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'done' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
      });
      const result = transformGoogleStreamChunk(chunk, 'gemini-2.0-flash');
      expect(result).toContain('"content":"done"');
      expect(result).toContain('"prompt_tokens":100');
      expect(result).toContain('"completion_tokens":50');
      expect(result).toContain('"finish_reason":"stop"');
    });

    it('emits usage-only event when no text but usageMetadata exists', () => {
      const chunk = JSON.stringify({
        candidates: [{ content: { parts: [] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 80, totalTokenCount: 280 },
      });
      const result = transformGoogleStreamChunk(chunk, 'gemini-2.0-flash');
      expect(result).not.toBeNull();
      expect(result).toContain('"prompt_tokens":200');
      expect(result).toContain('"completion_tokens":80');
    });

    it('returns null when no candidates and no usageMetadata', () => {
      const chunk = JSON.stringify({ candidates: [] });
      expect(transformGoogleStreamChunk(chunk, 'gemini-2.0-flash')).toBeNull();
    });
  });
});
