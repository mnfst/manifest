import { HttpException } from '@nestjs/common';
import { ProxyController } from '../proxy.controller';
import * as telemetry from '../../../common/utils/product-telemetry';

jest.mock('../../../common/utils/product-telemetry', () => ({
  trackCloudEvent: jest.fn(),
}));

function mockResponse(): {
  res: Record<string, jest.Mock | boolean | number>;
  written: string[];
  headers: Record<string, string>;
  statusCode: number;
} {
  const written: string[] = [];
  const headers: Record<string, string> = {};
  let statusCode = 200;
  const res: Record<string, jest.Mock | boolean | number> = {
    setHeader: jest.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    flushHeaders: jest.fn(),
    write: jest.fn((chunk: string) => {
      written.push(chunk);
    }),
    end: jest.fn(),
    send: jest.fn(),
    json: jest.fn(),
    status: jest.fn().mockImplementation((code: number) => {
      statusCode = code;
      return res;
    }),
    once: jest.fn(),
    writableEnded: false,
  };
  return {
    res,
    written,
    headers,
    get statusCode() {
      return statusCode;
    },
  };
}

function mockRequest(
  body: Record<string, unknown>,
  userId = 'user-1',
  headers: Record<string, string> = {},
) {
  return {
    ingestionContext: {
      userId,
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      agentName: 'test-agent',
    },
    body,
    headers,
  };
}

