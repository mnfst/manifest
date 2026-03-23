import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TraceIngestService } from './trace-ingest.service';
import { AgentMessage } from '../../entities/agent-message.entity';
import { LlmCall } from '../../entities/llm-call.entity';
import { ToolExecution } from '../../entities/tool-execution.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { UserProvider } from '../../entities/user-provider.entity';
import { IngestionContext } from '../interfaces/ingestion-context.interface';

const testCtx: IngestionContext = {
  tenantId: 'test-tenant',
  agentId: 'test-agent',
  agentName: 'test-agent',
  userId: 'test-user',
};

describe('TraceIngestService', () => {
  let service: TraceIngestService;
  let mockTurnInsert: jest.Mock;
  let mockTurnFindOne: jest.Mock;
  let mockTurnFind: jest.Mock;
  let mockLlmInsert: jest.Mock;
  let mockToolInsert: jest.Mock;
  let mockPricingGetByModel: jest.Mock;
  let mockProviderFind: jest.Mock;
  let mockExecute: jest.Mock;
  let mockTurnManager: {
    transaction: jest.Mock;
    getRepository: jest.Mock;
    query: jest.Mock;
    connection: { options: { type: string } };
  };

  beforeEach(async () => {
    mockTurnInsert = jest.fn().mockResolvedValue({});
    mockTurnFindOne = jest.fn().mockResolvedValue(null);
    mockTurnFind = jest.fn().mockResolvedValue([]);
    mockLlmInsert = jest.fn().mockResolvedValue({});
    mockToolInsert = jest.fn().mockResolvedValue({});
    mockPricingGetByModel = jest.fn().mockReturnValue(undefined);
    mockProviderFind = jest.fn().mockResolvedValue([]);
    mockExecute = jest.fn().mockResolvedValue({});

    const mockQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: mockExecute,
    };
    const mockTurnRepo = {
      insert: mockTurnInsert,
      findOne: mockTurnFindOne,
      find: mockTurnFind,
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      manager: undefined as unknown as { transaction: jest.Mock },
    };
    const mockLlmRepo = { insert: mockLlmInsert };
    const mockToolRepo = { insert: mockToolInsert };
    mockTurnManager = {
      transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) =>
        cb(mockTurnManager),
      ),
      getRepository: jest.fn((repoClass: unknown) => {
        if (repoClass === AgentMessage) return mockTurnRepo;
        if (repoClass === LlmCall) return mockLlmRepo;
        if (repoClass === ToolExecution) return mockToolRepo;
        throw new Error(`Unexpected repository request: ${String(repoClass)}`);
      }),
      query: jest.fn().mockResolvedValue([]),
      connection: { options: { type: 'sqlite' } },
    };
    mockTurnRepo.manager = { transaction: mockTurnManager.transaction };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TraceIngestService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: mockTurnRepo,
        },
        { provide: getRepositoryToken(LlmCall), useValue: mockLlmRepo },
        { provide: getRepositoryToken(ToolExecution), useValue: mockToolRepo },
        { provide: getRepositoryToken(UserProvider), useValue: { find: mockProviderFind } },
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

  it('ingests an agent_message span (openclaw.agent.turn name)', async () => {
    const request = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'agent' } },
              { key: 'agent.name', value: { stringValue: 'bot-1' } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [makeSpan({ name: 'openclaw.agent.turn' })],
            },
          ],
        },
      ],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(1);
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        tenant_id: 'test-tenant',
        agent_id: 'test-agent',
        user_id: 'test-user',
        agent_name: 'bot-1',
      }),
    ]);
  });

  it('acquires a postgres row lock before OTLP success dedup reads', async () => {
    mockTurnManager.connection.options.type = 'postgres';
    const request = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'agent' } },
              { key: 'agent.name', value: { stringValue: 'bot-1' } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [makeSpan({ name: 'openclaw.agent.turn' })],
            },
          ],
        },
      ],
    };

    await service.ingest(request, testCtx);

    expect(mockTurnManager.query).toHaveBeenCalledWith(
      'SELECT id FROM agents WHERE id = $1 FOR UPDATE',
      ['test-agent'],
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [makeSpan(), span],
            },
          ],
        },
      ],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(2);
    expect(mockLlmInsert).toHaveBeenCalledTimes(1);
    expect(mockLlmInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        tenant_id: 'test-tenant',
        gen_ai_system: 'anthropic',
        request_model: 'claude-opus-4-6',
        input_tokens: 100,
        output_tokens: 50,
      }),
    ]);
  });

  it('ingests a tool_execution span (has tool.name attribute)', async () => {
    const span = makeSpan({
      spanId: 'span-tool',
      parentSpanId: 'span-llm',
      attributes: [{ key: 'tool.name', value: { stringValue: 'web_search' } }],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [span],
            },
          ],
        },
      ],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(1);
    expect(mockToolInsert).toHaveBeenCalledTimes(1);
    expect(mockToolInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        tenant_id: 'test-tenant',
        tool_name: 'web_search',
      }),
    ]);
  });

  it('computes cost from model pricing when available', async () => {
    mockPricingGetByModel.mockReturnValue({
      input_price_per_token: 0.001,
      output_price_per_token: 0.002,
    });

    const span = makeSpan({
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-4-6' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);

    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    // cost = 100 * 0.001 + 50 * 0.002 = 0.2
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        cost_usd: expect.closeTo(0.2, 4),
      }),
    ]);
  });

  it('handles error status on spans', async () => {
    const span = makeSpan({
      name: 'openclaw.agent.turn',
      status: { code: 2, message: 'something went wrong' },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);

    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        status: 'error',
        error_message: 'something went wrong',
      }),
    ]);
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);

    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        routing_tier: 'simple',
        routing_reason: 'heartbeat',
      }),
    ]);
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [parentSpan, llmSpan] }],
        },
      ],
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [parentSpan, llmSpan] }],
        },
      ],
    };

    // Access the mockQb through the repo to verify setParameter calls
    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    // Verify setParameter was called with 'reason'
    expect(mockQb.setParameter).toHaveBeenCalledWith('reason', 'scored');
  });

  it('sets cost to zero in rollup when model provider is subscription-only', async () => {
    mockProviderFind.mockResolvedValue([{ provider: 'anthropic', auth_type: 'subscription' }]);
    mockPricingGetByModel.mockReturnValue({
      provider: 'anthropic',
      input_price_per_token: 0.003,
      output_price_per_token: 0.015,
    });

    const parentSpan = makeSpan({
      spanId: 'span-msg-sub',
      name: 'openclaw.agent.turn',
      attributes: [],
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-sub',
      parentSpanId: 'span-msg-sub',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'anthropic' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-sonnet-4-20250514' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 200 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 100 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [parentSpan, llmSpan] }],
        },
      ],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    // Verify the rollup set cost_usd to 0 (subscription-only provider)
    expect(mockQb.setParameter).toHaveBeenCalledWith('cost', 0);
  });

  it('does not treat unsupported subscription providers as zero-cost', async () => {
    mockProviderFind.mockResolvedValue([{ provider: 'deepseek', auth_type: 'subscription' }]);
    mockPricingGetByModel.mockReturnValue({
      provider: 'deepseek',
      input_price_per_token: 0.003,
      output_price_per_token: 0.015,
    });

    const parentSpan = makeSpan({
      spanId: 'span-msg-openai-sub',
      name: 'openclaw.agent.turn',
      attributes: [],
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-openai-sub',
      parentSpanId: 'span-msg-openai-sub',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'deepseek' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'deepseek-chat' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 200 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 100 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [parentSpan, llmSpan] }],
        },
      ],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    expect(mockQb.setParameter).toHaveBeenCalledWith('cost', 2.1);
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(1);
    expect(mockTurnInsert).not.toHaveBeenCalled();
    expect(mockLlmInsert).not.toHaveBeenCalled();
    expect(mockToolInsert).not.toHaveBeenCalled();
  });

  it('skips unknown/unrecognized spans as root_request', async () => {
    const span = makeSpan({
      spanId: 'span-unknown',
      name: 'http.client.request',
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    expect(mockLlmInsert).not.toHaveBeenCalled();
    expect(mockToolInsert).not.toHaveBeenCalled();
  });

  it('handles missing scopeSpans gracefully', async () => {
    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: undefined as never,
        },
      ],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(0);
  });

  it('handles missing spans array within scopeSpans gracefully', async () => {
    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: undefined as never,
            },
          ],
        },
      ],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(0);
  });

  it('sets error_message to null when status code is not 2', async () => {
    const span = makeSpan({
      name: 'openclaw.agent.turn',
      status: { code: 1, message: 'should be ignored' },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        status: 'ok',
        error_message: null,
      }),
    ]);
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [rootSpan, llmSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockLlmInsert).toHaveBeenCalledWith([expect.objectContaining({ turn_id: null })]);
  });

  it('sets null llmCallId when tool parent is not an llm_call', async () => {
    const parentSpan = makeSpan({
      spanId: 'span-parent',
      name: 'openclaw.agent.turn',
    });

    const toolSpan = makeSpan({
      spanId: 'span-tool',
      parentSpanId: 'span-parent',
      attributes: [{ key: 'tool.name', value: { stringValue: 'bash' } }],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [parentSpan, toolSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockToolInsert).toHaveBeenCalledWith([expect.objectContaining({ llm_call_id: null })]);
  });

  it('uses tool.name from resource attributes for tool_execution classification', async () => {
    const request = {
      resourceSpans: [
        {
          resource: {
            attributes: [{ key: 'tool.name', value: { stringValue: 'resource-tool' } }],
          },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [
                makeSpan({
                  spanId: 'span-t',
                  name: 'span-level-name',
                  attributes: [],
                }),
              ],
            },
          ],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockToolInsert).toHaveBeenCalledWith([
      expect.objectContaining({ tool_name: 'resource-tool' }),
    ]);
  });

  it('sets error_message on tool_execution spans with error status', async () => {
    const toolSpan = makeSpan({
      spanId: 'span-tool-err',
      status: { code: 2, message: 'tool failed' },
      attributes: [{ key: 'tool.name', value: { stringValue: 'broken_tool' } }],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [toolSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockToolInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        status: 'error',
        error_message: 'tool failed',
      }),
    ]);
  });

  it('sets null error_message on tool_execution spans with ok status', async () => {
    const toolSpan = makeSpan({
      spanId: 'span-tool-ok',
      status: { code: 0 },
      attributes: [{ key: 'tool.name', value: { stringValue: 'good_tool' } }],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [toolSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockToolInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        status: 'ok',
        error_message: null,
      }),
    ]);
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [rootSpan, llmSpan] }],
        },
      ],
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
      attributes: [{ key: 'gen_ai.system', value: { stringValue: 'openai' } }],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [parentSpan, llmSpan] }],
        },
      ],
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [parentSpan, llmSpan],
            },
          ],
        },
      ],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    expect(mockExecute).toHaveBeenCalled();
    // cost_usd should be 200 * 0.01 + 100 * 0.03 = 5.0
    expect(mockQb.setParameter).toHaveBeenCalledWith('cost', expect.closeTo(5.0, 4));
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [parentSpan, llmSpan],
            },
          ],
        },
      ],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    expect(mockExecute).toHaveBeenCalled();
    expect(mockQb.setParameter).toHaveBeenCalledWith('cost', null);
  });

  it('returns null cost when model has no tokens', async () => {
    const span = makeSpan({
      name: 'openclaw.agent.turn',
      attributes: [{ key: 'gen_ai.response.model', value: { stringValue: 'gpt-4o' } }],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith([expect.objectContaining({ cost_usd: null })]);
  });

  it('returns null cost when no model attribute is present', async () => {
    const span = makeSpan({
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith([expect.objectContaining({ cost_usd: null })]);
  });

  it('returns null cost when model exists but pricing is not found', async () => {
    mockPricingGetByModel.mockReturnValue(undefined);

    const span = makeSpan({
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'unknown-model' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith([expect.objectContaining({ cost_usd: null })]);
  });

  it('uses gen_ai.response.model as fallback when gen_ai.request.model is absent', async () => {
    mockPricingGetByModel.mockReturnValue({
      input_price_per_token: 0.001,
      output_price_per_token: 0.002,
    });

    const span = makeSpan({
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.response.model', value: { stringValue: 'claude-3-haiku' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 10 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 5 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockPricingGetByModel).toHaveBeenCalledWith('claude-3-haiku');
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        model: 'claude-3-haiku',
        cost_usd: expect.closeTo(0.02, 4),
      }),
    ]);
  });

  it('returns zero cost when provider is subscription-only', async () => {
    mockProviderFind.mockResolvedValue([{ provider: 'anthropic', auth_type: 'subscription' }]);
    mockPricingGetByModel.mockReturnValue({
      provider: 'anthropic',
      input_price_per_token: 0.001,
      output_price_per_token: 0.002,
    });

    const span = makeSpan({
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-haiku-4.5' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith([expect.objectContaining({ cost_usd: 0 })]);
  });

  it('returns zero cost when pricing provider case differs from user-provider case', async () => {
    // UserProvider stores lowercase 'anthropic', but ModelPricing stores capitalized 'Anthropic'
    mockProviderFind.mockResolvedValue([{ provider: 'anthropic', auth_type: 'subscription' }]);
    mockPricingGetByModel.mockReturnValue({
      provider: 'Anthropic',
      input_price_per_token: 0.001,
      output_price_per_token: 0.002,
    });

    const span = makeSpan({
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-haiku-4.5' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({ cost_usd: 0, auth_type: 'subscription' }),
    ]);
  });

  it('returns zero cost when pricing display name differs from provider ID (Z.ai)', async () => {
    // UserProvider stores provider ID 'zai', but pricing cache returns display name 'Z.ai'
    mockProviderFind.mockResolvedValue([{ provider: 'zai', auth_type: 'subscription' }]);
    mockPricingGetByModel.mockReturnValue({
      provider: 'Z.ai',
      input_price_per_token: 0.001,
      output_price_per_token: 0.002,
    });

    const span = makeSpan({
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'glm-5' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({ cost_usd: 0, auth_type: 'subscription' }),
    ]);
  });

  it('treats qualified internal subscription models as subscription traffic', async () => {
    mockProviderFind.mockResolvedValue([{ provider: 'ollama-cloud', auth_type: 'subscription' }]);
    mockPricingGetByModel.mockReturnValue({
      provider: 'Z.ai',
      input_price_per_token: 0.001,
      output_price_per_token: 0.002,
    });

    const span = makeSpan({
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'ollama-cloud/glm-4.7' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 120 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 30 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        model: 'ollama-cloud/glm-4.7',
        cost_usd: 0,
        auth_type: 'subscription',
      }),
    ]);
  });

  it('does not let bare model-prefix inference override explicit pricing provider', async () => {
    mockProviderFind.mockResolvedValue([{ provider: 'anthropic', auth_type: 'subscription' }]);
    mockPricingGetByModel.mockReturnValue({
      provider: 'OpenAI',
      input_price_per_token: 0.001,
      output_price_per_token: 0.002,
    });

    const span = makeSpan({
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-4-6' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 120 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 30 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        model: 'claude-opus-4-6',
        auth_type: 'api_key',
      }),
    ]);
  });

  it('returns zero cost when provider has both subscription and api_key (dual-auth)', async () => {
    mockProviderFind.mockResolvedValue([
      { provider: 'anthropic', auth_type: 'subscription' },
      { provider: 'anthropic', auth_type: 'api_key' },
    ]);
    mockPricingGetByModel.mockReturnValue({
      provider: 'anthropic',
      input_price_per_token: 0.001,
      output_price_per_token: 0.002,
    });

    const span = makeSpan({
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-haiku-4.5' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    // Dual-auth providers treated as subscription (routing prefers subscription) → zero cost
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({ cost_usd: 0, auth_type: 'subscription' }),
    ]);
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [parentSpan, llmSpan],
            },
          ],
        },
      ],
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [parentSpan, llmSpan],
            },
          ],
        },
      ],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    expect(mockQb.setParameter).toHaveBeenCalledWith('cacheRead', 50);
    expect(mockQb.setParameter).toHaveBeenCalledWith('cacheCreation', 25);
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [parentSpan, llmSpan],
            },
          ],
        },
      ],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    // cache tokens should default to 0
    expect(mockQb.setParameter).toHaveBeenCalledWith('cacheRead', 0);
    expect(mockQb.setParameter).toHaveBeenCalledWith('cacheCreation', 0);
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [llmSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockLlmInsert).toHaveBeenCalledTimes(1);
    // No accumulation should happen, so no rollup query
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('uses ctx.agentName when agent.name attribute is absent', async () => {
    const span = makeSpan({ name: 'openclaw.agent.turn' });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({ agent_name: 'test-agent' }),
    ]);
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [parentSpan, llmSpan],
            },
          ],
        },
      ],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    // model is null so cost should be null
    expect(mockQb.setParameter).toHaveBeenCalledWith('cost', null);
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [parentSpan, llmSpan],
            },
          ],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockLlmInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        cache_read_tokens: 30,
        cache_creation_tokens: 20,
      }),
    ]);
  });

  it('sets null error_message when error status has no message field', async () => {
    const span = makeSpan({
      name: 'openclaw.agent.turn',
      status: { code: 2 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        status: 'error',
        error_message: null,
      }),
    ]);
  });

  it('sets llmCallId when tool parent is an llm_call', async () => {
    const parentSpan = makeSpan({
      spanId: 'span-msg-parent',
      name: 'openclaw.agent.turn',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-parent',
      parentSpanId: 'span-msg-parent',
      attributes: [{ key: 'gen_ai.system', value: { stringValue: 'anthropic' } }],
    });

    const toolSpan = makeSpan({
      spanId: 'span-tool-child',
      parentSpanId: 'span-llm-parent',
      attributes: [{ key: 'tool.name', value: { stringValue: 'file_read' } }],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [parentSpan, llmSpan, toolSpan],
            },
          ],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockToolInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        llm_call_id: expect.any(String),
        tool_name: 'file_read',
      }),
    ]);
    // Verify llm_call_id is not null (it should be the uuid of the llm span entry)
    const insertArg = mockToolInsert.mock.calls[0][0][0];
    expect(insertArg.llm_call_id).not.toBeNull();
  });

  it('sets null error_message on tool_execution with error status and no message', async () => {
    const toolSpan = makeSpan({
      spanId: 'span-tool-err-nomsg',
      status: { code: 2 },
      attributes: [{ key: 'tool.name', value: { stringValue: 'bad_tool' } }],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [toolSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockToolInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        status: 'error',
        error_message: null,
      }),
    ]);
  });

  it('skips agent_message insert when proxy error already recorded for same trace_id', async () => {
    mockTurnFindOne.mockResolvedValue({ id: 'existing-error-id' });

    const span = makeSpan({
      traceId: 'trace-with-proxy-error',
      name: 'openclaw.agent.turn',
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          trace_id: 'trace-with-proxy-error',
          tenant_id: 'test-tenant',
        }),
      }),
    );
    expect(mockTurnInsert).not.toHaveBeenCalled();
  });

  it('inserts agent_message when no proxy error exists for trace_id', async () => {
    mockTurnFindOne.mockResolvedValue(null);

    const span = makeSpan({
      traceId: 'trace-no-error',
      name: 'openclaw.agent.turn',
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnFindOne).toHaveBeenCalled();
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
  });

  it('skips trace_id dedup check when trace_id is empty but runs timestamp-based fallback', async () => {
    const span = makeSpan({
      traceId: '',
      name: 'openclaw.agent.turn',
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    // trace_id-based dedup is skipped (empty traceId); remapFallbackSpans calls find() for
    // unfilled fallback, then buildDedupContext runs 3 non-trace queries (recentErrors,
    // recentOkMessages, recentMessages) — trace-based queries resolve to [] without find()
    expect(mockTurnFindOne).not.toHaveBeenCalled();
    expect(mockTurnFind).toHaveBeenCalledTimes(4);
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
  });

  it('deduplicates agent_message when proxy error exists near span timestamp', async () => {
    // findOne (trace_id check) returns null; batch dedup recentErrors returns a nearby error
    mockTurnFindOne.mockResolvedValue(null);
    const nearbyTs = new Date(Number(BigInt('1708000000000000000') / 1_000_000n)).toISOString();
    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([]) // buildDedupContext: errorByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: successByTrace
      .mockResolvedValueOnce([{ id: 'proxy-error-id', timestamp: nearbyTs }]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([]) // buildDedupContext: recentOkMessages
      .mockResolvedValueOnce([]); // buildDedupContext: recentMessages

    const span = makeSpan({
      traceId: 'trace-with-delayed-otlp',
      name: 'openclaw.agent.turn',
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnFindOne).toHaveBeenCalledTimes(1); // pre-pass fallback check only
    expect(mockTurnFind).toHaveBeenCalledTimes(6); // unfilled fallback + 5 buildDedupContext
    expect(mockTurnInsert).not.toHaveBeenCalled();
  });

  it('remaps UUID to pre-inserted fallback success record for token rollup', async () => {
    // Pre-pass findOne: fallback success record found.
    // The agent_message span is then skipped in the main loop (fallbackSkipIds),
    // so buildAgentMessage (and its error dedup findOne) is never called.
    mockTurnFindOne.mockResolvedValueOnce({
      id: 'preinserted-fallback-id',
      model: 'deepseek-chat',
    });

    const parentSpan = makeSpan({
      spanId: 'span-msg-fb',
      traceId: 'trace-fallback-remap',
      name: 'openclaw.agent.turn',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-fb',
      parentSpanId: 'span-msg-fb',
      traceId: 'trace-fallback-remap',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: '500' } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: '100' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'gemini-flash' } },
      ],
    });

    mockPricingGetByModel.mockReturnValue({
      input_price_per_token: '0.0001',
      output_price_per_token: '0.0002',
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [parentSpan, llmSpan] }],
        },
      ],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    // One findOne call: the pre-pass fallback check only
    expect(mockTurnFindOne).toHaveBeenCalledTimes(1);
    // Agent message should NOT be inserted (remapped to existing record)
    expect(mockTurnInsert).not.toHaveBeenCalled();
    // LLM call should be inserted via its own repo
    expect(mockLlmInsert).toHaveBeenCalledTimes(1);

    // Rollup should update the pre-inserted record using deepseek-chat pricing
    expect(mockQb.setParameter).toHaveBeenCalledWith('inputTok', 500);
    expect(mockQb.setParameter).toHaveBeenCalledWith('outputTok', 100);
    // Cost computed using deepseek-chat (the override), not gemini-flash (OTLP model)
    expect(mockQb.setParameter).toHaveBeenCalledWith('cost', 500 * 0.0001 + 100 * 0.0002);

    // Fallback remap includes duration_ms COALESCE (line 470)
    const setArg = mockQb.set.mock.calls[0][0];
    expect(typeof setArg.duration_ms).toBe('function');
    expect(setArg.duration_ms()).toBe('COALESCE(duration_ms, :durationMs)');
  });

  it('falls back to unfilled-match when trace_id lookup misses', async () => {
    const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
    const nearbyTs = new Date(spanTime.getTime() + 2000).toISOString();

    // Strategy 1 (trace_id) misses; strategy 2 (unfilled) matches
    mockTurnFindOne.mockResolvedValue(null);
    mockTurnFind.mockResolvedValueOnce([
      { id: 'unfilled-fb-id', model: 'deepseek-chat', timestamp: nearbyTs },
    ]);

    const parentSpan = makeSpan({
      spanId: 'span-msg-unfilled',
      traceId: 'trace-no-match',
      name: 'openclaw.agent.turn',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-unfilled',
      parentSpanId: 'span-msg-unfilled',
      traceId: 'trace-no-match',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: '300' } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: '80' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'gemini-flash' } },
      ],
    });

    mockPricingGetByModel.mockReturnValue({
      input_price_per_token: '0.0001',
      output_price_per_token: '0.0002',
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [parentSpan, llmSpan] }],
        },
      ],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    // Agent message skipped (remapped), LLM call inserted
    expect(mockTurnInsert).not.toHaveBeenCalled();
    expect(mockLlmInsert).toHaveBeenCalledTimes(1);

    // Rollup updates the unfilled record with tokens + cost
    expect(mockQb.setParameter).toHaveBeenCalledWith('inputTok', 300);
    expect(mockQb.setParameter).toHaveBeenCalledWith('outputTok', 80);
    expect(mockQb.setParameter).toHaveBeenCalledWith('cost', 300 * 0.0001 + 80 * 0.0002);
  });

  it('remaps UUID before LLM call processing (reversed span order)', async () => {
    // Pre-pass findOne: fallback success record found.
    // This test proves the pre-pass fixes the span ordering bug: with the old code,
    // the LLM span would be processed first and accumulateToMessage would use the
    // original UUID. With the pre-pass, the UUID is remapped before any span processing.
    mockTurnFindOne.mockResolvedValueOnce({
      id: 'preinserted-fallback-id',
      model: 'deepseek-chat',
    });

    const parentSpan = makeSpan({
      spanId: 'span-msg-fb',
      traceId: 'trace-fallback-remap',
      name: 'openclaw.agent.turn',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-fb',
      parentSpanId: 'span-msg-fb',
      traceId: 'trace-fallback-remap',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: '500' } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: '100' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'gemini-flash' } },
      ],
    });

    mockPricingGetByModel.mockReturnValue({
      input_price_per_token: '0.0001',
      output_price_per_token: '0.0002',
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          // LLM span FIRST, parent span SECOND — reversed order
          scopeSpans: [{ scope: { name: 'test' }, spans: [llmSpan, parentSpan] }],
        },
      ],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    // Agent message should NOT be inserted (remapped to existing record)
    expect(mockTurnInsert).not.toHaveBeenCalled();
    // LLM call should be inserted via its own repo
    expect(mockLlmInsert).toHaveBeenCalledTimes(1);

    // Rollup should update the pre-inserted record using deepseek-chat pricing
    expect(mockQb.setParameter).toHaveBeenCalledWith('inputTok', 500);
    expect(mockQb.setParameter).toHaveBeenCalledWith('outputTok', 100);
    // Cost computed using deepseek-chat (the override), not gemini-flash (OTLP model)
    expect(mockQb.setParameter).toHaveBeenCalledWith('cost', 500 * 0.0001 + 100 * 0.0002);
  });

  it('invokes COALESCE expressions for model, routing_tier, and routing_reason in rollup', async () => {
    mockPricingGetByModel.mockReturnValue(undefined);

    const parentSpan = makeSpan({
      spanId: 'span-msg-coalesce',
      name: 'openclaw.agent.turn',
    });

    const llmSpan = makeSpan({
      spanId: 'span-llm-coalesce',
      parentSpanId: 'span-msg-coalesce',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'openai' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 10 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 5 } },
        { key: 'manifest.routing.tier', value: { stringValue: 'complex' } },
        { key: 'manifest.routing.reason', value: { stringValue: 'fallback' } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [parentSpan, llmSpan],
            },
          ],
        },
      ],
    };

    const repoInstance = (service as any).turnRepo;
    const mockQb = repoInstance.createQueryBuilder();

    await service.ingest(request, testCtx);

    // Extract the set() call arguments and invoke the function values to cover lines 208-210
    const setArg = mockQb.set.mock.calls[0][0];
    expect(typeof setArg.model).toBe('function');
    expect(setArg.model()).toBe('COALESCE(model, :model)');
    expect(typeof setArg.routing_tier).toBe('function');
    expect(setArg.routing_tier()).toBe('COALESCE(routing_tier, :tier)');
    expect(typeof setArg.routing_reason).toBe('function');
    expect(setArg.routing_reason()).toBe('COALESCE(routing_reason, :reason)');

    // Cover CASE WHEN expressions for token/cost conditional update (lines 457-463)
    expect(typeof setArg.input_tokens).toBe('function');
    expect(setArg.input_tokens()).toBe(
      'CASE WHEN input_tokens = 0 THEN :inputTok ELSE input_tokens END',
    );
    expect(typeof setArg.output_tokens).toBe('function');
    expect(setArg.output_tokens()).toBe(
      'CASE WHEN input_tokens = 0 THEN :outputTok ELSE output_tokens END',
    );
    expect(typeof setArg.cache_read_tokens).toBe('function');
    expect(setArg.cache_read_tokens()).toBe(
      'CASE WHEN input_tokens = 0 THEN :cacheRead ELSE cache_read_tokens END',
    );
    expect(typeof setArg.cache_creation_tokens).toBe('function');
    expect(setArg.cache_creation_tokens()).toBe(
      'CASE WHEN input_tokens = 0 THEN :cacheCreation ELSE cache_creation_tokens END',
    );
    expect(typeof setArg.cost_usd).toBe('function');
    expect(setArg.cost_usd()).toBe('CASE WHEN input_tokens = 0 THEN :cost ELSE cost_usd END');
  });

  it('skips ghost span when data sibling exists in same batch', async () => {
    const dataSpan = makeSpan({
      spanId: 'span-data',
      traceId: 'trace-data',
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-4-6' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 500 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 200 } },
      ],
    });

    const ghostSpan = makeSpan({
      spanId: 'span-ghost',
      traceId: 'trace-ghost',
      name: 'openclaw.agent.turn',
      attributes: [],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [dataSpan, ghostSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({ trace_id: 'trace-data' }),
    ]);
  });

  it('skips ghost span regardless of ordering (ghost first, data second)', async () => {
    const ghostSpan = makeSpan({
      spanId: 'span-ghost-first',
      traceId: 'trace-ghost-first',
      name: 'openclaw.agent.turn',
      attributes: [],
      status: { code: 1 },
    });

    const dataSpan = makeSpan({
      spanId: 'span-data-second',
      traceId: 'trace-data-second',
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [ghostSpan, dataSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({ trace_id: 'trace-data-second' }),
    ]);
  });

  it('does NOT skip empty ok span when no data sibling exists in batch', async () => {
    const emptySpan = makeSpan({
      spanId: 'span-empty-alone',
      name: 'openclaw.agent.turn',
      attributes: [],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [emptySpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
  });

  it('does NOT skip empty error span even with data sibling', async () => {
    const dataSpan = makeSpan({
      spanId: 'span-data-err',
      traceId: 'trace-data-err',
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const errorSpan = makeSpan({
      spanId: 'span-error',
      traceId: 'trace-error',
      name: 'openclaw.agent.turn',
      attributes: [],
      status: { code: 2, message: 'failed' },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [dataSpan, errorSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    // Both should be inserted (error span is not ghost-filtered)
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ trace_id: 'trace-data-err' }),
        expect.objectContaining({ trace_id: 'trace-error' }),
      ]),
    );
  });

  it('skips ghost via DB fallback when data message already exists in DB', async () => {
    const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
    const nearbyTs = new Date(spanTime.getTime() + 5000).toISOString();

    // Batch dedup context: errorByTrace=[], recentErrors=[], recentOkMessages=[], recentMessages=[data]
    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([]) // buildDedupContext: errorByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: successByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([]) // buildDedupContext: recentOkMessages
      .mockResolvedValueOnce([
        {
          id: 'existing-data',
          timestamp: nearbyTs,
          input_tokens: 500,
          output_tokens: 200,
          model: 'gpt-4o',
        },
      ]); // buildDedupContext: recentMessages

    const ghostSpan = makeSpan({
      spanId: 'span-cross-ghost',
      name: 'openclaw.agent.turn',
      attributes: [],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [ghostSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).not.toHaveBeenCalled();
  });

  it('treats span with only gen_ai.response.model as non-empty (not ghost)', async () => {
    const responseModelSpan = makeSpan({
      spanId: 'span-resp-model',
      traceId: 'trace-resp-model',
      name: 'openclaw.agent.turn',
      attributes: [{ key: 'gen_ai.response.model', value: { stringValue: 'gpt-4o' } }],
      status: { code: 1 },
    });

    const ghostSpan = makeSpan({
      spanId: 'span-ghost-resp',
      traceId: 'trace-ghost-resp',
      name: 'openclaw.agent.turn',
      attributes: [],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [responseModelSpan, ghostSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    // responseModelSpan is not empty (has model), ghostSpan is filtered as ghost
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    expect(mockTurnInsert).toHaveBeenCalledWith([
      expect.objectContaining({ trace_id: 'trace-resp-model' }),
    ]);
  });

  it('skips ghost via DB fallback when nearby message has model but 0 tokens', async () => {
    const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
    const nearbyTs = new Date(spanTime.getTime() + 5000).toISOString();

    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([]) // buildDedupContext: errorByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: successByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([]) // buildDedupContext: recentOkMessages
      .mockResolvedValueOnce([
        {
          id: 'model-only',
          timestamp: nearbyTs,
          input_tokens: 0,
          output_tokens: 0,
          model: 'gpt-4o',
        },
      ]); // recentMessages — has model but 0 tokens

    const ghostSpan = makeSpan({
      spanId: 'span-ghost-model-only',
      name: 'openclaw.agent.turn',
      attributes: [],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [ghostSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnFind).toHaveBeenCalledTimes(6);
    expect(mockTurnInsert).not.toHaveBeenCalled();
  });

  it('scopes DB ghost fallback by session_key when available', async () => {
    const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
    const nearbyTs = new Date(spanTime.getTime() + 5000).toISOString();

    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([]) // buildDedupContext: errorByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: successByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([]) // buildDedupContext: recentOkMessages
      .mockResolvedValueOnce([
        {
          id: 'session-data',
          timestamp: nearbyTs,
          input_tokens: 100,
          output_tokens: 50,
          model: 'gpt-4o',
          session_key: 'session-abc',
        },
      ]); // buildDedupContext: recentMessages — matching session_key

    const ghostSpan = makeSpan({
      spanId: 'span-session-ghost',
      name: 'openclaw.agent.turn',
      attributes: [{ key: 'session.key', value: { stringValue: 'session-abc' } }],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [ghostSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    // session_key filtering now happens in-memory (buildAgentMessage filters recentMessages by session_key)
    expect(mockTurnFind).toHaveBeenCalledTimes(6);
    expect(mockTurnInsert).not.toHaveBeenCalled();
  });

  it('does NOT ghost-filter span with tokens but no model (not empty)', async () => {
    const tokensNoModelSpan = makeSpan({
      spanId: 'span-tokens-nomodel',
      traceId: 'trace-tokens-nomodel',
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
      status: { code: 1 },
    });

    const dataSpan = makeSpan({
      spanId: 'span-data-alongside',
      traceId: 'trace-data-alongside',
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 200 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 100 } },
      ],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [tokensNoModelSpan, dataSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    // Both should be inserted — span with tokens is not empty, not ghost-filtered
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ trace_id: 'trace-tokens-nomodel' }),
        expect.objectContaining({ trace_id: 'trace-data-alongside' }),
      ]),
    );
  });

  it('inserts empty ok span via DB fallback when no nearby data message exists', async () => {
    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([]) // buildDedupContext: errorByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: successByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([]) // buildDedupContext: recentOkMessages
      .mockResolvedValueOnce([]); // buildDedupContext: recentMessages (no nearby data)

    const emptySpan = makeSpan({
      spanId: 'span-db-pass',
      name: 'openclaw.agent.turn',
      attributes: [],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [emptySpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnFind).toHaveBeenCalledTimes(6);
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
  });

  it('returns null from buildAgentMessage when existing error turn matches trace_id (dedup)', async () => {
    // Pre-pass remap: findOne (fallback_from_model: Not(IsNull())) → null (no fallback record)
    // buildDedupContext: batch errorByTrace find returns a match for trace_id
    mockTurnFindOne.mockResolvedValueOnce(null); // remapFallbackSpans — no fallback match

    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([{ id: 'existing-error-turn', trace_id: 'trace-error-dedup' }]) // buildDedupContext: errorByTrace — match!
      .mockResolvedValueOnce([]) // buildDedupContext: successByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([]) // buildDedupContext: recentOkMessages
      .mockResolvedValueOnce([]); // buildDedupContext: recentMessages

    const span = makeSpan({
      traceId: 'trace-error-dedup',
      name: 'openclaw.agent.turn',
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);

    // findOne only called once (remap pre-pass). errorByTrace now uses batch find.
    expect(mockTurnFindOne).toHaveBeenCalledTimes(1);
    expect(mockTurnFind).toHaveBeenCalledTimes(6);
    expect(mockTurnInsert).not.toHaveBeenCalled();
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
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              scope: { name: 'test' },
              spans: [parentSpan, llmSpan],
            },
          ],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockLlmInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
      }),
    ]);
  });

  it('skips OTLP span when proxy already recorded message with tokens (proxy dedup)', async () => {
    const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
    const nearbyTs = new Date(spanTime.getTime() + 2000).toISOString();

    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([]) // buildDedupContext: errorByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: successByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([{ id: 'proxy-msg', timestamp: nearbyTs, input_tokens: 500 }]) // buildDedupContext: recentOkMessages — proxy recorded a message with real tokens
      .mockResolvedValueOnce([]); // buildDedupContext: recentMessages

    const span = makeSpan({
      spanId: 'span-proxy-dedup',
      name: 'openclaw.agent.turn',
      attributes: [{ key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o' } }],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).not.toHaveBeenCalled();
  });

  it('skips OTLP span with tokens when proxy already recorded same request (trace_id dedup)', async () => {
    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([]) // buildDedupContext: errorByTrace
      .mockResolvedValueOnce([{ id: 'proxy-ok', trace_id: 'trace-abc' }]) // buildDedupContext: successByTrace — proxy already recorded this trace
      .mockResolvedValueOnce([]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([]) // buildDedupContext: recentOkMessages
      .mockResolvedValueOnce([]); // buildDedupContext: recentMessages

    const span = makeSpan({
      spanId: 'span-with-tokens-proxy-dedup',
      traceId: 'trace-abc',
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    // Proxy already recorded a success message for this trace_id — skip duplicate
    expect(mockTurnInsert).not.toHaveBeenCalled();
  });

  it('ignores proxy messages with null input_tokens during dedup check', async () => {
    const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
    const nearbyTs = new Date(spanTime.getTime() + 2000).toISOString();

    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([]) // buildDedupContext: errorByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: successByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([{ id: 'null-tokens-msg', timestamp: nearbyTs, input_tokens: null }]) // buildDedupContext: recentOkMessages — null tokens treated as 0
      .mockResolvedValueOnce([]); // buildDedupContext: recentMessages

    const span = makeSpan({
      spanId: 'span-null-tokens',
      name: 'openclaw.agent.turn',
      attributes: [{ key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o' } }],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    // null input_tokens treated as 0, so proxy dedup does NOT suppress this span
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
  });

  it('allows OTLP span when no proxy message exists nearby', async () => {
    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([]) // buildDedupContext: errorByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: successByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([]) // buildDedupContext: recentOkMessages — no proxy data
      .mockResolvedValueOnce([]); // buildDedupContext: recentMessages

    const span = makeSpan({
      spanId: 'span-no-proxy',
      name: 'openclaw.agent.turn',
      attributes: [{ key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o' } }],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
  });

  it('skips OTLP agent_message when proxy already recorded OK message with tokens', async () => {
    const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
    const nearbyTs = new Date(spanTime.getTime() + 2000).toISOString();

    mockTurnFindOne.mockResolvedValue(null);
    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([]) // buildDedupContext: errorByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: successByTrace
      .mockResolvedValueOnce([]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([{ id: 'proxy-msg-id', timestamp: nearbyTs, input_tokens: 500 }]) // buildDedupContext: recentOkMessages — proxy message with real tokens
      .mockResolvedValueOnce([]); // buildDedupContext: recentMessages

    // Parent span has NO token attributes (0 tokens triggers proxy dedup check)
    const parentSpan = makeSpan({
      spanId: 'span-otlp-msg',
      traceId: 'trace-proxy-dedup',
      name: 'openclaw.agent.turn',
    });

    const llmSpan = makeSpan({
      spanId: 'span-otlp-llm',
      traceId: 'trace-proxy-dedup',
      parentSpanId: 'span-otlp-msg',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'anthropic' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-haiku-4.5' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 100 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 50 } },
      ],
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [parentSpan, llmSpan] }],
        },
      ],
    };

    await service.ingest(request, testCtx);

    // Agent message should NOT be inserted (skipped by proxy dedup — 0 tokens + nearby OK message)
    expect(mockTurnInsert).not.toHaveBeenCalled();

    // LLM call should still be inserted
    expect(mockLlmInsert).toHaveBeenCalledTimes(1);
  });

  it('skips OTLP span when proxy recorded same model+tokens without trace_id (model dedup)', async () => {
    const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
    const nearbyTs = new Date(spanTime.getTime() + 3000).toISOString();

    // Empty traceId → trace-based queries (errorByTrace, successByTrace) resolve
    // to Promise.resolve([]) without calling find(), so only 4 find() calls total
    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([]) // buildDedupContext: recentOkMessages
      .mockResolvedValueOnce([
        {
          id: 'proxy-msg',
          timestamp: nearbyTs,
          input_tokens: 7300,
          output_tokens: 114,
          model: 'gpt-5.1-codex-mini',
          session_key: null,
        },
      ]); // buildDedupContext: recentMessages — proxy recorded same model+tokens

    const span = makeSpan({
      spanId: 'span-model-dedup',
      traceId: '', // no trace_id (gateway doesn't send traceparent)
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'gpt-5.1-codex-mini' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 7300 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 114 } },
      ],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    // Proxy already recorded a message with same model and input tokens within 30s
    expect(mockTurnInsert).not.toHaveBeenCalled();
  });

  it('allows OTLP span when model matches but tokens differ (not a duplicate)', async () => {
    const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
    const nearbyTs = new Date(spanTime.getTime() + 3000).toISOString();

    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([]) // buildDedupContext: recentOkMessages
      .mockResolvedValueOnce([
        {
          id: 'different-msg',
          timestamp: nearbyTs,
          input_tokens: 500,
          output_tokens: 20,
          model: 'gpt-5.1-codex-mini',
          session_key: null,
        },
      ]); // recentMessages — different token count

    const span = makeSpan({
      spanId: 'span-different-tokens',
      traceId: '',
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'gpt-5.1-codex-mini' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 7300 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 114 } },
      ],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    // Different token counts — not a duplicate, should be inserted
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
  });

  it('allows OTLP span when model matches but time window exceeds 30s', async () => {
    const spanTime = new Date(Number(BigInt('1708000000000000000') / 1_000_000n));
    const farTs = new Date(spanTime.getTime() + 60000).toISOString();

    mockTurnFind
      .mockResolvedValueOnce([]) // remapFallbackSpans: unfilled fallback
      .mockResolvedValueOnce([]) // buildDedupContext: recentErrors
      .mockResolvedValueOnce([]) // buildDedupContext: recentOkMessages
      .mockResolvedValueOnce([
        {
          id: 'old-msg',
          timestamp: farTs,
          input_tokens: 7300,
          output_tokens: 114,
          model: 'gpt-5.1-codex-mini',
          session_key: null,
        },
      ]); // recentMessages — same model+tokens but >30s apart

    const span = makeSpan({
      spanId: 'span-far-time',
      traceId: '',
      name: 'openclaw.agent.turn',
      attributes: [
        { key: 'gen_ai.request.model', value: { stringValue: 'gpt-5.1-codex-mini' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 7300 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 114 } },
      ],
      status: { code: 1 },
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);
    // Time window >30s — not considered a duplicate
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
  });

  it('does not skip OTLP message when no proxy message exists for trace_id', async () => {
    // No proxy message exists
    mockTurnFindOne.mockResolvedValue(null);

    const span = makeSpan({
      spanId: 'span-no-proxy',
      traceId: 'trace-no-proxy',
      name: 'openclaw.agent.turn',
    });

    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [{ scope: { name: 'test' }, spans: [span] }],
        },
      ],
    };

    await service.ingest(request, testCtx);

    // Agent message should be inserted normally
    expect(mockTurnInsert).toHaveBeenCalledWith([expect.objectContaining({ status: 'ok' })]);
    // buildDedupContext always runs all 5 batch queries upfront, plus 1 for unfilled fallback
    expect(mockTurnFind).toHaveBeenCalledTimes(6);
  });
});
