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
    error_origin: null,
    error_class: null,
    superseded: false,
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
    autofix_applied: false,
    autofix_group_id: null,
    autofix_role: null,
    autofix_operations: null,
    autofix_decision: null,
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
      autofix_status: null,
      error_message: null,
      error_http_status: null,
      error_origin: null,
      error_class: null,
      superseded: false,
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
      autofix_applied: false,
      autofix_role: null,
      autofix_operations: null,
      autofix_decision: null,
      autofix_sibling: null,
    });
  });

  it('maps autofix_decision ids when the message carries them', async () => {
    // The "maps all fields" test above covers the null case; here the stored
    // row has a non-null autofix_decision, exercising the `?? null` mapping's
    // non-null branch.
    const phoenix = { status: 'patched', issueId: 'i', patchId: 'p', healAttemptId: 'h' };
    msgQb.getOne.mockResolvedValue({ ...baseMessage, autofix_decision: phoenix });
    const result = await service.getDetails('msg-1', 'u1');
    expect(result.message.autofix_decision).toEqual(phoenix);
  });

  it('resolves the autofix sibling when the message has a group id', async () => {
    msgQb.getOne
      .mockResolvedValueOnce({
        ...baseMessage,
        id: 'msg-1',
        autofix_group_id: 'grp-9',
        autofix_role: 'original',
      })
      .mockResolvedValueOnce({ id: 'msg-retry', autofix_role: 'retry', status: 'ok' });
    const result = await service.getDetails('msg-1', 'u1');
    expect(result.message.autofix_sibling).toEqual({
      id: 'msg-retry',
      role: 'retry',
      status: 'ok',
    });
  });

  it('returns a null sibling when no paired row exists', async () => {
    msgQb.getOne
      .mockResolvedValueOnce({ ...baseMessage, id: 'msg-1', autofix_group_id: 'grp-9' })
      .mockResolvedValueOnce(null);
    const result = await service.getDetails('msg-1', 'u1');
    expect(result.message.autofix_sibling).toBeNull();
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
      error_origin: 'provider',
      error_class: 'auth',
      superseded: false,
    };
    msgQb.getOne.mockResolvedValue(errorMsg);

    const result = await service.getDetails('msg-1', 'u1');

    expect(result.message.status).toBe('error');
    expect(result.message.error_message).toBe('401 Unauthorized: invalid API key');
    expect(result.message.error_http_status).toBe(401);
    expect(result.message.error_origin).toBe('provider');
    expect(result.message.error_class).toBe('auth');
    expect(result.message.superseded).toBe(false);
  });

  it('surfaces the origin/class/superseded axes for a Manifest config error', async () => {
    msgQb.getOne.mockResolvedValue({
      ...baseMessage,
      status: 'error',
      error_message: 'Provider API key missing',
      routing_reason: 'no_provider_key',
      error_origin: 'config',
      error_class: 'no_provider_key',
      superseded: false,
    });

    const result = await service.getDetails('msg-1', 'u1');

    expect(result.message.error_origin).toBe('config');
    expect(result.message.error_class).toBe('no_provider_key');
    expect(result.message.superseded).toBe(false);
  });

  it('rolls up all provider attempts into a request detail', async () => {
    const requestRow = {
      id: 'request-1',
      tenant_id: 't1',
      timestamp: '2026-07-14T10:00:00Z',
      agent_name: 'my-agent',
      requested_model: 'requested-model',
      status: 'ok',
      autofix_status: 'retry_failed',
      error_message: null,
      error_code: null,
      error_http_status: null,
      error_origin: null,
      error_class: null,
      duration_ms: 900,
      trace_id: 'trace-request',
      session_key: 'session-request',
      feedback_rating: 'like',
      feedback_tags: 'Accurate,Fast',
      feedback_details: 'good',
      request_headers: { 'x-test': 'yes' },
      request_params: { temperature: 0.2 },
      caller_attribution: { sdk: 'openai-js' },
    };
    const attempts = [
      {
        ...baseMessage,
        id: 'attempt-1',
        status: 'error',
        provider: 'openai',
        input_tokens: 10,
        output_tokens: 5,
        cache_read_tokens: 1,
        cache_creation_tokens: 2,
        cost_usd: null,
        duration_ms: null,
      },
      {
        ...baseMessage,
        id: 'attempt-2',
        status: 'ok',
        provider: 'anthropic',
        model: 'claude',
        input_tokens: 20,
        output_tokens: 8,
        cache_read_tokens: 3,
        cache_creation_tokens: 4,
        cost_usd: 0.12,
        duration_ms: 400,
        autofix_applied: true,
        autofix_role: 'retry',
        fallback_from_model: 'gpt-4o',
        fallback_index: 0,
        request_headers: { 'user-agent': 'test-agent' },
        request_params: { temperature: 0.2 },
      },
    ];
    const requestAware = new MessageDetailsService(
      { find: jest.fn().mockResolvedValue(attempts) } as never,
      { findOne: jest.fn().mockResolvedValue(requestRow) } as never,
    );

    const result = await requestAware.getDetails('request-1', 't1');

    expect(result.message).toEqual(
      expect.objectContaining({
        id: 'request-1',
        model: 'claude',
        input_tokens: 30,
        output_tokens: 13,
        cache_read_tokens: 4,
        cache_creation_tokens: 6,
        cost_usd: 0.12,
        duration_ms: 400,
        trace_id: 'trace-request',
        session_key: 'session-request',
        feedback_tags: ['Accurate', 'Fast'],
        autofix_applied: true,
        autofix_status: 'retry_failed',
      }),
    );
    expect(result.message.attempts).toEqual([
      expect.objectContaining({ id: 'attempt-1', provider: 'openai' }),
      expect.objectContaining({ id: 'attempt-2', provider: 'anthropic' }),
    ]);
    // The drawer tells each attempt's full story — the projection must carry
    // the error, fallback, autofix, token and headers/params surface.
    expect(result.message.attempts![0]).toEqual(
      expect.objectContaining({
        status: 'error',
        input_tokens: 10,
        output_tokens: 5,
        error_message: null,
      }),
    );
    expect(result.message.attempts![1]).toEqual(
      expect.objectContaining({
        autofix_applied: true,
        autofix_role: 'retry',
        fallback_from_model: 'gpt-4o',
        fallback_index: 0,
        input_tokens: 20,
        output_tokens: 8,
        request_headers: { 'user-agent': 'test-agent' },
        request_params: { temperature: 0.2 },
      }),
    );
  });

  it('returns a zero-attempt request with request-level fallbacks', async () => {
    const requestAware = new MessageDetailsService(
      { find: jest.fn().mockResolvedValue([]) } as never,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 'request-zero',
          tenant_id: 't1',
          timestamp: '2026-07-14T10:00:00Z',
          agent_name: null,
          requested_model: 'gpt-4o',
          status: 'error',
          autofix_status: null,
          error_message: 'No provider',
          error_code: 'MNFST001',
          error_http_status: 400,
          error_origin: 'config',
          error_class: 'no_provider',
          duration_ms: 15,
          trace_id: null,
          session_key: null,
          feedback_rating: null,
          feedback_tags: null,
          feedback_details: null,
          request_headers: null,
          request_params: null,
          caller_attribution: null,
        }),
      } as never,
    );

    const result = await requestAware.getDetails('request-zero', 't1');

    expect(result.message).toEqual(
      expect.objectContaining({
        id: 'request-zero',
        model: 'gpt-4o',
        status: 'error',
        error_code: 'MNFST001',
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        duration_ms: 15,
        attempts: [],
      }),
    );
  });
});
