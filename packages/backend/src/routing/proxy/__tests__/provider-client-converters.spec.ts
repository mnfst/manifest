import { sanitizeOpenAiBody } from '../provider-client-converters';

describe('provider-client-converters', () => {
  describe('sanitizeOpenAiBody', () => {
    /* ── Top-level field stripping ── */

    it('should pass through all fields for openai provider', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o',
        store: true,
        metadata: { key: 'value' },
        stream_options: { include_usage: true },
      };

      const result = sanitizeOpenAiBody(body, 'openai', 'gpt-4o');

      expect(result).toHaveProperty('store');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('stream_options');
    });

    it('should strip OpenAI-only fields for non-passthrough providers', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'mistral-large',
        store: true,
        metadata: {},
        service_tier: 'auto',
        stream_options: {},
        modalities: ['text'],
        audio: {},
        prediction: {},
        reasoning_effort: 'medium',
        temperature: 0.5,
      };

      const result = sanitizeOpenAiBody(body, 'mistral', 'mistral-large');

      expect(result).not.toHaveProperty('store');
      expect(result).not.toHaveProperty('metadata');
      expect(result).not.toHaveProperty('service_tier');
      expect(result).not.toHaveProperty('stream_options');
      expect(result).not.toHaveProperty('modalities');
      expect(result).not.toHaveProperty('audio');
      expect(result).not.toHaveProperty('prediction');
      expect(result).not.toHaveProperty('reasoning_effort');
      expect(result).toHaveProperty('temperature', 0.5);
    });

    it('should convert max_completion_tokens to max_tokens for non-passthrough providers', () => {
      const body = {
        messages: [],
        max_completion_tokens: 1000,
      };

      const result = sanitizeOpenAiBody(body, 'anthropic', 'claude-3');

      expect(result).toHaveProperty('max_tokens', 1000);
      expect(result).not.toHaveProperty('max_completion_tokens');
    });

    it('should not overwrite existing max_tokens with max_completion_tokens', () => {
      const body = {
        messages: [],
        max_tokens: 500,
        max_completion_tokens: 1000,
      };

      const result = sanitizeOpenAiBody(body, 'anthropic', 'claude-3');

      expect(result.max_tokens).toBe(500);
    });

    it('should pass through openrouter as passthrough provider', () => {
      const body = {
        messages: [],
        store: true,
        metadata: { test: 1 },
      };

      const result = sanitizeOpenAiBody(body, 'openrouter', 'openai/gpt-4o');

      expect(result).toHaveProperty('store');
      expect(result).toHaveProperty('metadata');
    });

    /* ── DeepSeek max_tokens normalization ── */

    it('should cap max_tokens at 8192 for deepseek provider', () => {
      const body = { messages: [], max_tokens: 16000 };

      const result = sanitizeOpenAiBody(body, 'deepseek', 'deepseek-chat');

      expect(result.max_tokens).toBe(8192);
    });

    it('should truncate fractional max_tokens for deepseek', () => {
      const body = { messages: [], max_tokens: 5000.7 };

      const result = sanitizeOpenAiBody(body, 'deepseek', 'deepseek-chat');

      expect(result.max_tokens).toBe(5000);
    });

    it('should delete max_tokens when 0 for deepseek', () => {
      const body = { messages: [], max_tokens: 0 };

      const result = sanitizeOpenAiBody(body, 'deepseek', 'deepseek-chat');

      expect(result).not.toHaveProperty('max_tokens');
    });

    it('should delete max_tokens when negative for deepseek', () => {
      const body = { messages: [], max_tokens: -100 };

      const result = sanitizeOpenAiBody(body, 'deepseek', 'deepseek-chat');

      expect(result).not.toHaveProperty('max_tokens');
    });

    it('should handle string max_tokens for deepseek', () => {
      const body = { messages: [], max_tokens: '4096' as unknown };

      const result = sanitizeOpenAiBody(body as any, 'deepseek', 'deepseek-chat');

      expect(result.max_tokens).toBe(4096);
    });

    it('should delete non-finite max_tokens for deepseek', () => {
      const body = { messages: [], max_tokens: 'not-a-number' as unknown };

      const result = sanitizeOpenAiBody(body as any, 'deepseek', 'deepseek-chat');

      expect(result).not.toHaveProperty('max_tokens');
    });

    it('should delete max_tokens that truncates to 0 for deepseek', () => {
      const body = { messages: [], max_tokens: 0.5 };

      const result = sanitizeOpenAiBody(body, 'deepseek', 'deepseek-chat');

      expect(result).not.toHaveProperty('max_tokens');
    });

    /* ── Message sanitization: reasoning_content ── */

    it('should strip reasoning_content for non-deepseek providers', () => {
      const body = {
        messages: [{ role: 'assistant', content: 'Hi', reasoning_content: 'I thought...' }],
      };

      const result = sanitizeOpenAiBody(body, 'anthropic', 'claude-3');
      const messages = result.messages as any[];

      expect(messages[0]).not.toHaveProperty('reasoning_content');
    });

    it('should preserve reasoning_content for deepseek provider', () => {
      const body = {
        messages: [{ role: 'assistant', content: 'Hi', reasoning_content: 'thought' }],
      };

      const result = sanitizeOpenAiBody(body, 'deepseek', 'deepseek-chat');
      const messages = result.messages as any[];

      expect(messages[0]).toHaveProperty('reasoning_content', 'thought');
    });

    it('should preserve reasoning_content for openrouter deepseek models', () => {
      const body = {
        messages: [{ role: 'assistant', content: 'Hi', reasoning_content: 'thought' }],
      };

      const result = sanitizeOpenAiBody(body, 'openrouter', 'deepseek/deepseek-r1');
      const messages = result.messages as any[];

      expect(messages[0]).toHaveProperty('reasoning_content', 'thought');
    });

    it('should strip reasoning_content for non-deepseek openrouter models', () => {
      const body = {
        messages: [{ role: 'assistant', content: 'Hi', reasoning_content: 'thought' }],
      };

      const result = sanitizeOpenAiBody(body, 'openrouter', 'openai/gpt-4o');
      const messages = result.messages as any[];

      expect(messages[0]).not.toHaveProperty('reasoning_content');
    });

    /* ── Message sanitization: reasoning_details ── */

    it('should strip reasoning_details for non-openrouter providers', () => {
      const body = {
        messages: [
          {
            role: 'assistant',
            content: '4',
            reasoning_details: [{ type: 'thinking', thinking: '2+2', signature: 'sig' }],
          },
        ],
      };

      const result = sanitizeOpenAiBody(body, 'mistral', 'ministral-3b-2512');
      const messages = result.messages as any[];

      expect(messages[0]).not.toHaveProperty('reasoning_details');
    });

    it('should strip reasoning_details for native openai targets', () => {
      const body = {
        messages: [
          {
            role: 'assistant',
            content: '4',
            reasoning_details: [{ type: 'thinking', thinking: 't', signature: 's' }],
          },
        ],
      };

      const result = sanitizeOpenAiBody(body, 'openai', 'gpt-4o');
      const messages = result.messages as any[];

      expect(messages[0]).not.toHaveProperty('reasoning_details');
    });

    it('should preserve reasoning_details for openrouter targets', () => {
      const details = [{ type: 'thinking', thinking: 't', signature: 's' }];
      const body = {
        messages: [{ role: 'assistant', content: '4', reasoning_details: details }],
      };

      const result = sanitizeOpenAiBody(body, 'openrouter', 'minimax/minimax-m2.7');
      const messages = result.messages as any[];

      expect(messages[0]).toHaveProperty('reasoning_details', details);
    });

    it('should handle non-array messages gracefully', () => {
      const body = { messages: 'not-an-array' };

      const result = sanitizeOpenAiBody(body as any, 'anthropic', 'claude-3');

      expect(result.messages).toBe('not-an-array');
    });

    it('should pass through non-object messages in array', () => {
      const body = { messages: [null, undefined, 42, 'string', [1, 2]] };

      const result = sanitizeOpenAiBody(body as any, 'anthropic', 'claude-3');
      const messages = result.messages as any[];

      expect(messages).toEqual([null, undefined, 42, 'string', [1, 2]]);
    });

    /* ── Mistral tool_call_id normalization ── */

    it('should rewrite non-conforming tool_call IDs for Mistral', () => {
      const body = {
        messages: [
          {
            role: 'assistant',
            tool_calls: [{ id: 'call_abcdefghijklmnop', type: 'function', function: {} }],
          },
          { role: 'tool', tool_call_id: 'call_abcdefghijklmnop', content: 'result' },
        ],
      };

      const result = sanitizeOpenAiBody(body, 'mistral', 'mistral-large');
      const messages = result.messages as any[];

      // The original ID doesn't match ^[A-Za-z0-9]{9}$, so it gets rewritten
      const newTcId = messages[0].tool_calls[0].id;
      expect(newTcId).toMatch(/^tc[a-z0-9]{7}$/);
      // The tool response's tool_call_id should match
      expect(messages[1].tool_call_id).toBe(newTcId);
    });

    it('should preserve conforming 9-char alphanumeric IDs for Mistral', () => {
      const validId = 'Abc123XYZ'; // 9 chars alphanumeric
      const body = {
        messages: [
          { role: 'assistant', tool_calls: [{ id: validId }] },
          { role: 'tool', tool_call_id: validId, content: 'ok' },
        ],
      };

      const result = sanitizeOpenAiBody(body, 'mistral', 'mistral-large');
      const messages = result.messages as any[];

      expect(messages[0].tool_calls[0].id).toBe(validId);
      expect(messages[1].tool_call_id).toBe(validId);
    });

    it('should not rewrite tool_call IDs for non-Mistral providers', () => {
      const body = {
        messages: [{ role: 'assistant', tool_calls: [{ id: 'call_long_id_here_123' }] }],
      };

      const result = sanitizeOpenAiBody(body, 'anthropic', 'claude-3');
      const messages = result.messages as any[];

      expect(messages[0].tool_calls[0].id).toBe('call_long_id_here_123');
    });

    it('should handle invalid tool_call entries in reservation phase for Mistral', () => {
      const body = {
        messages: [
          {
            role: 'assistant',
            tool_calls: [null, 42, [1, 2], { id: 'Abc123XYZ' }],
          },
        ],
      };

      const result = sanitizeOpenAiBody(body, 'mistral', 'mistral-large');
      const messages = result.messages as any[];

      // Non-object toolCalls should be skipped in reservation, valid one preserved
      expect(messages[0].tool_calls[3].id).toBe('Abc123XYZ');
    });

    it('should handle invalid tool_call entries in mapping phase for Mistral', () => {
      const body = {
        messages: [
          {
            role: 'assistant',
            tool_calls: [null, 'string', { id: 'longNonConformingId' }],
          },
        ],
      };

      const result = sanitizeOpenAiBody(body, 'mistral', 'mistral-large');
      const messages = result.messages as any[];

      // Non-object entries should pass through
      expect(messages[0].tool_calls[0]).toBeNull();
      expect(messages[0].tool_calls[1]).toBe('string');
      // Object entry should have rewritten id
      expect(messages[0].tool_calls[2].id).toMatch(/^tc/);
    });

    it('should handle non-string tool_call_id in reservation for Mistral', () => {
      const body = {
        messages: [{ role: 'tool', tool_call_id: 12345, content: 'result' }],
      };

      // Should not throw
      const result = sanitizeOpenAiBody(body, 'mistral', 'mistral-large');
      const messages = result.messages as any[];

      expect(messages[0].tool_call_id).toBe(12345);
    });

    it('should handle non-object message entries in reservation phase for Mistral', () => {
      const body = {
        messages: [null, 42, 'string', { role: 'user', content: 'Hi' }],
      };

      // Should not throw
      const result = sanitizeOpenAiBody(body as any, 'mistral', 'mistral-large');
      const messages = result.messages as any[];

      expect(messages[0]).toBeNull();
      expect(messages[1]).toBe(42);
      expect(messages[2]).toBe('string');
    });

    it('should handle array-type tool_call in reservation phase for Mistral', () => {
      const body = {
        messages: [{ role: 'assistant', tool_calls: [[1, 2], { id: 'Abc123XYZ' }] }],
      };

      const result = sanitizeOpenAiBody(body, 'mistral', 'mistral-large');
      const messages = result.messages as any[];

      // Array toolCalls should be skipped in reservation
      expect(messages[0].tool_calls[1].id).toBe('Abc123XYZ');
    });

    it('should generate unique IDs that avoid collisions with reserved IDs', () => {
      // Create a scenario where the first generated candidate would collide
      // This is hard to directly test, but we can verify uniqueness with multiple rewrites
      const body = {
        messages: [
          {
            role: 'assistant',
            tool_calls: [
              { id: 'very-long-call-id-1' },
              { id: 'very-long-call-id-2' },
              { id: 'very-long-call-id-3' },
            ],
          },
          { role: 'tool', tool_call_id: 'very-long-call-id-1', content: 'r1' },
          { role: 'tool', tool_call_id: 'very-long-call-id-2', content: 'r2' },
          { role: 'tool', tool_call_id: 'very-long-call-id-3', content: 'r3' },
        ],
      };

      const result = sanitizeOpenAiBody(body, 'mistral', 'mistral-large');
      const messages = result.messages as any[];

      const ids = messages[0].tool_calls.map((tc: any) => tc.id);
      // All IDs should be unique
      expect(new Set(ids).size).toBe(3);
      // Tool call IDs should match
      expect(messages[1].tool_call_id).toBe(ids[0]);
      expect(messages[2].tool_call_id).toBe(ids[1]);
      expect(messages[3].tool_call_id).toBe(ids[2]);
    });

    it('should reuse rewritten ID when same tool_call_id appears again', () => {
      const body = {
        messages: [
          {
            role: 'assistant',
            tool_calls: [{ id: 'long-call-id' }],
          },
          { role: 'tool', tool_call_id: 'long-call-id', content: 'r1' },
          // Same ID appears again (e.g., retried tool call)
          { role: 'tool', tool_call_id: 'long-call-id', content: 'r2' },
        ],
      };

      const result = sanitizeOpenAiBody(body, 'mistral', 'mistral-large');
      const messages = result.messages as any[];

      // Both tool responses should get the same rewritten ID
      expect(messages[1].tool_call_id).toBe(messages[2].tool_call_id);
      expect(messages[1].tool_call_id).toBe(messages[0].tool_calls[0].id);
    });

    /* ── max_tokens → max_completion_tokens for newer OpenAI models ── */

    it('should convert max_tokens to max_completion_tokens for GPT-5 models', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gpt-5',
        max_tokens: 4096,
      };

      const result = sanitizeOpenAiBody(body, 'openai', 'gpt-5');

      expect(result).toHaveProperty('max_completion_tokens', 4096);
      expect(result).not.toHaveProperty('max_tokens');
    });

    it('should convert max_tokens for o-series models', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'o3',
        max_tokens: 2048,
      };

      const result = sanitizeOpenAiBody(body, 'openai', 'o3');

      expect(result).toHaveProperty('max_completion_tokens', 2048);
      expect(result).not.toHaveProperty('max_tokens');
    });

    it('should keep max_tokens for older OpenAI models (GPT-4)', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gpt-4o',
        max_tokens: 4096,
      };

      const result = sanitizeOpenAiBody(body, 'openai', 'gpt-4o');

      expect(result).toHaveProperty('max_tokens', 4096);
      expect(result).not.toHaveProperty('max_completion_tokens');
    });

    it('should not convert when max_completion_tokens already present', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gpt-5.2',
        max_tokens: 1000,
        max_completion_tokens: 2000,
      };

      const result = sanitizeOpenAiBody(body, 'openai', 'gpt-5.2');

      expect(result).toHaveProperty('max_completion_tokens', 2000);
      expect(result).toHaveProperty('max_tokens', 1000);
    });

    it('should not convert max_tokens for non-OpenAI providers', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'mistral-large',
        max_tokens: 4096,
      };

      const result = sanitizeOpenAiBody(body, 'mistral', 'mistral-large');

      expect(result).toHaveProperty('max_tokens', 4096);
      expect(result).not.toHaveProperty('max_completion_tokens');
    });

    /* ── max_tokens → max_completion_tokens: extended edge cases ── */

    it('should convert max_tokens for o1 model', () => {
      const body = { messages: [], max_tokens: 2048 };

      const result = sanitizeOpenAiBody(body, 'openai', 'o1');

      expect(result).toHaveProperty('max_completion_tokens', 2048);
      expect(result).not.toHaveProperty('max_tokens');
    });

    it('should convert max_tokens for o1-mini model', () => {
      const body = { messages: [], max_tokens: 1024 };

      const result = sanitizeOpenAiBody(body, 'openai', 'o1-mini');

      expect(result).toHaveProperty('max_completion_tokens', 1024);
      expect(result).not.toHaveProperty('max_tokens');
    });

    it('should convert max_tokens for o3-mini model', () => {
      const body = { messages: [], max_tokens: 4096 };

      const result = sanitizeOpenAiBody(body, 'openai', 'o3-mini');

      expect(result).toHaveProperty('max_completion_tokens', 4096);
      expect(result).not.toHaveProperty('max_tokens');
    });

    it('should convert max_tokens for o4-mini model', () => {
      const body = { messages: [], max_tokens: 8192 };

      const result = sanitizeOpenAiBody(body, 'openai', 'o4-mini');

      expect(result).toHaveProperty('max_completion_tokens', 8192);
      expect(result).not.toHaveProperty('max_tokens');
    });

    it('should convert max_tokens for gpt-5.4 model', () => {
      const body = { messages: [], max_tokens: 16384 };

      const result = sanitizeOpenAiBody(body, 'openai', 'gpt-5.4');

      expect(result).toHaveProperty('max_completion_tokens', 16384);
      expect(result).not.toHaveProperty('max_tokens');
    });

    it('should convert max_tokens for gpt-5-chat-latest model', () => {
      const body = { messages: [], max_tokens: 4096 };

      const result = sanitizeOpenAiBody(body, 'openai', 'gpt-5-chat-latest');

      expect(result).toHaveProperty('max_completion_tokens', 4096);
      expect(result).not.toHaveProperty('max_tokens');
    });

    it('should NOT convert max_tokens for gpt-4.1 model', () => {
      const body = { messages: [], max_tokens: 4096 };

      const result = sanitizeOpenAiBody(body, 'openai', 'gpt-4.1');

      expect(result).toHaveProperty('max_tokens', 4096);
      expect(result).not.toHaveProperty('max_completion_tokens');
    });

    it('should NOT convert max_tokens for gpt-4o-mini model', () => {
      const body = { messages: [], max_tokens: 2048 };

      const result = sanitizeOpenAiBody(body, 'openai', 'gpt-4o-mini');

      expect(result).toHaveProperty('max_tokens', 2048);
      expect(result).not.toHaveProperty('max_completion_tokens');
    });

    it('should NOT convert for OpenRouter even when model is o3', () => {
      // OpenRouter is a passthrough provider, but it handles max_tokens itself
      // The conversion should only happen for endpointKey=openai
      const body = { messages: [], max_tokens: 4096 };

      const result = sanitizeOpenAiBody(body, 'openrouter', 'o3');

      // OpenRouter is passthrough, so max_tokens stays as-is (no conversion)
      expect(result).toHaveProperty('max_tokens', 4096);
      expect(result).not.toHaveProperty('max_completion_tokens');
    });

    it('should handle case insensitivity for o-series regex', () => {
      const body = { messages: [], max_tokens: 4096 };

      const result = sanitizeOpenAiBody(body, 'openai', 'O3');

      expect(result).toHaveProperty('max_completion_tokens', 4096);
      expect(result).not.toHaveProperty('max_tokens');
    });

    it('should handle case insensitivity for GPT-5 regex', () => {
      const body = { messages: [], max_tokens: 4096 };

      const result = sanitizeOpenAiBody(body, 'openai', 'GPT-5');

      expect(result).toHaveProperty('max_completion_tokens', 4096);
      expect(result).not.toHaveProperty('max_tokens');
    });

    it('should NOT convert when body has no max_tokens', () => {
      const body = { messages: [], model: 'gpt-5' };

      const result = sanitizeOpenAiBody(body, 'openai', 'gpt-5');

      expect(result).not.toHaveProperty('max_tokens');
      expect(result).not.toHaveProperty('max_completion_tokens');
    });

    it('should NOT match model names like "operative" that start with "o"', () => {
      const body = { messages: [], max_tokens: 4096 };

      // "operative" starts with "o" but the regex is /^(o[134]|gpt-5)/i
      // So "operative" won't match since it's o + non-[134] char
      const result = sanitizeOpenAiBody(body, 'openai', 'operative');

      expect(result).toHaveProperty('max_tokens', 4096);
      expect(result).not.toHaveProperty('max_completion_tokens');
    });

    it('should match o1-preview model', () => {
      const body = { messages: [], max_tokens: 4096 };

      const result = sanitizeOpenAiBody(body, 'openai', 'o1-preview');

      expect(result).toHaveProperty('max_completion_tokens', 4096);
      expect(result).not.toHaveProperty('max_tokens');
    });

    /* ── Non-passthrough provider: max_completion_tokens conversion ── */

    it('should convert max_completion_tokens to max_tokens for anthropic', () => {
      const body = {
        messages: [],
        max_completion_tokens: 4096,
      };

      const result = sanitizeOpenAiBody(body, 'anthropic', 'claude-opus-4-6');

      expect(result).toHaveProperty('max_tokens', 4096);
      expect(result).not.toHaveProperty('max_completion_tokens');
    });

    it('should convert max_completion_tokens to max_tokens for gemini', () => {
      const body = {
        messages: [],
        max_completion_tokens: 8192,
      };

      const result = sanitizeOpenAiBody(body, 'gemini', 'gemini-2.5-pro');

      expect(result).toHaveProperty('max_tokens', 8192);
      expect(result).not.toHaveProperty('max_completion_tokens');
    });

    it('should not convert max_completion_tokens when max_tokens already exists for non-passthrough', () => {
      const body = {
        messages: [],
        max_tokens: 2048,
        max_completion_tokens: 4096,
      };

      const result = sanitizeOpenAiBody(body, 'anthropic', 'claude-opus-4-6');

      expect(result).toHaveProperty('max_tokens', 2048);
      expect(result).not.toHaveProperty('max_completion_tokens');
    });
  });
});
