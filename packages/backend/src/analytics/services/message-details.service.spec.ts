import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { MessageDetailsService } from './message-details.service';
import { AgentMessage } from '../../entities/agent-message.entity';
import { LlmCall } from '../../entities/llm-call.entity';
import { ToolExecution } from '../../entities/tool-execution.entity';
import { AgentLog } from '../../entities/agent-log.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

function mockQb(result: unknown = null) {
  const qb: Record<string, jest.Mock> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
    getMany: jest.fn().mockResolvedValue(result ?? []),
  };
  return qb;
}

describe('MessageDetailsService', () => {
  let service: MessageDetailsService;
  let mockTenantResolve: jest.Mock;
  let msgQb: ReturnType<typeof mockQb>;
  let llmQb: ReturnType<typeof mockQb>;
  let toolQb: ReturnType<typeof mockQb>;
  let logQb: ReturnType<typeof mockQb>;

  const baseMessage = {
    id: 'msg-1',
    tenant_id: 't1',
    agent_id: 'a1',
    trace_id: 'trace-abc',
    timestamp: '2026-02-16 10:00:00',
    agent_name: 'my-agent',
    model: 'gpt-4o',
    status: 'ok',
    error_message: null,
    error_http_status: null,
    description: 'test desc',
    service_type: 'agent',
    input_tokens: 100,
    output_tokens: 50,
    cache_read_tokens: 10,
    cache_creation_tokens: 5,
    cost_usd: 0.05,
    duration_ms: 1200,
    routing_tier: 'standard',
    routing_reason: null,
    auth_type: 'api_key',
    skill_name: null,
    fallback_from_model: null,
    fallback_index: null,
    session_key: 'sess-001',
    user_id: 'u1',
    feedback_rating: null,
    feedback_tags: null,
    feedback_details: null,
    request_headers: null,
    caller_attribution: null,
  };

  beforeEach(async () => {
    mockTenantResolve = jest.fn().mockResolvedValue('tenant-123');
    msgQb = mockQb(baseMessage);
    llmQb = mockQb([]);
    toolQb = mockQb([]);
    logQb = mockQb([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageDetailsService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(msgQb) },
        },
        {
          provide: getRepositoryToken(LlmCall),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(llmQb) },
        },
        {
          provide: getRepositoryToken(ToolExecution),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(toolQb) },
        },
        {
          provide: getRepositoryToken(AgentLog),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(logQb) },
        },
        {
          provide: TenantCacheService,
          useValue: { resolve: mockTenantResolve },
        },
      ],
    }).compile();

    service = module.get<MessageDetailsService>(MessageDetailsService);
  });

  it('returns message details with empty related data', async () => {
    const result = await service.getDetails('msg-1', 'u1');

    expect(result.message.id).toBe('msg-1');
    expect(result.message.model).toBe('gpt-4o');
    expect(result.message.status).toBe('ok');
    expect(result.llm_calls).toEqual([]);
    expect(result.tool_executions).toEqual([]);
    expect(result.agent_logs).toEqual([]);
  });

  it('throws NotFoundException when message not found', async () => {
    msgQb.getOne.mockResolvedValue(null);
    await expect(service.getDetails('not-found', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('filters by tenantId when tenant exists', async () => {
    await service.getDetails('msg-1', 'u1');
    expect(msgQb.andWhere).toHaveBeenCalledWith('m.tenant_id = :tenantId', {
      tenantId: 'tenant-123',
    });
  });

  it('filters by userId when tenant does not exist', async () => {
    mockTenantResolve.mockResolvedValue(null);
    await service.getDetails('msg-1', 'u1');
    expect(msgQb.andWhere).toHaveBeenCalledWith('m.user_id = :userId', { userId: 'u1' });
  });

  it('returns related llm calls', async () => {
    const llmCall = {
      id: 'lc-1',
      call_index: 0,
      request_model: 'gpt-4o',
      response_model: 'gpt-4o',
      gen_ai_system: 'openai',
      input_tokens: 100,
      output_tokens: 50,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      duration_ms: 800,
      ttft_ms: 120,
      temperature: 0.7,
      max_output_tokens: 4096,
      timestamp: '2026-02-16 10:00:00',
    };
    llmQb.getMany.mockResolvedValue([llmCall]);

    const result = await service.getDetails('msg-1', 'u1');

    expect(result.llm_calls).toHaveLength(1);
    expect(result.llm_calls[0].request_model).toBe('gpt-4o');
    expect(result.llm_calls[0].ttft_ms).toBe(120);
  });

  it('returns related tool executions', async () => {
    const llmCall = { id: 'lc-1', call_index: 0 };
    llmQb.getMany.mockResolvedValue([llmCall]);

    const tool = {
      id: 'te-1',
      llm_call_id: 'lc-1',
      tool_name: 'Read',
      duration_ms: 50,
      status: 'ok',
      error_message: null,
    };
    toolQb.getMany.mockResolvedValue([tool]);

    const result = await service.getDetails('msg-1', 'u1');

    expect(result.tool_executions).toHaveLength(1);
    expect(result.tool_executions[0].tool_name).toBe('Read');
    expect(result.tool_executions[0].status).toBe('ok');
  });

  it('does not query tool_executions when no llm calls', async () => {
    llmQb.getMany.mockResolvedValue([]);

    const result = await service.getDetails('msg-1', 'u1');

    expect(result.tool_executions).toEqual([]);
    expect(toolQb.where).not.toHaveBeenCalled();
  });

  it('returns related agent logs', async () => {
    const log = {
      id: 'al-1',
      severity: 'info',
      body: 'Agent started',
      timestamp: '2026-02-16 10:00:00',
      span_id: 'span-1',
    };
    logQb.getMany.mockResolvedValue([log]);

    const result = await service.getDetails('msg-1', 'u1');

    expect(result.agent_logs).toHaveLength(1);
    expect(result.agent_logs[0].body).toBe('Agent started');
    expect(result.agent_logs[0].severity).toBe('info');
  });

  it('does not query agent logs when trace_id is null', async () => {
    const msgNoTrace = { ...baseMessage, trace_id: null };
    msgQb.getOne.mockResolvedValue(msgNoTrace);

    const result = await service.getDetails('msg-1', 'u1');

    expect(result.agent_logs).toEqual([]);
    expect(logQb.where).not.toHaveBeenCalled();
  });

  it('maps all message fields correctly', async () => {
    const result = await service.getDetails('msg-1', 'u1');

    expect(result.message).toEqual({
      id: 'msg-1',
      timestamp: '2026-02-16 10:00:00',
      agent_name: 'my-agent',
      model: 'gpt-4o',
      status: 'ok',
      error_message: null,
      error_http_status: null,
      description: 'test desc',
      service_type: 'agent',
      input_tokens: 100,
      output_tokens: 50,
      cache_read_tokens: 10,
      cache_creation_tokens: 5,
      cost_usd: 0.05,
      duration_ms: 1200,
      trace_id: 'trace-abc',
      routing_tier: 'standard',
      routing_reason: null,
      auth_type: 'api_key',
      skill_name: null,
      fallback_from_model: null,
      fallback_index: null,
      session_key: 'sess-001',
      feedback_rating: null,
      feedback_tags: null,
      feedback_details: null,
      request_headers: null,
      caller_attribution: null,
    });
  });

  it('returns caller_attribution when stored on the message', async () => {
    const attribution = { sdk: 'openai-js', appName: 'OpenClaw', appUrl: 'https://openclaw.dev' };
    msgQb.getOne.mockResolvedValue({ ...baseMessage, caller_attribution: attribution });
    const result = await service.getDetails('msg-1', 'u1');
    expect(result.message.caller_attribution).toEqual(attribution);
  });

  it('returns request_headers when stored on the message', async () => {
    const headers = { 'user-agent': 'curl/8.14.1', 'x-custom-foo': 'bar' };
    msgQb.getOne.mockResolvedValue({ ...baseMessage, request_headers: headers });
    const result = await service.getDetails('msg-1', 'u1');
    expect(result.message.request_headers).toEqual(headers);
  });

  it('splits feedback_tags into an array when present', async () => {
    const msgWithFeedback = {
      ...baseMessage,
      feedback_rating: 'dislike',
      feedback_tags: 'Too slow,Buggy',
      feedback_details: 'Response was slow',
    };
    msgQb.getOne.mockResolvedValue(msgWithFeedback);

    const result = await service.getDetails('msg-1', 'u1');

    expect(result.message.feedback_rating).toBe('dislike');
    expect(result.message.feedback_tags).toEqual(['Too slow', 'Buggy']);
    expect(result.message.feedback_details).toBe('Response was slow');
  });

  it('returns error message details for failed messages', async () => {
    const errorMsg = {
      ...baseMessage,
      status: 'error',
      error_message: '401 Unauthorized: invalid API key',
      error_http_status: 401,
    };
    msgQb.getOne.mockResolvedValue(errorMsg);

    const result = await service.getDetails('msg-1', 'u1');

    expect(result.message.status).toBe('error');
    expect(result.message.error_message).toBe('401 Unauthorized: invalid API key');
    expect(result.message.error_http_status).toBe(401);
  });
});
