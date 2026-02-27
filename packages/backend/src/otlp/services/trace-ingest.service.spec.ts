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

  it('persists routing_reason from manifest.routing.reason attribute', async () => {
    const span = makeSpan({
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'manifest.routing.tier', value: { stringValue: 'simple' } },
        { key: 'manifest.routing.reason', value: { stringValue: 'heartbeat' } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
      }],
    };

    await service.ingest(request, testCtx);

    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        routing_tier: 'simple',
        routing_reason: 'heartbeat',
      }),
    );
  });

  it('rolls up routing_reason from llm_call child into parent agent_message', async () => {
    const parentSpan = makeSpan({
      spanId: 'span-parent',
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'manifest.routing.tier', value: { stringValue: 'simple' } },
        { key: 'manifest.routing.reason', value: { stringValue: 'heartbeat' } },
      ],
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm',
      parentSpanId: 'span-parent',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o-mini' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 50 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 10 } },
        { key: 'manifest.routing.tier', value: { stringValue: 'simple' } },
        { key: 'manifest.routing.reason', value: { stringValue: 'heartbeat' } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [parentSpan, llmSpan] }],
      }],
    };

    await service.ingest(request, testCtx);

    // The rollup query should set routing_reason via COALESCE
    expect(mockExecute).toHaveBeenCalled();
  });

  it('passes reason parameter in rollUpMessageAggregates query builder', async () => {
    const parentSpan = makeSpan({
      spanId: 'span-msg',
      name: 'openclaw.agent.turn',
      attributes: [],
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm2',
      parentSpanId: 'span-msg',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o-mini' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 20 } },
        { key: 'manifest.routing.reason', value: { stringValue: 'scored' } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [parentSpan, llmSpan] }],
      }],
    };

    // Access the mockQb through the repo to verify setParameter calls
    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    // Verify setParameter was called with 'reason'
    expect(mockQb.setParameter).toHaveBeenCalledWith('reason', 'scored');
  });

  it('handles missing resourceSpans', async () => {
    const result = await service.ingest({ resourceSpans: undefined as never }, testCtx);
    expect(result.accepted).toBe(0);
  });

  it('skips root_request spans without inserting anything', async () => {
    const span = makeSpan({
      spanId: 'span-root',
      name: 'openclaw.request',
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(1);
    expect(mockTurnInsert).not.toHaveBeenCalled();
    expect(mockLlmInsert).not.toHaveBeenCalled();
    expect(mockToolInsert).not.toHaveBeenCalled();
  });

  it('classifies spans with manifest.* prefix as agent_message', async () => {
    const span = makeSpan({
      name: 'manifest.something.custom',
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    expect(mockLlmInsert).not.toHaveBeenCalled();
    expect(mockToolInsert).not.toHaveBeenCalled();
  });

  it('handles missing scopeSpans gracefully', async () => {
    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: undefined as never,
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(0);
  });

  it('handles missing spans array within scopeSpans gracefully', async () => {
    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: undefined as never,
        }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(0);
  });

  it('sets error_message to null when status code is not 2', async () => {
    const span = makeSpan({
      status: { code: 1, message: 'should be ignored' },
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        error_message: null,
      }),
    );
  });

  it('sets null messageId when llm_call parent is not an agent_message', async () => {
    const rootSpan = makeSpan({
      spanId: 'span-root',
      name: 'openclaw.request',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm',
      parentSpanId: 'span-root',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'anthropic' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-4-6' } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [rootSpan, llmSpan] }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockLlmInsert).toHaveBeenCalledWith(
      expect.objectContaining({ turn_id: null }),
    );
  });

  it('sets null llmCallId when tool parent is not an llm_call', async () => {
    const parentSpan = makeSpan({
      spanId: 'span-parent',
      name: 'openclaw.agent.turn',
    });

    const toolSpan = makeSpan({
      spanId: 'span-tool',
      parentSpanId: 'span-parent',
      attributes: [
        { key: 'tool.name', value: { stringValue: 'bash' } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [parentSpan, toolSpan] }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockToolInsert).toHaveBeenCalledWith(
      expect.objectContaining({ llm_call_id: null }),
    );
  });

  it('uses tool.name from resource attributes for tool_execution classification', async () => {
    const request = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'tool.name', value: { stringValue: 'resource-tool' } },
          ],
        },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: [makeSpan({
            spanId: 'span-t',
            name: 'span-level-name',
            attributes: [],
          })],
        }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockToolInsert).toHaveBeenCalledWith(
      expect.objectContaining({ tool_name: 'resource-tool' }),
    );
  });

  it('sets error_message on tool_execution spans with error status', async () => {
    const toolSpan = makeSpan({
      spanId: 'span-tool-err',
      status: { code: 2, message: 'tool failed' },
      attributes: [
        { key: 'tool.name', value: { stringValue: 'broken_tool' } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [toolSpan] }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockToolInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error_message: 'tool failed',
      }),
    );
  });

  it('sets null error_message on tool_execution spans with ok status', async () => {
    const toolSpan = makeSpan({
      spanId: 'span-tool-ok',
      status: { code: 0 },
      attributes: [
        { key: 'tool.name', value: { stringValue: 'good_tool' } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [toolSpan] }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockToolInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        error_message: null,
      }),
    );
  });

  it('does not accumulate to message when llm_call parent is not agent_message', async () => {
    const rootSpan = makeSpan({
      spanId: 'span-root',
      name: 'openclaw.request',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm',
      parentSpanId: 'span-root',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [rootSpan, llmSpan] }],
      }],
    };

    await service.ingest(request, testCtx);
    // Since the parent is root_request (not agent_message), accumulateToMessage returns early
    // No rollup query should be executed
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('skips rollup when accumulated tokens are both zero', async () => {
    const parentSpan = makeSpan({
      spanId: 'span-msg',
      name: 'openclaw.agent.turn',
    });

    // llm_call with no token attributes (defaults to 0)
    const llmSpan = makeSpan({
      spanId: 'span-llm-no-tokens',
      parentSpanId: 'span-msg',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [parentSpan, llmSpan] }],
      }],
    };

    await service.ingest(request, testCtx);
    // Both input and output tokens are 0, so rollup should be skipped
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('computes cost in rollup when pricing is available', async () => {
    mockPricingGetByModel.mockReturnValue({
      input_price_per_token: 0.01,
      output_price_per_token: 0.03,
    });

    const parentSpan = makeSpan({
      spanId: 'span-msg-cost',
      name: 'openclaw.agent.turn',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-cost',
      parentSpanId: 'span-msg-cost',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'anthropic' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-4-6' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 200 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 100 } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: [parentSpan, llmSpan],
        }],
      }],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    expect(mockExecute).toHaveBeenCalled();
    // cost_usd should be 200 * 0.01 + 100 * 0.03 = 5.0
    expect(mockQb.set).toHaveBeenCalledWith(
      expect.objectContaining({ cost_usd: expect.closeTo(5.0, 4) }),
    );
  });

  it('sets null cost in rollup when no pricing is available', async () => {
    mockPricingGetByModel.mockReturnValue(undefined);

    const parentSpan = makeSpan({
      spanId: 'span-msg-nocost',
      name: 'openclaw.agent.turn',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-nocost',
      parentSpanId: 'span-msg-nocost',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 50 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 25 } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: [parentSpan, llmSpan],
        }],
      }],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    expect(mockExecute).toHaveBeenCalled();
    expect(mockQb.set).toHaveBeenCalledWith(
      expect.objectContaining({ cost_usd: null }),
    );
  });

  it('returns null cost when model has no tokens', async () => {
    const span = makeSpan({
      attributes: [
        { key: 'gen_ai.response.model', value: { stringValue: 'gpt-4o' } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.objectContaining({ cost_usd: null }),
    );
  });

  it('returns null cost when no model attribute is present', async () => {
    const span = makeSpan({
      attributes: [
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
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.objectContaining({ cost_usd: null }),
    );
  });

  it('returns null cost when model exists but pricing is not found', async () => {
    mockPricingGetByModel.mockReturnValue(undefined);

    const span = makeSpan({
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'unknown-model' } },
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
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.objectContaining({ cost_usd: null }),
    );
  });

  it('uses gen_ai.response.model as fallback when gen_ai.request.model is absent', async () => {
    mockPricingGetByModel.mockReturnValue({
      input_price_per_token: 0.001,
      output_price_per_token: 0.002,
    });

    const span = makeSpan({
      attributes: [
        { key: 'gen_ai.response.model', value: { stringValue: 'claude-3-haiku' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 10 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 5 } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockPricingGetByModel).toHaveBeenCalledWith('claude-3-haiku');
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-3-haiku',
        cost_usd: expect.closeTo(0.02, 4),
      }),
    );
  });

  it('uses fallback model from gen_ai.response.model in accumulation', async () => {
    const parentSpan = makeSpan({
      spanId: 'span-msg-resp',
      name: 'openclaw.agent.turn',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-resp',
      parentSpanId: 'span-msg-resp',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.response.model', value: { stringValue: 'gpt-4o-2024' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 30 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 15 } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: [parentSpan, llmSpan],
        }],
      }],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    expect(mockQb.setParameter).toHaveBeenCalledWith('model', 'gpt-4o-2024');
  });

  it('accumulates cache tokens from llm_call children', async () => {
    const parentSpan = makeSpan({
      spanId: 'span-msg-cache',
      name: 'openclaw.agent.turn',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-cache',
      parentSpanId: 'span-msg-cache',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'anthropic' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 200 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.cache_read_input_tokens', value: { intValue: 50 } },
        { key: 'gen_ai.usage.cache_creation_input_tokens', value: { intValue: 25 } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: [parentSpan, llmSpan],
        }],
      }],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    expect(mockQb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        cache_read_tokens: 50,
        cache_creation_tokens: 25,
      }),
    );
  });

  it('defaults token attributes to 0 when absent in accumulation', async () => {
    const parentSpan = makeSpan({
      spanId: 'span-msg-noattrs',
      name: 'openclaw.agent.turn',
    });

    // llm_call with only gen_ai.system but no token attributes
    const llmSpan = makeSpan({
      spanId: 'span-llm-noattrs',
      parentSpanId: 'span-msg-noattrs',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 10 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 5 } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: [parentSpan, llmSpan],
        }],
      }],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    // cache tokens should default to 0
    expect(mockQb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
      }),
    );
  });

  it('does not accumulate when llm_call has no parent in spanMap', async () => {
    const llmSpan = makeSpan({
      spanId: 'span-orphan-llm',
      parentSpanId: 'span-nonexistent',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [llmSpan] }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockLlmInsert).toHaveBeenCalledTimes(1);
    // No accumulation should happen, so no rollup query
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('uses ctx.agentName when agent.name attribute is absent', async () => {
    const span = makeSpan();

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.objectContaining({ agent_name: 'test-agent' }),
    );
  });

  it('sets null cost in rollup when model is null in aggregates', async () => {
    const parentSpan = makeSpan({
      spanId: 'span-msg-nomodel',
      name: 'openclaw.agent.turn',
    });

    // llm_call with tokens but no model attribute
    const llmSpan = makeSpan({
      spanId: 'span-llm-nomodel',
      parentSpanId: 'span-msg-nomodel',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 50 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 25 } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: [parentSpan, llmSpan],
        }],
      }],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    // model is null so cost should be null
    expect(mockQb.set).toHaveBeenCalledWith(
      expect.objectContaining({ cost_usd: null }),
    );
  });

  it('persists llm_call cache tokens from span attributes', async () => {
    const parentSpan = makeSpan({
      spanId: 'span-parent-ct',
      name: 'openclaw.agent.turn',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-ct',
      parentSpanId: 'span-parent-ct',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'anthropic' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-4-6' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
        { key: 'gen_ai.usage.cache_read_input_tokens', value: { intValue: 30 } },
        { key: 'gen_ai.usage.cache_creation_input_tokens', value: { intValue: 20 } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: [parentSpan, llmSpan],
        }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockLlmInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cache_read_tokens: 30,
        cache_creation_tokens: 20,
      }),
    );
  });

  it('sets null error_message when error status has no message field', async () => {
    const span = makeSpan({
      status: { code: 2 },
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error_message: null,
      }),
    );
  });

  it('sets llmCallId when tool parent is an llm_call', async () => {
    const parentSpan = makeSpan({
      spanId: 'span-msg-parent',
      name: 'openclaw.agent.turn',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-parent',
      parentSpanId: 'span-msg-parent',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'anthropic' } },
      ],
    });

    const toolSpan = makeSpan({
      spanId: 'span-tool-child',
      parentSpanId: 'span-llm-parent',
      attributes: [
        { key: 'tool.name', value: { stringValue: 'file_read' } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: [parentSpan, llmSpan, toolSpan],
        }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockToolInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        llm_call_id: expect.any(String),
        tool_name: 'file_read',
      }),
    );
    // Verify llm_call_id is not null (it should be the uuid of the llm span entry)
    const insertArg = mockToolInsert.mock.calls[0][0];
    expect(insertArg.llm_call_id).not.toBeNull();
  });

  it('sets null error_message on tool_execution with error status and no message', async () => {
    const toolSpan = makeSpan({
      spanId: 'span-tool-err-nomsg',
      status: { code: 2 },
      attributes: [
        { key: 'tool.name', value: { stringValue: 'bad_tool' } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{ scope: { name: 'test' }, spans: [toolSpan] }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockToolInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error_message: null,
      }),
    );
  });

  it('defaults llm_call cache tokens to 0 when attributes are absent', async () => {
    const parentSpan = makeSpan({
      spanId: 'span-parent-nct',
      name: 'openclaw.agent.turn',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-nct',
      parentSpanId: 'span-parent-nct',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'anthropic' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-4-6' } },
      ],
    });

    const request = {
      resourceSpans: [{
        resource: { attributes: [] },
        scopeSpans: [{
          scope: { name: 'test' },
          spans: [parentSpan, llmSpan],
        }],
      }],
    };

    await service.ingest(request, testCtx);
    expect(mockLlmInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
      }),
    );
  });
});
