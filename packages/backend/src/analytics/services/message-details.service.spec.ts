import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { MessageDetailsService } from './message-details.service';
import { AgentMessage } from '../../entities/agent-message.entity';

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
  let msgQb: ReturnType<typeof mockQb>;

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
    provider_key_label: null,
    skill_name: null,
    fallback_from_model: null,
    fallback_index: null,
    session_key: 'sess-001',
    feedback_rating: null,
    feedback_tags: null,
    feedback_details: null,
    request_headers: null,
    request_params: null,
    caller_attribution: null,
    header_tier_id: null,
    header_tier_name: null,
    header_tier_color: null,
    specificity_category: null,
    specificity_miscategorized: false,
  };

  beforeEach(async () => {
    msgQb = mockQb(baseMessage);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageDetailsService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(msgQb) },
        },
      ],
    }).compile();

    service = module.get<MessageDetailsService>(MessageDetailsService);
  });

  it('returns the message row', async () => {
    const result = await service.getDetails('msg-1', 'u1');

    expect(result.message.id).toBe('msg-1');
    expect(result.message.model).toBe('gpt-4o');
    expect(result.message.status).toBe('ok');
  });

  it('throws NotFoundException when message not found', async () => {
    msgQb.getOne.mockResolvedValue(null);
    await expect(service.getDetails('not-found', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('filters by tenantId when tenant exists', async () => {
    await service.getDetails('msg-1', 'tenant-123');
    expect(msgQb.andWhere).toHaveBeenCalledWith('m.tenant_id = :tenantId', {
      tenantId: 'tenant-123',
    });
  });

  it('throws NotFoundException when tenant is null (no tenant scope)', async () => {
    await expect(service.getDetails('msg-1', null)).rejects.toThrow(NotFoundException);
    expect(msgQb.andWhere).not.toHaveBeenCalled();
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
      specificity_category: null,
      specificity_miscategorized: false,
      auth_type: 'api_key',
      provider_key_label: null,
      skill_name: null,
      fallback_from_model: null,
      fallback_index: null,
      session_key: 'sess-001',
      feedback_rating: null,
      feedback_tags: null,
      feedback_details: null,
      request_headers: null,
      request_params: null,
      caller_attribution: null,
      header_tier_id: null,
      header_tier_name: null,
      header_tier_color: null,
    });
  });

  it('does not return recording, llm_calls, tool_executions, or agent_logs', async () => {
    const result = (await service.getDetails('msg-1', 'u1')) as unknown as Record<string, unknown>;

    expect(Object.keys(result)).toEqual(['message']);
    expect(result['recording']).toBeUndefined();
    expect(result['llm_calls']).toBeUndefined();
    expect(result['tool_executions']).toBeUndefined();
    expect(result['agent_logs']).toBeUndefined();
    expect((result['message'] as Record<string, unknown>)['recorded']).toBeUndefined();
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

  it('returns request_params when stored on the message', async () => {
    const params = { thinking: { type: 'disabled' } };
    msgQb.getOne.mockResolvedValue({ ...baseMessage, request_params: params });
    const result = await service.getDetails('msg-1', 'u1');
    expect(result.message.request_params).toEqual(params);
  });

  it('round-trips arbitrary multi-key request_params shapes (forward-compat)', async () => {
    const future = {
      thinking: { type: 'enabled' },
      reasoning_effort: 'high',
      custom_safety: { mode: 'permissive', threshold: 0.8 },
    };
    msgQb.getOne.mockResolvedValue({ ...baseMessage, request_params: future });
    const result = await service.getDetails('msg-1', 'u1');
    expect(result.message.request_params).toEqual(future);
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
