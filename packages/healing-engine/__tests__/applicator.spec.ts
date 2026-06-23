import { applyOperations, UnknownOperationError } from '../src/applicator';
import { Operation } from '../src/operation';

const apply = (body: Record<string, unknown>, ops: Operation[]) => applyOperations(body, ops).body;

describe('applyOperations', () => {
  it('does not mutate the original body', () => {
    const original = { model: 'gpt-4-vision-preview', messages: [] };
    applyOperations(original, [{ type: 'remap_model', from: 'gpt-4-vision-preview', to: 'gpt-4o' }]);
    expect(original.model).toBe('gpt-4-vision-preview');
  });

  describe('rename_param', () => {
    it('renames a present param', () => {
      expect(apply({ max_tokens: 100 }, [{ type: 'rename_param', from: 'max_tokens', to: 'max_completion_tokens' }])).toEqual({ max_completion_tokens: 100 });
    });
    it('is a no-op when the param is absent', () => {
      expect(apply({ model: 'x' }, [{ type: 'rename_param', from: 'max_tokens', to: 'max_completion_tokens' }])).toEqual({ model: 'x' });
    });
  });

  it('drop_param removes the key', () => {
    expect(apply({ model: 'x', store: true }, [{ type: 'drop_param', param: 'store' }])).toEqual({ model: 'x' });
  });

  describe('clamp_param', () => {
    it('clamps a value above max', () => {
      expect(apply({ max_tokens: 999999 }, [{ type: 'clamp_param', param: 'max_tokens', max: 4096 }])).toEqual({ max_tokens: 4096 });
    });
    it('leaves a value at or below max', () => {
      expect(apply({ max_tokens: 100 }, [{ type: 'clamp_param', param: 'max_tokens', max: 4096 }])).toEqual({ max_tokens: 100 });
    });
    it('ignores a non-numeric value', () => {
      expect(apply({ max_tokens: 'lots' }, [{ type: 'clamp_param', param: 'max_tokens', max: 4096 }])).toEqual({ max_tokens: 'lots' });
    });
  });

  describe('strip_schema_keys', () => {
    it('removes keys recursively from tools', () => {
      const body = { tools: [{ function: { parameters: { type: 'object', $schema: 'http://x', additionalProperties: false } } }] };
      expect(apply(body, [{ type: 'strip_schema_keys', keys: ['$schema', 'additionalProperties'] }])).toEqual({ tools: [{ function: { parameters: { type: 'object' } } }] });
    });
    it('recurses through nested arrays in a tool schema', () => {
      const body = { tools: [{ function: { parameters: { type: 'object', required: ['a', 'b'], $schema: 'http://x' } } }] };
      expect(apply(body, [{ type: 'strip_schema_keys', keys: ['$schema'] }])).toEqual({ tools: [{ function: { parameters: { type: 'object', required: ['a', 'b'] } } }] });
    });
    it('is a no-op when there are no tools', () => {
      expect(apply({ model: 'x' }, [{ type: 'strip_schema_keys', keys: ['$schema'] }])).toEqual({ model: 'x' });
    });
  });

  describe('remap_model', () => {
    it('remaps a matching model', () => {
      expect(apply({ model: 'gpt-4-vision-preview' }, [{ type: 'remap_model', from: 'gpt-4-vision-preview', to: 'gpt-4o' }])).toEqual({ model: 'gpt-4o' });
    });
    it('leaves a non-matching model', () => {
      expect(apply({ model: 'gpt-4o' }, [{ type: 'remap_model', from: 'gpt-4-vision-preview', to: 'gpt-4o' }])).toEqual({ model: 'gpt-4o' });
    });
  });

  describe('reorder_messages', () => {
    it('user_first drops leading non-user turns and pins system', () => {
      const body = { messages: [{ role: 'system', content: 's' }, { role: 'assistant', content: 'a' }, { role: 'user', content: 'u' }] };
      expect(apply(body, [{ type: 'reorder_messages', rule: 'user_first' }]).messages).toEqual([{ role: 'system', content: 's' }, { role: 'user', content: 'u' }]);
    });
    it('alternate collapses consecutive same-role turns', () => {
      const body = { messages: [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }, { role: 'assistant', content: 'c' }] };
      expect(apply(body, [{ type: 'reorder_messages', rule: 'alternate' }]).messages).toEqual([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'c' }]);
    });
    it('defaults missing messages to an empty list', () => {
      expect(apply({ model: 'x' }, [{ type: 'reorder_messages', rule: 'alternate' }]).messages).toEqual([]);
    });
  });

  describe('inject_field', () => {
    it('creates a nested path', () => {
      expect(apply({ response_format: { json_schema: { schema: {} } } }, [{ type: 'inject_field', path: 'response_format.json_schema.schema.additionalProperties', value: false }])).toEqual({ response_format: { json_schema: { schema: { additionalProperties: false } } } });
    });
    it('creates intermediate objects when the path is absent', () => {
      expect(apply({}, [{ type: 'inject_field', path: 'a.b', value: 1 }])).toEqual({ a: { b: 1 } });
    });
  });

  describe('trim_context', () => {
    it('summarize replaces older turns with a summary when more than two remain', () => {
      const body = { messages: [{ role: 'user', content: '1' }, { role: 'assistant', content: '2' }, { role: 'user', content: '3' }, { role: 'assistant', content: '4' }] };
      const out = apply(body, [{ type: 'trim_context', strategy: 'summarize', targetTokens: 10 }]).messages as Array<{ role: string }>;
      expect(out[0].role).toBe('system');
      expect(out.length).toBe(3);
    });
    it('summarize with two or fewer turns falls back to the budget path', () => {
      const body = { messages: [{ role: 'user', content: 'hi' }] };
      expect(apply(body, [{ type: 'trim_context', strategy: 'summarize', targetTokens: 10 }]).messages).toEqual([{ role: 'user', content: 'hi' }]);
    });
    it('drop_oldest keeps the most recent turns within budget', () => {
      const body = { messages: [{ role: 'user', content: 'aaaaaaaa' }, { role: 'user', content: 'bbbbbbbb' }] };
      const out = apply(body, [{ type: 'trim_context', strategy: 'drop_oldest', targetTokens: 1 }]).messages as Array<{ content: string }>;
      expect(out).toEqual([{ role: 'user', content: 'bbbbbbbb' }]);
    });
  });

  describe('drop_orphan_tool_messages', () => {
    it('keeps a tool message preceded by an assistant tool_calls turn', () => {
      const body = { messages: [{ role: 'assistant', content: null, tool_calls: [{ id: 't1' }] }, { role: 'tool', content: 'r' }] };
      expect((apply(body, [{ type: 'drop_orphan_tool_messages' }]).messages as unknown[]).length).toBe(2);
    });
    it('drops an orphan tool message and one whose assistant lacks tool_calls', () => {
      const body = { messages: [{ role: 'tool', content: 'orphan' }, { role: 'assistant', content: 'a' }, { role: 'tool', content: 'r' }] };
      expect(apply(body, [{ type: 'drop_orphan_tool_messages' }]).messages).toEqual([{ role: 'assistant', content: 'a' }]);
    });
  });

  it('strip_message_keys deletes stray keys from every message', () => {
    const body = { messages: [{ role: 'assistant', content: 'a', reasoning_content: 'secret' }] };
    expect(apply(body, [{ type: 'strip_message_keys', keys: ['reasoning_content'] }]).messages).toEqual([{ role: 'assistant', content: 'a' }]);
  });

  describe('ensure_array_items', () => {
    it('adds a default items schema to array sub-schemas, recursing arrays and objects', () => {
      const body = { tools: [{ function: { parameters: { type: 'object', properties: { tags: { type: 'array' } } } } }], response_format: { type: 'array' } };
      const out = apply(body, [{ type: 'ensure_array_items' }]);
      expect((out.tools as any)[0].function.parameters.properties.tags.items).toEqual({ type: 'string' });
      expect((out.response_format as any).items).toEqual({ type: 'string' });
    });
    it('is a no-op when there are no schemas', () => {
      expect(apply({ model: 'x' }, [{ type: 'ensure_array_items' }])).toEqual({ model: 'x' });
    });
  });

  describe('drop_oversized_content', () => {
    it('drops oversized content parts and keeps small ones', () => {
      const big = 'x'.repeat(200);
      const body = { messages: [{ role: 'user', content: [{ type: 'text', text: 'ok' }, { type: 'image', data: big }] }] };
      const out = apply(body, [{ type: 'drop_oversized_content', maxBytes: 50 }]).messages as Array<{ content: unknown[] }>;
      expect(out[0].content).toEqual([{ type: 'text', text: 'ok' }]);
    });
    it('passes through messages whose content is not an array', () => {
      const body = { messages: [{ role: 'user', content: 'plain' }] };
      expect(apply(body, [{ type: 'drop_oversized_content', maxBytes: 50 }]).messages).toEqual([{ role: 'user', content: 'plain' }]);
    });
  });

  describe('message-default and nullish branches', () => {
    it('defaults missing messages to empty for every message op', () => {
      const ops: Operation[] = [
        { type: 'trim_context', strategy: 'drop_oldest', targetTokens: 10 },
        { type: 'drop_orphan_tool_messages' },
        { type: 'strip_message_keys', keys: ['reasoning_content'] },
        { type: 'drop_oversized_content', maxBytes: 100 },
      ];
      for (const op of ops) {
        expect(apply({ model: 'x' }, [op]).messages).toEqual([]);
      }
    });
    it('drop_oversized_content keeps a nullish content part (treated as empty)', () => {
      const body = { messages: [{ role: 'user', content: [null, { data: 'x'.repeat(200) }] }] };
      expect((apply(body, [{ type: 'drop_oversized_content', maxBytes: 50 }]).messages as Array<{ content: unknown[] }>)[0].content).toEqual([null]);
    });
  });

  describe('fail-safe', () => {
    it('throws UnknownOperationError on an op outside the catalog', () => {
      expect(() => applyOperations({}, [{ type: 'bogus_op' } as unknown as Operation])).toThrow(UnknownOperationError);
    });
    it('exposes the offending op type on the error', () => {
      try {
        applyOperations({}, [{ type: 'bogus_op' } as unknown as Operation]);
      } catch (e) {
        expect((e as UnknownOperationError).opType).toBe('bogus_op');
        expect((e as UnknownOperationError).name).toBe('UnknownOperationError');
      }
    });
  });

  describe('diff', () => {
    it('reports scalar field changes and message counts, never message/tool content', () => {
      const body = { model: 'gpt-4-vision-preview', store: true, messages: [{ role: 'user', content: 'hi' }] };
      const { diff } = applyOperations(body, [
        { type: 'remap_model', from: 'gpt-4-vision-preview', to: 'gpt-4o' },
        { type: 'drop_param', param: 'store' },
      ]);
      expect(diff.operations).toEqual(['remap_model', 'drop_param']);
      expect((diff.fields as any).model).toEqual({ before: 'gpt-4-vision-preview', after: 'gpt-4o' });
      expect((diff.fields as any).store).toEqual({ before: true, after: null });
      expect((diff.fields as any).messages).toBeUndefined();
      expect((diff.messageCount as any)).toEqual({ before: 1, after: 1 });
    });
    it('defaults message counts to zero when there are no messages', () => {
      const { diff } = applyOperations({ model: 'x' }, [{ type: 'remap_model', from: 'x', to: 'y' }]);
      expect((diff.messageCount as any)).toEqual({ before: 0, after: 0 });
    });
  });
});
