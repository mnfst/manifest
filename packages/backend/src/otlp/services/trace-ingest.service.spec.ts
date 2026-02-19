import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TraceIngestService } from './trace-ingest.service';
import { AgentMessage } from '../../entities/agent-message.entity';
import { LlmCall } from '../../entities/llm-call.entity';
import { ToolExecution } from '../../entities/tool-execution.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { IngestionContext } from '../interfaces/ingestion-context.interface';

const testCtx: IngestionContext = { tenantId: 'test-tenant', agentId: 'test-agent', agentName: 'test-agent', userId: 'test-user' };

describe('TraceIngestService', () => {
  let service: TraceIngestService;
  let mockTurnInsert: jest.Mock;
  let mockLlmInsert: jest.Mock;
  let mockToolInsert: jest.Mock;
  let mockPricingGetByModel: jest.Mock;
  let mockExecute: jest.Mock;

  beforeEach(async () => {
    mockTurnInsert = jest.fn().mockResolvedValue({});
    mockLlmInsert = jest.fn().mockResolvedValue({});
    mockToolInsert = jest.fn().mockResolvedValue({});
    mockPricingGetByModel = jest.fn().mockReturnValue(undefined);
    mockExecute = jest.fn().mockResolvedValue({});

    const mockQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: mockExecute,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TraceIngestService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: {
            insert: mockTurnInsert,
            createQueryBuilder: jest.fn().mockReturnValue(mockQb),
          },
        },
        { provide: getRepositoryToken(LlmCall), useValue: { insert: mockLlmInsert } },
        { provide: getRepositoryToken(ToolExecution), useValue: { insert: mockToolInsert } },
        { provide: ModelPricingCacheService, useValue: { getByModel: mockPricingGetByModel } },
      ],
    }).compile();

    service = module.get<TraceIngestService>(TraceIngestService);
  });

  function makeSpan(overrides: Record<string, unknown> = {}) {
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
    };
  }

  it('returns accepted count of 0 for empty request', async () => {
    const result = await service.ingest({ resourceSpans: [] }, testCtx);
    expect(result.accepted).toBe(0);
  });

  it('ingests an agent_message span (no gen_ai.system or tool.name)', async () => {
    const request = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'agent' } },
            { key: 'agent.name', value: { stringValue: 'bot-1' } },
          ],
        },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: [makeSpan()],
        }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(1);
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'test-tenant',
        agent_id: 'test-agent',
        agent_name: 'bot-1',
      }),
    );
  });

  it('ingests an llm_call span (has gen_ai.system attribute)', async () => {
    const span = makeSpan({
      spanId: 'span-llm',
      parentSpanId: 'span-001',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'anthropic' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-4-6' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: [makeSpan(), span],
        }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(2);
    expect(mockLlmInsert).toHaveBeenCalledTimes(1);
    expect(mockLlmInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'test-tenant',
        gen_ai_system: 'anthropic',
        request_model: 'claude-opus-4-6',
        input_tokens: 100,
        output_tokens: 50,
      }),
    );
  });

  it('ingests a tool_execution span (has tool.name attribute)', async () => {
    const span = makeSpan({
      spanId: 'span-tool',
      parentSpanId: 'span-llm',
      attributes: [
        { key: 'tool.name', value: { stringValue: 'web_search' } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: [span],
        }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(1);
    expect(mockToolInsert).toHaveBeenCalledTimes(1);
    expect(mockToolInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'test-tenant',
        tool_name: 'web_search',
      }),
    );
  });

  it('computes cost from model pricing when available', async () => {
    mockPricingGetByModel.mockReturnValue({
      input_price_per_token: 0.001,
      output_price_per_token: 0.002,
    });

    const span = makeSpan({
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-4-6' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
      }],
    };

    await service.ingest(request, testCtx);

    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    // cost = 100 * 0.001 + 50 * 0.002 = 0.2
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cost_usd: expect.closeTo(0.2, 4),
      }),
    );
  });

  it('handles error status on spans', async () => {
    const span = makeSpan({
      status: { code: 2, message: 'something went wrong' },
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
      }],
    };

    await service.ingest(request, testCtx);

    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error_message: 'something went wrong',
      }),
    );
  });

  it('handles missing resourceSpans', async () => {
    const result = await service.ingest({ resourceSpans: undefined as never }, testCtx);
    expect(result.accepted).toBe(0);
  });
});
