import {
  flattenSpans,
  classifySpan,
  buildSpanMap,
  isEmptyOkSpan,
  filterGhostSpans,
  SpanEntry,
} from './trace-span-classifier';
import { OtlpResourceSpans, OtlpSpan } from '../interfaces';
import { AttributeMap } from './otlp-helpers';

function makeSpan(overrides: Record<string, unknown> = {}): OtlpSpan {
  return {
    traceId: 'trace-abc',
    spanId: 'span-001',
    name: 'test-span',
    kind: 1,
    startTimeUnixNano: '1708000000000000000',
    endTimeUnixNano: '1708000001000000000',
    attributes: [],
    status: { code: 0 },
    ...overrides,
  } as OtlpSpan;
}

describe('trace-span-classifier', () => {
  describe('flattenSpans', () => {
    it('flattens scopeSpans into a single array', () => {
      const rs: OtlpResourceSpans = {
        resource: { attributes: [] },
        scopeSpans: [
          { scope: { name: 'a' }, spans: [makeSpan({ spanId: 's1' })] },
          { scope: { name: 'b' }, spans: [makeSpan({ spanId: 's2' }), makeSpan({ spanId: 's3' })] },
        ],
      };
      expect(flattenSpans(rs)).toHaveLength(3);
    });

    it('handles missing scopeSpans', () => {
      const rs = {
        resource: { attributes: [] },
        scopeSpans: undefined,
      } as unknown as OtlpResourceSpans;
      expect(flattenSpans(rs)).toHaveLength(0);
    });

    it('handles missing spans array within scopeSpans', () => {
      const rs: OtlpResourceSpans = {
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'a' }, spans: undefined as never }],
      };
      expect(flattenSpans(rs)).toHaveLength(0);
    });
  });

  describe('classifySpan', () => {
    it('classifies openclaw.agent.turn as agent_message', () => {
      expect(classifySpan({}, 'openclaw.agent.turn')).toBe('agent_message');
    });

    it('classifies manifest.* prefix as agent_message', () => {
      expect(classifySpan({}, 'manifest.custom.span')).toBe('agent_message');
    });

    it('classifies span with gen_ai.system as llm_call', () => {
      expect(classifySpan({ 'gen_ai.system': 'anthropic' }, 'some-span')).toBe('llm_call');
    });

    it('classifies span with tool.name as tool_execution', () => {
      expect(classifySpan({ 'tool.name': 'web_search' }, 'some-span')).toBe('tool_execution');
    });

    it('classifies unknown spans as root_request', () => {
      expect(classifySpan({}, 'http.client.request')).toBe('root_request');
    });

    it('classifies span with no name as root_request', () => {
      expect(classifySpan({})).toBe('root_request');
    });
  });

  describe('buildSpanMap', () => {
    it('builds a map of spanId to SpanEntry', () => {
      const spans = [
        makeSpan({ spanId: 's1', name: 'openclaw.agent.turn' }),
        makeSpan({
          spanId: 's2',
          attributes: [{ key: 'gen_ai.system', value: { stringValue: 'openai' } }],
        }),
      ];
      const map = buildSpanMap(spans, {});
      expect(map.size).toBe(2);
      expect(map.get('s1')?.type).toBe('agent_message');
      expect(map.get('s2')?.type).toBe('llm_call');
    });

    it('merges resource attributes with span attributes for classification', () => {
      const spans = [makeSpan({ spanId: 's1', attributes: [] })];
      const resourceAttrs: AttributeMap = { 'tool.name': 'resource-tool' };
      const map = buildSpanMap(spans, resourceAttrs);
      expect(map.get('s1')?.type).toBe('tool_execution');
    });
  });

  describe('isEmptyOkSpan', () => {
    it('returns true for ok span with no model and zero tokens', () => {
      const span = makeSpan({ status: { code: 1 } });
      expect(isEmptyOkSpan(span, {})).toBe(true);
    });

    it('returns false for error span', () => {
      const span = makeSpan({ status: { code: 2 } });
      expect(isEmptyOkSpan(span, {})).toBe(false);
    });

    it('returns false when request model is present', () => {
      const span = makeSpan({ status: { code: 1 } });
      expect(isEmptyOkSpan(span, { 'gen_ai.request.model': 'gpt-4o' })).toBe(false);
    });

    it('returns false when response model is present', () => {
      const span = makeSpan({ status: { code: 1 } });
      expect(isEmptyOkSpan(span, { 'gen_ai.response.model': 'gpt-4o' })).toBe(false);
    });

    it('returns false when input tokens are nonzero', () => {
      const span = makeSpan({ status: { code: 1 } });
      expect(isEmptyOkSpan(span, { 'gen_ai.usage.input_tokens': 10 })).toBe(false);
    });

    it('returns false when output tokens are nonzero', () => {
      const span = makeSpan({ status: { code: 1 } });
      expect(isEmptyOkSpan(span, { 'gen_ai.usage.output_tokens': 5 })).toBe(false);
    });
  });

  describe('filterGhostSpans', () => {
    it('filters empty ok spans when data sibling exists within 60s', () => {
      const dataSpan = makeSpan({
        spanId: 'data',
        name: 'openclaw.agent.turn',
        attributes: [
          { key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o' } },
          { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        ],
      });
      const ghostSpan = makeSpan({
        spanId: 'ghost',
        name: 'openclaw.agent.turn',
        status: { code: 1 },
      });
      const spanMap = new Map<string, SpanEntry>([
        ['data', { uuid: 'u1', type: 'agent_message', spanId: 'data' }],
        ['ghost', { uuid: 'u2', type: 'agent_message', spanId: 'ghost' }],
      ]);
      const ghostIds = filterGhostSpans([dataSpan, ghostSpan], {}, spanMap);
      expect(ghostIds.has('ghost')).toBe(true);
      expect(ghostIds.has('data')).toBe(false);
    });

    it('does not filter empty ok span when no data sibling exists', () => {
      const emptySpan = makeSpan({
        spanId: 'empty',
        name: 'openclaw.agent.turn',
        status: { code: 1 },
      });
      const spanMap = new Map<string, SpanEntry>([
        ['empty', { uuid: 'u1', type: 'agent_message', spanId: 'empty' }],
      ]);
      const ghostIds = filterGhostSpans([emptySpan], {}, spanMap);
      expect(ghostIds.size).toBe(0);
    });

    it('skips non-agent_message spans', () => {
      const llmSpan = makeSpan({
        spanId: 'llm',
        attributes: [{ key: 'gen_ai.system', value: { stringValue: 'openai' } }],
      });
      const spanMap = new Map<string, SpanEntry>([
        ['llm', { uuid: 'u1', type: 'llm_call', spanId: 'llm' }],
      ]);
      const ghostIds = filterGhostSpans([llmSpan], {}, spanMap);
      expect(ghostIds.size).toBe(0);
    });

    it('does not filter error spans even when they appear empty', () => {
      const dataSpan = makeSpan({
        spanId: 'data',
        name: 'openclaw.agent.turn',
        attributes: [{ key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o' } }],
      });
      const errorSpan = makeSpan({
        spanId: 'err',
        name: 'openclaw.agent.turn',
        status: { code: 2 },
      });
      const spanMap = new Map<string, SpanEntry>([
        ['data', { uuid: 'u1', type: 'agent_message', spanId: 'data' }],
        ['err', { uuid: 'u2', type: 'agent_message', spanId: 'err' }],
      ]);
      const ghostIds = filterGhostSpans([dataSpan, errorSpan], {}, spanMap);
      expect(ghostIds.size).toBe(0);
    });
  });
});