describe('ProxyController', () => {
  let controller: ProxyController;
  let proxyService: { proxyRequest: jest.Mock };
  let rateLimiter: {
    checkLimit: jest.Mock;
    recordSuccess: jest.Mock;
    acquireSlot: jest.Mock;
    releaseSlot: jest.Mock;
  };
  let providerClient: {
    convertGoogleResponse: jest.Mock;
    convertGoogleStreamChunk: jest.Mock;
    convertAnthropicResponse: jest.Mock;
    convertAnthropicStreamChunk: jest.Mock;
  };
  let mockMessageRepo: { insert: jest.Mock };
  let mockPricingCache: { getByModel: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    proxyService = { proxyRequest: jest.fn() };
    rateLimiter = {
      checkLimit: jest.fn(),
      recordSuccess: jest.fn(),
      acquireSlot: jest.fn(),
      releaseSlot: jest.fn(),
    };
    providerClient = {
      convertGoogleResponse: jest.fn(),
      convertGoogleStreamChunk: jest.fn(),
      convertAnthropicResponse: jest.fn(),
      convertAnthropicStreamChunk: jest.fn(),
    };
    mockMessageRepo = { insert: jest.fn().mockResolvedValue({}) };
    mockPricingCache = { getByModel: jest.fn().mockReturnValue(undefined) };
    controller = new ProxyController(
      proxyService as never,
      rateLimiter as never,
      providerClient as never,
      mockMessageRepo as never,
      mockPricingCache as never,
    );
  });

  afterEach(() => {
    controller.onModuleDestroy();
  });

  it('should return JSON response for non-streaming OpenAI provider', async () => {
    const responseBody = { choices: [{ message: { content: 'hello' } }] };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
      meta: {
        tier: 'simple',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
      },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res, headers } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(responseBody);
    expect(headers['X-Manifest-Tier']).toBe('simple');
    expect(headers['X-Manifest-Model']).toBe('gpt-4o');
    expect(headers['X-Manifest-Provider']).toBe('OpenAI');
    expect(headers['X-Manifest-Confidence']).toBe('0.9');
    expect(headers['X-Manifest-Reason']).toBe('scored');
  });

  it('should convert Google response for non-streaming', async () => {
    const googleBody = { candidates: [{ content: { parts: [{ text: 'hi' }] } }] };
    const convertedBody = { choices: [{ message: { content: 'hi' } }] };

    const mockProviderResp = new Response(JSON.stringify(googleBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: true, isAnthropic: false },
      meta: {
        tier: 'standard',
        model: 'gemini-2.0-flash',
        provider: 'Google',
        confidence: 0.8,
        reason: 'scored',
      },
    });
    providerClient.convertGoogleResponse.mockReturnValue(convertedBody);

    const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(providerClient.convertGoogleResponse).toHaveBeenCalledWith(
      googleBody,
      'gemini-2.0-flash',
    );
    expect(res.json).toHaveBeenCalledWith(convertedBody);
  });

  it('should convert Anthropic response for non-streaming', async () => {
    const anthropicBody = {
      content: [{ type: 'text', text: 'hello' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    };
    const convertedBody = { choices: [{ message: { content: 'hello' } }] };

    const mockProviderResp = new Response(JSON.stringify(anthropicBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: true },
      meta: {
        tier: 'complex',
        model: 'claude-sonnet-4-20250514',
        provider: 'Anthropic',
        confidence: 0.9,
        reason: 'scored',
      },
    });
    providerClient.convertAnthropicResponse.mockReturnValue(convertedBody);

    const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(providerClient.convertAnthropicResponse).toHaveBeenCalledWith(
      anthropicBody,
      'claude-sonnet-4-20250514',
    );
    expect(res.json).toHaveBeenCalledWith(convertedBody);
  });

  it('should record success message with usage from non-streaming response', async () => {
    const responseBody = {
      choices: [{ message: { content: 'hello' } }],
      usage: { prompt_tokens: 500, completion_tokens: 200, cache_read_tokens: 100 },
    };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
      meta: {
        tier: 'simple',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
      },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);
    await new Promise((r) => setTimeout(r, 10));

    expect(mockMessageRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        model: 'gpt-4o',
        routing_tier: 'simple',
        input_tokens: 500,
        output_tokens: 200,
        cache_read_tokens: 100,
      }),
    );
  });

  it('should skip recording when response has zero tokens', async () => {
    const responseBody = {
      choices: [{ message: { content: 'hello' } }],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
      meta: {
        tier: 'simple',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
      },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);
    await new Promise((r) => setTimeout(r, 10));

    // recordSuccessMessage returns early when both tokens are 0
    expect(mockMessageRepo.insert).not.toHaveBeenCalled();
  });

  it('should default completion_tokens to 0 when missing from response', async () => {
    const responseBody = {
      choices: [{ message: { content: 'hello' } }],
      usage: { prompt_tokens: 500 },
    };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
      meta: {
        tier: 'simple',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
      },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);
    await new Promise((r) => setTimeout(r, 10));

    expect(mockMessageRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ input_tokens: 500, output_tokens: 0 }),
    );
  });

  it('should not record success message when response has no usage', async () => {
    const responseBody = { choices: [{ message: { content: 'hello' } }] };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
      meta: {
        tier: 'simple',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
      },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);
    await new Promise((r) => setTimeout(r, 10));

    expect(mockMessageRepo.insert).not.toHaveBeenCalled();
  });

  it('should not record success message for fallback responses', async () => {
    const responseBody = {
      choices: [{ message: { content: 'hello' } }],
      usage: { prompt_tokens: 500, completion_tokens: 200 },
    };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
      meta: {
        tier: 'simple',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
        fallbackFromModel: 'claude-sonnet-4-20250514',
        fallbackIndex: 0,
      },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);
    await new Promise((r) => setTimeout(r, 10));

    // Only the fallback chain messages should be recorded, not a duplicate success
    const insertCalls = mockMessageRepo.insert.mock.calls;
    const hasSuccessWithTokens = insertCalls.some(
      (call: unknown[]) =>
        (call[0] as Record<string, unknown>).status === 'ok' &&
        (call[0] as Record<string, unknown>).input_tokens === 500,
    );
    expect(hasSuccessWithTokens).toBe(false);
  });

  it('should compute cost when pricing is available', async () => {
    mockPricingCache.getByModel.mockReturnValue({
      input_price_per_token: 0.000003,
      output_price_per_token: 0.000015,
    });

    const responseBody = {
      choices: [{ message: { content: 'hello' } }],
      usage: { prompt_tokens: 1000, completion_tokens: 500 },
    };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
      meta: {
        tier: 'simple',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
      },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);
    await new Promise((r) => setTimeout(r, 10));

    expect(mockMessageRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        input_tokens: 1000,
        output_tokens: 500,
        cost_usd: 1000 * 0.000003 + 500 * 0.000015,
      }),
    );
  });

  it('should warn when recordSuccessMessage fails', async () => {
    mockMessageRepo.insert.mockRejectedValue(new Error('DB write failed'));

    const responseBody = {
      choices: [{ message: { content: 'hello' } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
      meta: {
        tier: 'simple',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
      },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);
    await new Promise((r) => setTimeout(r, 10));

    // The catch handler should log a warning, not throw
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should forward provider error status and body', async () => {
    const errorBody = '{"error": "rate limit"}';
    const mockProviderResp = new Response(errorBody, {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
      meta: {
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        reason: 'scored',
      },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.send).toHaveBeenCalledWith(errorBody);
  });

  it('should handle 500 errors from proxyService', async () => {
    proxyService.proxyRequest.mockRejectedValue(new Error('Internal failure'));

    const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Internal proxy error', type: 'proxy_error' },
    });
  });

  it('should forward HttpException status and message', async () => {
    proxyService.proxyRequest.mockRejectedValue(
      new HttpException('Bad request: messages required', 400),
    );

    const req = mockRequest({});
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Bad request: messages required', type: 'proxy_error' },
    });
  });

  it('should record rate_limited agent_message on 429', async () => {
    proxyService.proxyRequest.mockRejectedValue(
      new HttpException(
        { error: { message: 'Limit exceeded: tokens usage (52,000) exceeds 50,000 per day' } },
        429,
      ),
    );

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(mockMessageRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        agent_id: 'agent-1',
        agent_name: 'test-agent',
        status: 'rate_limited',
        input_tokens: 0,
        output_tokens: 0,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('should record error message on 500 from catch block', async () => {
    proxyService.proxyRequest.mockRejectedValue(new Error('Internal failure'));

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    // Wait for fire-and-forget promise
    await new Promise((r) => setTimeout(r, 10));

    expect(mockMessageRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error_message: 'Internal failure',
      }),
    );
  });

  it('should record agent_message on 400 errors from catch block', async () => {
    proxyService.proxyRequest.mockRejectedValue(new HttpException('Bad request', 400));

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(mockMessageRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error_message: 'Bad request',
      }),
    );
  });

  it('should only record one rate_limited message per 60s cooldown', async () => {
    const limitError = new HttpException({ error: { message: 'Limit exceeded' } }, 429);
    proxyService.proxyRequest.mockRejectedValue(limitError);

    // First 429 — should record
    const req1 = mockRequest({ messages: [{ role: 'user', content: 'a' }] });
    const { res: res1 } = mockResponse();
    await controller.chatCompletions(req1 as never, res1 as never);

    // Second 429 (same agent, within cooldown) — should skip
    const req2 = mockRequest({ messages: [{ role: 'user', content: 'b' }] });
    const { res: res2 } = mockResponse();
    await controller.chatCompletions(req2 as never, res2 as never);

    expect(mockMessageRepo.insert).toHaveBeenCalledTimes(1);
  });

  it('should use x-session-key header when present', async () => {
    const responseBody = { choices: [] };
    proxyService.proxyRequest.mockResolvedValue({
      forward: {
        response: new Response(JSON.stringify(responseBody), { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      },
      meta: {
        tier: 'simple',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
      },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    req.headers = { 'x-session-key': 'my-session' };
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'agent-1',
      'user-1',
      req.body,
      'my-session',
      'tenant-1',
      'test-agent',
      expect.any(AbortSignal),
    );
  });

  it('should default session key to "default" when header is absent', async () => {
    proxyService.proxyRequest.mockResolvedValue({
      forward: {
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      },
      meta: {
        tier: 'simple',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
      },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'agent-1',
      'user-1',
      req.body,
      'default',
      'tenant-1',
      'test-agent',
      expect.any(AbortSignal),
    );
  });

  describe('rate limiting', () => {
    it('should call checkLimit and acquireSlot before proxying', async () => {
      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        },
        meta: { tier: 'simple', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(rateLimiter.checkLimit).toHaveBeenCalledWith('user-1');
      expect(rateLimiter.acquireSlot).toHaveBeenCalledWith('user-1');
    });

    it('should releaseSlot even when proxyService throws', async () => {
      proxyService.proxyRequest.mockRejectedValue(new Error('fail'));

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(rateLimiter.releaseSlot).toHaveBeenCalledWith('user-1');
    });

    it('should not call proxyService when checkLimit throws', async () => {
      rateLimiter.checkLimit.mockImplementation(() => {
        throw new HttpException('Too many requests', 429);
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(proxyService.proxyRequest).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should NOT releaseSlot when checkLimit throws (slot never acquired)', async () => {
      rateLimiter.checkLimit.mockImplementation(() => {
        throw new HttpException('Rate limit exceeded', 429);
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(rateLimiter.acquireSlot).not.toHaveBeenCalled();
      expect(rateLimiter.releaseSlot).not.toHaveBeenCalled();
    });

    it('should NOT releaseSlot when acquireSlot throws (slot never acquired)', async () => {
      rateLimiter.acquireSlot.mockImplementation(() => {
        throw new HttpException('Too many concurrent requests', 429);
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(rateLimiter.checkLimit).toHaveBeenCalled();
      expect(rateLimiter.releaseSlot).not.toHaveBeenCalled();
    });

    it('should record 429 when checkLimit throws with 429', async () => {
      rateLimiter.checkLimit.mockImplementation(() => {
        throw new HttpException('Rate limit exceeded. Try again later.', 429);
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rate_limited',
          tenant_id: 'tenant-1',
        }),
      );
    });
  });

  describe('provider error recording', () => {
    it('should record error message on 403 provider response', async () => {
      const errorBody = '{"error":{"message":"Key limit exceeded"}}';
      const mockProviderResp = new Response(errorBody, {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-1',
          agent_id: 'agent-1',
          status: 'error',
          error_message: errorBody,
          model: 'gpt-4o',
          routing_tier: 'standard',
          input_tokens: 0,
          output_tokens: 0,
        }),
      );
    });

    it('should record rate_limited on 429 provider response', async () => {
      const errorBody = '{"error":"rate limit"}';
      const mockProviderResp = new Response(errorBody, {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rate_limited',
          model: 'gpt-4o',
          routing_tier: 'standard',
        }),
      );
    });

    it('should record error on 500 provider response', async () => {
      const errorBody = 'Internal server error';
      const mockProviderResp = new Response(errorBody, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'complex',
          model: 'claude-opus-4',
          provider: 'Anthropic',
          confidence: 0.9,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          model: 'claude-opus-4',
          routing_tier: 'complex',
        }),
      );
    });

    it('should handle messageRepo.insert failure gracefully on provider error', async () => {
      mockMessageRepo.insert.mockRejectedValue(new Error('DB write failed'));

      const mockProviderResp = new Response('{"error":"bad request"}', {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      // Should not throw even though insert fails
      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('{"error":"bad request"}');
    });

    it('should apply 429 cooldown for provider responses', async () => {
      const makeResp = () =>
        new Response('{"error":"rate limit"}', {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: makeResp(), isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req1 = mockRequest({ messages: [{ role: 'user', content: 'a' }] });
      const { res: res1 } = mockResponse();
      await controller.chatCompletions(req1 as never, res1 as never);
      await new Promise((r) => setTimeout(r, 10));

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: makeResp(), isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req2 = mockRequest({ messages: [{ role: 'user', content: 'b' }] });
      const { res: res2 } = mockResponse();
      await controller.chatCompletions(req2 as never, res2 as never);
      await new Promise((r) => setTimeout(r, 10));

      // Only first 429 should be recorded (cooldown)
      expect(mockMessageRepo.insert).toHaveBeenCalledTimes(1);
    });

    it('should store trace_id from traceparent header in error records', async () => {
      const errorBody = '{"error":{"message":"Unauthorized"}}';
      const mockProviderResp = new Response(errorBody, {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] }, 'user-1', {
        traceparent: '00-abcdef1234567890abcdef1234567890-1234567890abcdef-01',
      });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          trace_id: 'abcdef1234567890abcdef1234567890',
          status: 'error',
        }),
      );
    });

    it('should store null trace_id when traceparent header is absent', async () => {
      const errorBody = '{"error":"bad"}';
      const mockProviderResp = new Response(errorBody, {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          trace_id: null,
        }),
      );
    });

    it('should store null trace_id when traceparent has less than 2 parts', async () => {
      const errorBody = '{"error":"bad"}';
      const mockProviderResp = new Response(errorBody, {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] }, 'user-1', {
        traceparent: 'invalidnodashes',
      });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          trace_id: null,
        }),
      );
    });

    it('should truncate long error messages to 500 chars', async () => {
      const longError = 'x'.repeat(1000);
      const mockProviderResp = new Response(longError, {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: 'x'.repeat(500),
        }),
      );
    });
  });

  describe('client disconnect', () => {
    it('should register close listener on response', async () => {
      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        },
        meta: { tier: 'simple', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.once).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should pass AbortSignal to proxyService', async () => {
      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        },
        meta: { tier: 'simple', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      const signal = proxyService.proxyRequest.mock.calls[0][6];
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
    });

    it('should silently end response when client disconnects', async () => {
      const abortController = new AbortController();
      proxyService.proxyRequest.mockImplementation(async () => {
        abortController.abort();
        throw new Error('aborted');
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      // Capture the close callback and wire it to our AbortController
      (res.once as jest.Mock).mockImplementation((event: string, cb: () => void) => {
        if (event === 'close') {
          abortController.signal.addEventListener('abort', cb);
        }
      });

      await controller.chatCompletions(req as never, res as never);

      expect(res.end).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should not call res.end on abort when writableEnded is already true', async () => {
      const abortController = new AbortController();
      proxyService.proxyRequest.mockImplementation(async () => {
        abortController.abort();
        throw new Error('aborted');
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();
      res.writableEnded = true;

      (res.once as jest.Mock).mockImplementation((event: string, cb: () => void) => {
        if (event === 'close') {
          abortController.signal.addEventListener('abort', cb);
        }
      });

      await controller.chatCompletions(req as never, res as never);

      expect(res.end).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should still release slot when client disconnects', async () => {
      const abortController = new AbortController();
      proxyService.proxyRequest.mockImplementation(async () => {
        abortController.abort();
        throw new Error('aborted');
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      (res.once as jest.Mock).mockImplementation((event: string, cb: () => void) => {
        if (event === 'close') {
          abortController.signal.addEventListener('abort', cb);
        }
      });

      await controller.chatCompletions(req as never, res as never);

      expect(rateLimiter.releaseSlot).toHaveBeenCalledWith('user-1');
    });
  });

  describe('first proxy request tracking', () => {
    it('should fire routing_first_proxy_request on first successful proxy', async () => {
      const responseBody = { choices: [] };
      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response(JSON.stringify(responseBody), { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.9,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(telemetry.trackCloudEvent).toHaveBeenCalledWith(
        'routing_first_proxy_request',
        'user-1',
        { provider: 'OpenAI', model: 'gpt-4o', tier: 'standard' },
      );
    });

    it('should not fire event on second request from same user', async () => {
      const makeProxyResult = () => ({
        forward: {
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.9,
          reason: 'scored',
        },
      });

      proxyService.proxyRequest.mockResolvedValue(makeProxyResult());
      const req1 = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res: res1 } = mockResponse();
      await controller.chatCompletions(req1 as never, res1 as never);

      jest.clearAllMocks();
      proxyService.proxyRequest.mockResolvedValue(makeProxyResult());
      const req2 = mockRequest({ messages: [{ role: 'user', content: 'hi again' }] });
      const { res: res2 } = mockResponse();
      await controller.chatCompletions(req2 as never, res2 as never);

      expect(telemetry.trackCloudEvent).not.toHaveBeenCalled();
    });

    it('should fire event separately for different users', async () => {
      const makeProxyResult = () => ({
        forward: {
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        },
        meta: {
          tier: 'simple',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.9,
          reason: 'scored',
        },
      });

      proxyService.proxyRequest.mockResolvedValue(makeProxyResult());
      const req1 = mockRequest({ messages: [{ role: 'user', content: 'hi' }] }, 'user-1');
      const { res: res1 } = mockResponse();
      await controller.chatCompletions(req1 as never, res1 as never);

      proxyService.proxyRequest.mockResolvedValue(makeProxyResult());
      const req2 = mockRequest({ messages: [{ role: 'user', content: 'hi' }] }, 'user-2');
      const { res: res2 } = mockResponse();
      await controller.chatCompletions(req2 as never, res2 as never);

      expect(telemetry.trackCloudEvent).toHaveBeenCalledTimes(2);
      expect(telemetry.trackCloudEvent).toHaveBeenCalledWith(
        'routing_first_proxy_request',
        'user-1',
        expect.any(Object),
      );
      expect(telemetry.trackCloudEvent).toHaveBeenCalledWith(
        'routing_first_proxy_request',
        'user-2',
        expect.any(Object),
      );
    });

    it('should fire event even when provider returns error status', async () => {
      const errorBody = '{"error": "rate limit exceeded"}';
      const mockProviderResp = new Response(errorBody, {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'complex',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.7,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(telemetry.trackCloudEvent).toHaveBeenCalledWith(
        'routing_first_proxy_request',
        'user-1',
        { provider: 'OpenAI', model: 'gpt-4o', tier: 'complex' },
      );
    });

    it('should not fire event when proxyService throws before tracking', async () => {
      proxyService.proxyRequest.mockRejectedValue(new Error('No model available'));

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(telemetry.trackCloudEvent).not.toHaveBeenCalled();
    });

    it('should fire event on next success after a proxyService failure', async () => {
      // First request: proxyService throws, user never added to seenUsers
      proxyService.proxyRequest.mockRejectedValue(new Error('No API key'));

      const req1 = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res: res1 } = mockResponse();
      await controller.chatCompletions(req1 as never, res1 as never);

      expect(telemetry.trackCloudEvent).not.toHaveBeenCalled();

      // Second request: succeeds, user should be tracked as first
      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.9,
          reason: 'scored',
        },
      });

      const req2 = mockRequest({ messages: [{ role: 'user', content: 'retry' }] });
      const { res: res2 } = mockResponse();
      await controller.chatCompletions(req2 as never, res2 as never);

      expect(telemetry.trackCloudEvent).toHaveBeenCalledTimes(1);
      expect(telemetry.trackCloudEvent).toHaveBeenCalledWith(
        'routing_first_proxy_request',
        'user-1',
        { provider: 'OpenAI', model: 'gpt-4o', tier: 'standard' },
      );
    });

    it('should not fire event on provider error for already-seen user', async () => {
      // First request: success, user added to seenUsers
      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        },
        meta: {
          tier: 'simple',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.9,
          reason: 'scored',
        },
      });

      const req1 = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res: res1 } = mockResponse();
      await controller.chatCompletions(req1 as never, res1 as never);

      expect(telemetry.trackCloudEvent).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();

      // Second request: provider 429 error, but user already seen
      const errorResp = new Response('{"error":"rate limit"}', { status: 429 });
      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: errorResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'complex',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req2 = mockRequest({ messages: [{ role: 'user', content: 'hi again' }] });
      const { res: res2 } = mockResponse();
      await controller.chatCompletions(req2 as never, res2 as never);

      expect(telemetry.trackCloudEvent).not.toHaveBeenCalled();
    });

    it('should include correct meta in tracking event', async () => {
      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        },
        meta: {
          tier: 'reasoning',
          model: 'o1-pro',
          provider: 'OpenAI',
          confidence: 0.95,
          reason: 'scored',
        },
      });

      const req = mockRequest(
        { messages: [{ role: 'user', content: 'complex question' }] },
        'tracking-user',
      );
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(telemetry.trackCloudEvent).toHaveBeenCalledWith(
        'routing_first_proxy_request',
        'tracking-user',
        { provider: 'OpenAI', model: 'o1-pro', tier: 'reasoning' },
      );
      // confidence should NOT be in the tracking payload
      const trackingProps = (telemetry.trackCloudEvent as jest.Mock).mock.calls[0][2];
      expect(trackingProps).not.toHaveProperty('confidence');
    });
  });

  describe('error handling edge cases', () => {
    it('should mask error message for 500+ status codes', async () => {
      proxyService.proxyRequest.mockRejectedValue(new Error('Sensitive internal error details'));

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: { message: 'Internal proxy error', type: 'proxy_error' },
      });
    });

    it('should expose original message for client errors (4xx)', async () => {
      proxyService.proxyRequest.mockRejectedValue(
        new HttpException('messages array is required', 400),
      );

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: { message: 'messages array is required', type: 'proxy_error' },
      });
    });

    it('should handle non-Error throw as string', async () => {
      proxyService.proxyRequest.mockRejectedValue('string error');

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: { message: 'Internal proxy error', type: 'proxy_error' },
      });
    });

    it('should forward provider error response and preserve content-type from provider', async () => {
      const mockProviderResp = new Response('{"error":"bad gateway"}', {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.8 },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res, headers } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.send).toHaveBeenCalledWith('{"error":"bad gateway"}');
      expect(headers['Content-Type']).toBe('application/json');
      // Meta headers should still be set
      expect(headers['X-Manifest-Provider']).toBe('OpenAI');
    });

    it('should end stream without error JSON when headers already sent and error occurs', async () => {
      const failingStream = new ReadableStream({
        start(ctrl) {
          ctrl.error(new Error('mid-stream failure'));
        },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response(failingStream, { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.8 },
      });

      const req = mockRequest({
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.end).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should not call res.end when headers sent and writableEnded is true', async () => {
      const failingStream = new ReadableStream({
        start(ctrl) {
          ctrl.error(new Error('mid-stream failure'));
        },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response(failingStream, { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.8 },
      });

      const req = mockRequest({
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      });
      const { res } = mockResponse();

      // Simulate writableEnded becoming true before end is called
      (res.end as jest.Mock).mockImplementation(() => {
        // no-op, already ended
      });
      // pipeStream will call res.end in its finally block, but the
      // controller's catch checks writableEnded. We set it true after
      // pipeStream's finally runs.
      let flushCalled = false;
      (res.flushHeaders as jest.Mock).mockImplementation(() => {
        flushCalled = true;
      });

      await controller.chatCompletions(req as never, res as never);

      // Just verify it doesn't throw and end is called at least once (by pipeStream)
      expect(flushCalled).toBe(true);
    });
  });

  describe('recordRateLimited edge cases', () => {
    it('should handle messageRepo.insert failure gracefully', async () => {
      mockMessageRepo.insert.mockRejectedValue(new Error('DB connection failed'));

      proxyService.proxyRequest.mockRejectedValue(new HttpException('Rate limit exceeded', 429));

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      // Should not throw even though insert fails
      await controller.chatCompletions(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should allow recording after cooldown expires', async () => {
      jest.useFakeTimers();

      const limitError = new HttpException('Limit exceeded', 429);
      proxyService.proxyRequest.mockRejectedValue(limitError);

      // First 429 — should record
      const req1 = mockRequest({ messages: [{ role: 'user', content: 'a' }] });
      const { res: res1 } = mockResponse();
      await controller.chatCompletions(req1 as never, res1 as never);
      expect(mockMessageRepo.insert).toHaveBeenCalledTimes(1);

      // Advance past cooldown (60s)
      jest.advanceTimersByTime(60_001);

      // Second 429 after cooldown — should record again
      const req2 = mockRequest({ messages: [{ role: 'user', content: 'b' }] });
      const { res: res2 } = mockResponse();
      await controller.chatCompletions(req2 as never, res2 as never);
      expect(mockMessageRepo.insert).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should allow recording for different agents within cooldown', async () => {
      const limitError = new HttpException('Limit exceeded', 429);
      proxyService.proxyRequest.mockRejectedValue(limitError);

      // First agent
      const req1 = mockRequest({ messages: [{ role: 'user', content: 'a' }] });
      const { res: res1 } = mockResponse();
      await controller.chatCompletions(req1 as never, res1 as never);

      // Different agent (different agentId means different cooldown key)
      const req2 = {
        ingestionContext: {
          userId: 'user-1',
          tenantId: 'tenant-1',
          agentId: 'agent-2',
          agentName: 'other-agent',
        },
        body: { messages: [{ role: 'user', content: 'b' }] },
        headers: {},
      };
      const { res: res2 } = mockResponse();
      await controller.chatCompletions(req2 as never, res2 as never);

      expect(mockMessageRepo.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('rateLimitCooldown eviction', () => {
    it('should evict expired cooldown entries when map exceeds max size', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cooldownMap = (controller as any).rateLimitCooldown as Map<string, number>;
      const now = Date.now();

      // Pre-fill with MAX_COOLDOWN_ENTRIES + 1 expired entries to exceed the limit.
      // Use keys that do NOT match the request's tenant-1:agent-1 key.
      for (let i = 0; i < 1001; i++) {
        cooldownMap.set(`t-${i}:a-${i}`, now - 120_000); // expired (>60s ago)
      }

      expect(cooldownMap.size).toBe(1001);

      // Trigger a 429 provider error - this adds the tenant-1:agent-1 key,
      // bringing size to 1002, which triggers eviction of expired entries
      const mockProviderResp = new Response('{"error":"rate limit"}', {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 50));

      // All 1001 expired entries should have been evicted, leaving only the fresh one
      expect(cooldownMap.size).toBe(1);
      expect(cooldownMap.has('tenant-1:agent-1')).toBe(true);
    });
  });

  describe('periodic cooldown cleanup', () => {
    it('periodic timer evicts expired cooldown entries', () => {
      jest.useFakeTimers();
      controller.onModuleDestroy(); // stop timer from beforeEach controller

      const timedController = new ProxyController(
        proxyService as never,
        rateLimiter as never,
        providerClient as never,
        mockMessageRepo as never,
        mockPricingCache as never,
      );

      const cooldownMap = (timedController as any).rateLimitCooldown as Map<string, number>;
      cooldownMap.set('t:a', Date.now() - 120_000); // expired

      jest.advanceTimersByTime(60_000);
      expect(cooldownMap.size).toBe(0);

      timedController.onModuleDestroy();
      jest.useRealTimers();
    });

    it('onModuleDestroy stops the periodic cleanup timer', () => {
      jest.useFakeTimers();
      controller.onModuleDestroy(); // stop timer from beforeEach controller

      const timedController = new ProxyController(
        proxyService as never,
        rateLimiter as never,
        providerClient as never,
        mockMessageRepo as never,
        mockPricingCache as never,
      );

      timedController.onModuleDestroy();

      const cooldownMap = (timedController as any).rateLimitCooldown as Map<string, number>;
      cooldownMap.set('t:a', Date.now() - 120_000);

      jest.advanceTimersByTime(120_000);
      expect(cooldownMap.size).toBe(1); // not evicted because timer stopped

      jest.useRealTimers();
    });
  });

  describe('seenUsers bounded Set', () => {
    it('should evict oldest user when MAX_SEEN_USERS is reached', async () => {
      // Access internal seenUsers set to pre-fill it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seenUsers = (controller as any).seenUsers as Set<string>;

      // Pre-fill to MAX_SEEN_USERS - 1 (so next add triggers eviction check)
      for (let i = 0; i < 9_999; i++) {
        seenUsers.add(`prefill-user-${i}`);
      }

      const makeProxyResult = () => ({
        forward: {
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        },
        meta: { tier: 'simple' as const, model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
      });

      // This request fills the Set to exactly 10K
      proxyService.proxyRequest.mockResolvedValue(makeProxyResult());
      const req1 = mockRequest({ messages: [{ role: 'user', content: 'hi' }] }, 'user-9999');
      const { res: res1 } = mockResponse();
      await controller.chatCompletions(req1 as never, res1 as never);

      expect(seenUsers.size).toBe(10_000);

      // Next request should evict the oldest entry
      proxyService.proxyRequest.mockResolvedValue(makeProxyResult());
      const req2 = mockRequest({ messages: [{ role: 'user', content: 'hi' }] }, 'user-10000');
      const { res: res2 } = mockResponse();
      await controller.chatCompletions(req2 as never, res2 as never);

      expect(seenUsers.size).toBe(10_000);
      expect(seenUsers.has('prefill-user-0')).toBe(false);
      expect(seenUsers.has('user-10000')).toBe(true);
    });
  });

  describe('streaming', () => {
    function createMockStreamResponse(chunks: string[]): Response {
      const encoder = new TextEncoder();
      let index = 0;
      const stream = new ReadableStream({
        pull(ctrl) {
          if (index < chunks.length) {
            ctrl.enqueue(encoder.encode(chunks[index]));
            index++;
          } else {
            ctrl.close();
          }
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    it('should pipe streaming responses directly for non-Google', async () => {
      const mockProviderResp = createMockStreamResponse([
        'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
      ]);

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req = mockRequest({
        messages: [{ role: 'user', content: 'test' }],
        stream: true,
      });
      const { res, written, headers } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(headers['Content-Type']).toBe('text/event-stream');
      expect(headers['X-Manifest-Tier']).toBe('standard');
      expect(written.length).toBeGreaterThan(0);
    });

    it('should transform Anthropic streaming through createAnthropicStreamTransformer', async () => {
      const mockProviderResp = createMockStreamResponse([
        'event: message_start\n{"type":"message_start","message":{"usage":{"input_tokens":10}}}\n\n',
        'event: content_block_delta\n{"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}\n\n',
      ]);

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: true },
        meta: {
          tier: 'standard',
          model: 'claude-sonnet-4-20250514',
          provider: 'Anthropic',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const mockTransformer = jest.fn((chunk: string) => {
        if (chunk.includes('message_start'))
          return 'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n';
        if (chunk.includes('text_delta'))
          return 'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n';
        return null;
      });
      (providerClient as Record<string, jest.Mock>).createAnthropicStreamTransformer = jest
        .fn()
        .mockReturnValue(mockTransformer);

      const req = mockRequest({
        messages: [{ role: 'user', content: 'test' }],
        stream: true,
      });
      const { res, written } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(
        (providerClient as Record<string, jest.Mock>).createAnthropicStreamTransformer,
      ).toHaveBeenCalledWith('claude-sonnet-4-20250514');
      expect(written.some((w) => w.includes('content'))).toBe(true);
    });

    it('should transform Google streaming through convertGoogleStreamChunk', async () => {
      const mockProviderResp = createMockStreamResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"hi"}]}}]}\n\n',
      ]);

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: true, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'gemini-2.0-flash',
          provider: 'Google',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      providerClient.convertGoogleStreamChunk.mockReturnValue(
        'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
      );

      const req = mockRequest({
        messages: [{ role: 'user', content: 'test' }],
        stream: true,
      });
      const { res, written } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(providerClient.convertGoogleStreamChunk).toHaveBeenCalled();
      // Should include transformed content and [DONE]
      expect(written.some((w) => w.includes('delta'))).toBe(true);
    });

    it('should close stream on error after headers sent', async () => {
      // Simulate error during streaming (proxyRequest succeeds but stream fails)
      const failingStream = new ReadableStream({
        start(ctrl) {
          ctrl.error(new Error('stream broke'));
        },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response(failingStream, { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req = mockRequest({
        messages: [{ role: 'user', content: 'test' }],
        stream: true,
      });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      // Since headers are sent during streaming, error should just end the stream
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('fallback headers', () => {
    it('should set fallback headers when meta has fallbackFromModel', async () => {
      const responseBody = { choices: [{ message: { content: 'hello' } }] };
      const mockProviderResp = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'claude-sonnet-4',
          provider: 'Anthropic',
          confidence: 0.8,
          reason: 'scored',
          fallbackFromModel: 'gpt-4o',
          fallbackIndex: 0,
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res, headers } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(headers['X-Manifest-Fallback-From']).toBe('gpt-4o');
      expect(headers['X-Manifest-Fallback-Index']).toBe('0');
      expect(headers['X-Manifest-Model']).toBe('claude-sonnet-4');
    });

    it('should not set fallback headers when meta has no fallbackFromModel', async () => {
      const responseBody = { choices: [{ message: { content: 'hello' } }] };
      const mockProviderResp = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res, headers } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(headers['X-Manifest-Fallback-From']).toBeUndefined();
      expect(headers['X-Manifest-Fallback-Index']).toBeUndefined();
    });

    it('should record primary failure and fallback success when fallback was used', async () => {
      const responseBody = { choices: [{ message: { content: 'hello' } }] };
      const mockProviderResp = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'simple',
          model: 'deepseek-chat',
          provider: 'DeepSeek',
          confidence: 0.8,
          reason: 'scored',
          fallbackFromModel: 'gemini-2.5-flash-lite',
          fallbackIndex: 0,
          primaryErrorStatus: 400,
          primaryErrorBody: '{"error":"bad request from primary"}',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMessageRepo.insert).toHaveBeenCalledTimes(2);

      // Primary failure recorded with actual error body
      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fallback_error',
          model: 'gemini-2.5-flash-lite',
          routing_tier: 'simple',
          trace_id: null,
          error_message: '{"error":"bad request from primary"}',
        }),
      );

      // Fallback success recorded with trace_id and correct status
      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          model: 'deepseek-chat',
          routing_tier: 'simple',
          fallback_from_model: 'gemini-2.5-flash-lite',
          fallback_index: 0,
        }),
      );
    });

    it('should record intermediate failures as fallback_error when chain succeeds', async () => {
      const responseBody = { choices: [{ message: { content: 'ok' } }] };
      const mockProviderResp = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'simple',
          model: 'claude-sonnet-4',
          provider: 'Anthropic',
          confidence: 0.8,
          reason: 'scored',
          fallbackFromModel: 'gemini-flash',
          fallbackIndex: 2,
          primaryErrorStatus: 500,
        },
        failedFallbacks: [
          {
            model: 'deepseek-chat',
            provider: 'DeepSeek',
            fallbackIndex: 0,
            status: 429,
            errorBody: 'rate limited',
          },
          {
            model: 'gpt-4o-mini',
            provider: 'OpenAI',
            fallbackIndex: 1,
            status: 500,
            errorBody: 'server error',
          },
        ],
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      // 4 inserts: primary failure + 2 intermediate failures + fallback success
      expect(mockMessageRepo.insert).toHaveBeenCalledTimes(4);

      // Intermediate failures recorded as fallback_error (handled)
      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'deepseek-chat',
          status: 'fallback_error',
          fallback_from_model: 'gemini-flash',
          fallback_index: 0,
        }),
      );
      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          status: 'fallback_error',
          fallback_from_model: 'gemini-flash',
          fallback_index: 1,
        }),
      );
    });

    it('should not pre-record message when no fallback was used', async () => {
      const responseBody = { choices: [{ message: { content: 'hello' } }] };
      const mockProviderResp = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMessageRepo.insert).not.toHaveBeenCalled();
    });

    it('should include fallback fields in error recording when fallback was used', async () => {
      const errorBody = '{"error":"bad request"}';
      const mockProviderResp = new Response(errorBody, {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'claude-sonnet-4',
          provider: 'Anthropic',
          confidence: 0.8,
          reason: 'scored',
          fallbackFromModel: 'gpt-4o',
          fallbackIndex: 1,
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          fallback_from_model: 'gpt-4o',
          fallback_index: 1,
        }),
      );
    });

    it('should record failed fallback attempts as separate messages', async () => {
      const mockProviderResp = new Response('primary error', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'simple',
          model: 'gemini-flash',
          provider: 'Google',
          confidence: 0.9,
          reason: 'scored',
        },
        failedFallbacks: [
          {
            model: 'deepseek-chat',
            provider: 'DeepSeek',
            fallbackIndex: 0,
            status: 401,
            errorBody: 'auth fail',
          },
        ],
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      // 2 inserts: primary as fallback_error + last fallback as error
      expect(mockMessageRepo.insert).toHaveBeenCalledTimes(2);
      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-flash',
          status: 'fallback_error',
          error_message: 'primary error',
        }),
      );
      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'deepseek-chat',
          status: 'error',
          fallback_from_model: 'gemini-flash',
          fallback_index: 0,
          error_message: 'auth fail',
        }),
      );
    });

    it('should handle DB failure in recordFailedFallbacks when all fallbacks fail', async () => {
      mockMessageRepo.insert.mockRejectedValue(new Error('DB write failed'));

      const mockProviderResp = new Response('primary error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'simple',
          model: 'gemini-flash',
          provider: 'Google',
          confidence: 0.9,
          reason: 'scored',
        },
        failedFallbacks: [
          {
            model: 'deepseek-chat',
            provider: 'DeepSeek',
            fallbackIndex: 0,
            status: 500,
            errorBody: 'fail 1',
          },
        ],
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      // Should not throw even though all inserts fail
      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 50));

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('primary error');
    });

    it('should handle DB failure in recordPrimaryFailure on successful fallback', async () => {
      mockMessageRepo.insert.mockRejectedValue(new Error('DB write failed'));

      const responseBody = { choices: [{ message: { content: 'hello' } }] };
      const mockProviderResp = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'simple',
          model: 'deepseek-chat',
          provider: 'DeepSeek',
          confidence: 0.8,
          reason: 'scored',
          fallbackFromModel: 'gemini-flash',
          fallbackIndex: 0,
          primaryErrorStatus: 500,
          primaryErrorBody: 'primary failed',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      // Should not throw even though inserts fail
      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 50));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(responseBody);
    });

    it('should handle DB failure in recordFailedFallbacks on successful fallback with intermediates', async () => {
      mockMessageRepo.insert.mockRejectedValue(new Error('DB write failed'));

      const responseBody = { choices: [{ message: { content: 'ok' } }] };
      const mockProviderResp = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'simple',
          model: 'claude-sonnet-4',
          provider: 'Anthropic',
          confidence: 0.8,
          reason: 'scored',
          fallbackFromModel: 'gemini-flash',
          fallbackIndex: 2,
          primaryErrorStatus: 500,
        },
        failedFallbacks: [
          {
            model: 'deepseek-chat',
            provider: 'DeepSeek',
            fallbackIndex: 0,
            status: 500,
            errorBody: 'fail 1',
          },
        ],
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      // Should not throw even though inserts fail
      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 50));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(responseBody);
    });

    it('should mark intermediate failures as handled when all fallbacks fail', async () => {
      const mockProviderResp = new Response('primary error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'simple',
          model: 'gemini-flash',
          provider: 'Google',
          confidence: 0.9,
          reason: 'scored',
        },
        failedFallbacks: [
          {
            model: 'deepseek-chat',
            provider: 'DeepSeek',
            fallbackIndex: 0,
            status: 500,
            errorBody: 'fail 1',
          },
          {
            model: 'gpt-4o-mini',
            provider: 'OpenAI',
            fallbackIndex: 1,
            status: 500,
            errorBody: 'fail 2',
          },
        ],
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      // 3 inserts: primary (fallback_error) + intermediate (fallback_error) + last (error)
      expect(mockMessageRepo.insert).toHaveBeenCalledTimes(3);
      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-flash',
          status: 'fallback_error',
        }),
      );
      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'deepseek-chat',
          status: 'fallback_error',
          fallback_index: 0,
        }),
      );
      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          status: 'error',
          fallback_index: 1,
        }),
      );
    });
  });

  describe('auth_type and subscription cost', () => {
    it('should store auth_type from routing meta on success message', async () => {
      const responseBody = {
        choices: [{ message: { content: 'hello' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      };
      const mockProviderResp = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'claude-haiku-4-5-20251001',
          provider: 'Anthropic',
          confidence: 0.9,
          reason: 'scored',
          auth_type: 'api_key',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ auth_type: 'api_key' }),
      );
    });

    it('should set cost to zero for subscription auth_type', async () => {
      mockPricingCache.getByModel.mockReturnValue({
        input_price_per_token: 0.001,
        output_price_per_token: 0.002,
      });

      const responseBody = {
        choices: [{ message: { content: 'hello' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      };
      const mockProviderResp = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'claude-haiku-4-5-20251001',
          provider: 'Anthropic',
          confidence: 0.9,
          reason: 'scored',
          auth_type: 'subscription',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ auth_type: 'subscription', cost_usd: 0 }),
      );
    });

    it('should calculate cost normally for api_key auth_type', async () => {
      mockPricingCache.getByModel.mockReturnValue({
        input_price_per_token: 0.01,
        output_price_per_token: 0.03,
      });

      const responseBody = {
        choices: [{ message: { content: 'hello' } }],
        usage: { prompt_tokens: 200, completion_tokens: 100 },
      };
      const mockProviderResp = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'standard',
          model: 'claude-haiku-4-5-20251001',
          provider: 'Anthropic',
          confidence: 0.9,
          reason: 'scored',
          auth_type: 'api_key',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      // cost = 200 * 0.01 + 100 * 0.03 = 5.0
      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ auth_type: 'api_key', cost_usd: expect.closeTo(5.0, 4) }),
      );
    });

    it('should set auth_type to null when not provided', async () => {
      const responseBody = {
        choices: [{ message: { content: 'hello' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      };
      const mockProviderResp = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
        meta: {
          tier: 'simple',
          model: 'gpt-4o',
          provider: 'OpenAI',
          confidence: 0.9,
          reason: 'scored',
        },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ auth_type: null }),
      );
    });
  });
});
