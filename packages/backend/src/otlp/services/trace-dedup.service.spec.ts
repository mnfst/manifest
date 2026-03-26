import { TraceDedupService, DedupContext } from './trace-dedup.service';
import { SpanEntry } from './trace-span-classifier';
import { IngestionContext } from '../interfaces/ingestion-context.interface';
import { OtlpSpan } from '../interfaces';

const testCtx: IngestionContext = {
  tenantId: 'test-tenant',
  agentId: 'test-agent',
  agentName: 'test-agent',
  userId: 'test-user',
};

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

function makeMockTurnRepo(mockFind: jest.Mock) {
  return { find: mockFind } as never;
}

describe('TraceDedupService', () => {
  let service: TraceDedupService;
  let mockFind: jest.Mock;

  beforeEach(() => {
    service = new TraceDedupService();
    mockFind = jest.fn().mockResolvedValue([]);
  });

  it('returns empty context when no agent_message spans exist', async () => {
    const spans = [makeSpan({ spanId: 's1' })];
    const spanMap = new Map<string, SpanEntry>([
      ['s1', { uuid: 'u1', type: 'root_request', spanId: 's1' }],
    ]);
    const ctx = await service.buildDedupContext(
      makeMockTurnRepo(mockFind),
      spans,
      spanMap,
      new Set(),
      new Set(),
      testCtx,
    );
    expect(ctx.errorTraceIds.size).toBe(0);
    expect(ctx.successTraceIds.size).toBe(0);
    expect(ctx.recentErrors).toHaveLength(0);
    // Still runs 3 non-trace queries (recentErrors, recentOkMessages, recentMessages)
    expect(mockFind).toHaveBeenCalledTimes(3);
  });

  it('collects trace IDs from agent_message spans for batch dedup', async () => {
    const spans = [
      makeSpan({ spanId: 's1', traceId: 'trace-1' }),
      makeSpan({ spanId: 's2', traceId: 'trace-2' }),
    ];
    const spanMap = new Map<string, SpanEntry>([
      ['s1', { uuid: 'u1', type: 'agent_message', spanId: 's1' }],
      ['s2', { uuid: 'u2', type: 'agent_message', spanId: 's2' }],
    ]);

    mockFind
      .mockResolvedValueOnce([{ id: 'err1', trace_id: 'trace-1' }]) // errorByTrace
      .mockResolvedValueOnce([{ id: 'ok1', trace_id: 'trace-2' }]) // successByTrace
      .mockResolvedValueOnce([]) // recentErrors
      .mockResolvedValueOnce([]) // recentOkMessages
      .mockResolvedValueOnce([]); // recentMessages

    const ctx = await service.buildDedupContext(
      makeMockTurnRepo(mockFind),
      spans,
      spanMap,
      new Set(),
      new Set(),
      testCtx,
    );
    expect(ctx.errorTraceIds.has('trace-1')).toBe(true);
    expect(ctx.successTraceIds.has('trace-2')).toBe(true);
  });

  it('skips ghost and fallback spans when collecting trace IDs', async () => {
    const spans = [
      makeSpan({ spanId: 'ghost', traceId: 'trace-ghost' }),
      makeSpan({ spanId: 'fallback', traceId: 'trace-fallback' }),
      makeSpan({ spanId: 'normal', traceId: 'trace-normal' }),
    ];
    const spanMap = new Map<string, SpanEntry>([
      ['ghost', { uuid: 'u1', type: 'agent_message', spanId: 'ghost' }],
      ['fallback', { uuid: 'u2', type: 'agent_message', spanId: 'fallback' }],
      ['normal', { uuid: 'u3', type: 'agent_message', spanId: 'normal' }],
    ]);

    await service.buildDedupContext(
      makeMockTurnRepo(mockFind),
      spans,
      spanMap,
      new Set(['ghost']),
      new Set(['fallback']),
      testCtx,
    );

    // Should run trace-based queries with only 'trace-normal'
    const errorCall = mockFind.mock.calls[0];
    expect(errorCall[0].where.trace_id._value).toEqual(['trace-normal']);
  });

  it('skips trace-based queries when no trace IDs exist', async () => {
    const spans = [makeSpan({ spanId: 's1', traceId: '' })];
    const spanMap = new Map<string, SpanEntry>([
      ['s1', { uuid: 'u1', type: 'agent_message', spanId: 's1' }],
    ]);

    const ctx = await service.buildDedupContext(
      makeMockTurnRepo(mockFind),
      spans,
      spanMap,
      new Set(),
      new Set(),
      testCtx,
    );
    expect(ctx.errorTraceIds.size).toBe(0);
    expect(ctx.successTraceIds.size).toBe(0);
    // Only 3 non-trace queries (no errorByTrace/successByTrace find calls)
    expect(mockFind).toHaveBeenCalledTimes(3);
  });

  it('maps recent data with null fields to safe defaults', async () => {
    mockFind
      .mockResolvedValueOnce([]) // recentErrors
      .mockResolvedValueOnce([{ id: 'ok1', timestamp: '2024-01-01T00:00:00Z', input_tokens: null }]) // recentOkMessages
      .mockResolvedValueOnce([
        {
          id: 'm1',
          timestamp: '2024-01-01T00:00:00Z',
          input_tokens: null,
          output_tokens: null,
          model: null,
          session_key: null,
        },
      ]); // recentMessages

    const spans = [makeSpan({ spanId: 's1', traceId: '' })];
    const spanMap = new Map<string, SpanEntry>([
      ['s1', { uuid: 'u1', type: 'agent_message', spanId: 's1' }],
    ]);

    const ctx = await service.buildDedupContext(
      makeMockTurnRepo(mockFind),
      spans,
      spanMap,
      new Set(),
      new Set(),
      testCtx,
    );

    expect(ctx.recentOkMessages[0].input_tokens).toBe(0);
    expect(ctx.recentMessages[0].input_tokens).toBe(0);
    expect(ctx.recentMessages[0].output_tokens).toBe(0);
    expect(ctx.recentMessages[0].model).toBeNull();
    expect(ctx.recentMessages[0].session_key).toBeNull();
  });
});
