import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TraceEntityBuilder, MessageAggregate } from './trace-entity-builder';
import { TraceCostCalculator } from './trace-cost-calculator';
import { UserProvider } from '../../entities/user-provider.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { SpanEntry } from './trace-span-classifier';
import { DedupContext } from './trace-dedup.service';
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

function emptyDedup(): DedupContext {
  return {
    errorTraceIds: new Set(),
    successTraceIds: new Set(),
    recentErrors: [],
    recentOkMessages: [],
    recentMessages: [],
  };
}

describe('TraceEntityBuilder', () => {
  let builder: TraceEntityBuilder;
  let mockPricingGetByModel: jest.Mock;

  beforeEach(async () => {
    mockPricingGetByModel = jest.fn().mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TraceEntityBuilder,
        TraceCostCalculator,
        {
          provide: getRepositoryToken(UserProvider),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        { provide: ModelPricingCacheService, useValue: { getByModel: mockPricingGetByModel } },
      ],
    }).compile();

    builder = module.get<TraceEntityBuilder>(TraceEntityBuilder);
  });

  describe('buildAgentMessage', () => {
    it('builds a valid agent message row', () => {
      const span = makeSpan({ name: 'openclaw.agent.turn' });
      const entry: SpanEntry = { uuid: 'uuid-1', type: 'agent_message', spanId: 'span-001' };
      const row = builder.buildAgentMessage(span, {}, entry, testCtx, emptyDedup(), new Set());
      expect(row).not.toBeNull();
      expect(row!.tenant_id).toBe('test-tenant');
      expect(row!.agent_id).toBe('test-agent');
    });

    it('returns null when trace has error dedup match', () => {
      const span = makeSpan({ traceId: 'trace-err' });
      const entry: SpanEntry = { uuid: 'uuid-1', type: 'agent_message', spanId: 'span-001' };
      const dedup = emptyDedup();
      dedup.errorTraceIds.add('trace-err');
      expect(builder.buildAgentMessage(span, {}, entry, testCtx, dedup, new Set())).toBeNull();
    });

    it('returns null when trace has success dedup match', () => {
      const span = makeSpan({ traceId: 'trace-ok' });
      const entry: SpanEntry = { uuid: 'uuid-1', type: 'agent_message', spanId: 'span-001' };
      const dedup = emptyDedup();
      dedup.successTraceIds.add('trace-ok');
      expect(builder.buildAgentMessage(span, {}, entry, testCtx, dedup, new Set())).toBeNull();
    });

    it('returns null when nearby error exists', () => {
      const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
      const nearbyTs = new Date(spanTime.getTime() + 5000).toISOString();
      const span = makeSpan({ traceId: '' });
      const entry: SpanEntry = { uuid: 'uuid-1', type: 'agent_message', spanId: 'span-001' };
      const dedup = emptyDedup();
      dedup.recentErrors = [{ id: 'err1', timestamp: nearbyTs }];
      expect(builder.buildAgentMessage(span, {}, entry, testCtx, dedup, new Set())).toBeNull();
    });

    it('returns null when proxy has recorded data for zero-token span', () => {
      const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
      const nearbyTs = new Date(spanTime.getTime() + 2000).toISOString();
      const span = makeSpan({ traceId: '' });
      const entry: SpanEntry = { uuid: 'uuid-1', type: 'agent_message', spanId: 'span-001' };
      const dedup = emptyDedup();
      dedup.recentOkMessages = [{ id: 'ok1', timestamp: nearbyTs, input_tokens: 100 }];
      expect(builder.buildAgentMessage(span, {}, entry, testCtx, dedup, new Set())).toBeNull();
    });

    it('returns null when proxy has matching model+tokens', () => {
      const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
      const nearbyTs = new Date(spanTime.getTime() + 3000).toISOString();
      const span = makeSpan({ traceId: '' });
      const attrs = {
        'gen_ai.request.model': 'gpt-4o',
        'gen_ai.usage.input_tokens': 100,
        'gen_ai.usage.output_tokens': 50,
      };
      const entry: SpanEntry = { uuid: 'uuid-1', type: 'agent_message', spanId: 'span-001' };
      const dedup = emptyDedup();
      dedup.recentMessages = [
        {
          id: 'm1',
          timestamp: nearbyTs,
          input_tokens: 100,
          output_tokens: 50,
          model: 'gpt-4o',
          session_key: null,
        },
      ];
      expect(builder.buildAgentMessage(span, attrs, entry, testCtx, dedup, new Set())).toBeNull();
    });

    it('returns null for DB ghost duplicate with session_key match', () => {
      const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
      const nearbyTs = new Date(spanTime.getTime() + 5000).toISOString();
      const span = makeSpan({ traceId: '', status: { code: 1 } });
      const attrs = { 'session.key': 'session-abc' };
      const entry: SpanEntry = { uuid: 'uuid-1', type: 'agent_message', spanId: 'span-001' };
      const dedup = emptyDedup();
      dedup.recentMessages = [
        {
          id: 'm1',
          timestamp: nearbyTs,
          input_tokens: 100,
          output_tokens: 0,
          model: null,
          session_key: 'session-abc',
        },
      ];
      expect(builder.buildAgentMessage(span, attrs, entry, testCtx, dedup, new Set())).toBeNull();
    });
  });

  describe('buildLlmCall', () => {
    it('builds a valid LLM call row', () => {
      const span = makeSpan({
        spanId: 'span-llm',
        parentSpanId: 'span-parent',
        attributes: [
          { key: 'gen_ai.system', value: { stringValue: 'anthropic' } },
          { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-4-6' } },
        ],
      });
      const entry: SpanEntry = { uuid: 'uuid-llm', type: 'llm_call', spanId: 'span-llm' };
      const spanMap = new Map<string, SpanEntry>([
        ['span-parent', { uuid: 'uuid-parent', type: 'agent_message', spanId: 'span-parent' }],
      ]);
      const row = builder.buildLlmCall(
        span,
        { 'gen_ai.system': 'anthropic' },
        entry,
        spanMap,
        testCtx,
      );
      expect(row.turn_id).toBe('uuid-parent');
      expect(row.gen_ai_system).toBe('anthropic');
    });

    it('sets null turn_id when parent is not agent_message', () => {
      const span = makeSpan({ spanId: 'span-llm', parentSpanId: 'span-root' });
      const entry: SpanEntry = { uuid: 'uuid-llm', type: 'llm_call', spanId: 'span-llm' };
      const spanMap = new Map<string, SpanEntry>([
        ['span-root', { uuid: 'uuid-root', type: 'root_request', spanId: 'span-root' }],
      ]);
      const row = builder.buildLlmCall(span, {}, entry, spanMap, testCtx);
      expect(row.turn_id).toBeNull();
    });
  });

  describe('buildToolExecution', () => {
    it('builds a valid tool execution row', () => {
      const span = makeSpan({
        spanId: 'span-tool',
        parentSpanId: 'span-llm',
        attributes: [{ key: 'tool.name', value: { stringValue: 'bash' } }],
      });
      const entry: SpanEntry = { uuid: 'uuid-tool', type: 'tool_execution', spanId: 'span-tool' };
      const spanMap = new Map<string, SpanEntry>([
        ['span-llm', { uuid: 'uuid-llm', type: 'llm_call', spanId: 'span-llm' }],
      ]);
      const row = builder.buildToolExecution(
        span,
        { 'tool.name': 'bash' },
        entry,
        spanMap,
        testCtx,
      );
      expect(row.llm_call_id).toBe('uuid-llm');
      expect(row.tool_name).toBe('bash');
    });

    it('sets null llm_call_id when parent is not llm_call', () => {
      const span = makeSpan({ spanId: 'span-tool', parentSpanId: 'span-msg' });
      const entry: SpanEntry = { uuid: 'uuid-tool', type: 'tool_execution', spanId: 'span-tool' };
      const spanMap = new Map<string, SpanEntry>([
        ['span-msg', { uuid: 'uuid-msg', type: 'agent_message', spanId: 'span-msg' }],
      ]);
      const row = builder.buildToolExecution(span, {}, entry, spanMap, testCtx);
      expect(row.llm_call_id).toBeNull();
    });
  });

  describe('accumulateToMessage', () => {
    it('accumulates tokens from llm_call into parent agent_message', () => {
      const span = makeSpan({ spanId: 'span-llm', parentSpanId: 'span-msg' });
      const attrs = {
        'gen_ai.usage.input_tokens': 100,
        'gen_ai.usage.output_tokens': 50,
        'gen_ai.request.model': 'gpt-4o',
      };
      const spanMap = new Map<string, SpanEntry>([
        ['span-msg', { uuid: 'uuid-msg', type: 'agent_message', spanId: 'span-msg' }],
      ]);
      const aggregates = new Map<string, MessageAggregate>();
      builder.accumulateToMessage(span, attrs, spanMap, aggregates);
      expect(aggregates.get('uuid-msg')?.input).toBe(100);
      expect(aggregates.get('uuid-msg')?.output).toBe(50);
      expect(aggregates.get('uuid-msg')?.model).toBe('gpt-4o');
    });

    it('does not accumulate when parent is not agent_message', () => {
      const span = makeSpan({ spanId: 'span-llm', parentSpanId: 'span-root' });
      const spanMap = new Map<string, SpanEntry>([
        ['span-root', { uuid: 'uuid-root', type: 'root_request', spanId: 'span-root' }],
      ]);
      const aggregates = new Map<string, MessageAggregate>();
      builder.accumulateToMessage(span, {}, spanMap, aggregates);
      expect(aggregates.size).toBe(0);
    });

    it('does not accumulate when parent is not in spanMap', () => {
      const span = makeSpan({ spanId: 'span-llm', parentSpanId: 'nonexistent' });
      const spanMap = new Map<string, SpanEntry>();
      const aggregates = new Map<string, MessageAggregate>();
      builder.accumulateToMessage(span, {}, spanMap, aggregates);
      expect(aggregates.size).toBe(0);
    });
  });

  describe('rollUpMessageAggregates', () => {
    it('skips rollup when both tokens are zero', async () => {
      const mockExecute = jest.fn();
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: mockExecute,
      };
      const turnRepo = { createQueryBuilder: jest.fn().mockReturnValue(mockQb) } as never;
      const aggregates = new Map<string, MessageAggregate>([
        [
          'msg-1',
          {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheCreation: 0,
            model: null,
            tier: null,
            reason: null,
            cost: 0,
          },
        ],
      ]);
      await builder.rollUpMessageAggregates(turnRepo, aggregates, new Set());
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('executes rollup update when tokens are nonzero', async () => {
      const mockExecute = jest.fn().mockResolvedValue({});
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: mockExecute,
      };
      const turnRepo = { createQueryBuilder: jest.fn().mockReturnValue(mockQb) } as never;
      const aggregates = new Map<string, MessageAggregate>([
        [
          'msg-1',
          {
            input: 100,
            output: 50,
            cacheRead: 0,
            cacheCreation: 0,
            model: 'gpt-4o',
            tier: null,
            reason: null,
            cost: 0,
          },
        ],
      ]);
      await builder.rollUpMessageAggregates(turnRepo, aggregates, new Set());
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('includes duration_ms COALESCE when fallback duration is provided', async () => {
      const mockExecute = jest.fn().mockResolvedValue({});
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: mockExecute,
      };
      const turnRepo = { createQueryBuilder: jest.fn().mockReturnValue(mockQb) } as never;
      const aggregates = new Map<string, MessageAggregate>([
        [
          'msg-1',
          {
            input: 100,
            output: 50,
            cacheRead: 0,
            cacheCreation: 0,
            model: 'gpt-4o',
            tier: null,
            reason: null,
            cost: 0,
          },
        ],
      ]);
      const fallbackDurations = new Map([['msg-1', 1500]]);
      await builder.rollUpMessageAggregates(
        turnRepo,
        aggregates,
        new Set(),
        undefined,
        fallbackDurations,
      );
      expect(mockQb.setParameter).toHaveBeenCalledWith('durationMs', 1500);
    });
  });
});
