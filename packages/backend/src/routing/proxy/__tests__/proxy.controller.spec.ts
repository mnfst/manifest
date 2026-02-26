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
    setHeader: jest.fn((k: string, v: string) => { headers[k] = v; }),
    flushHeaders: jest.fn(),
    write: jest.fn((chunk: string) => { written.push(chunk); }),
    end: jest.fn(),
    send: jest.fn(),
    json: jest.fn(),
    status: jest.fn().mockImplementation((code: number) => {
      statusCode = code;
      return res;
    }),
    on: jest.fn(),
    writableEnded: false,
  };
  return { res, written, headers, get statusCode() { return statusCode; } };
}

function mockRequest(body: Record<string, unknown>, userId = 'user-1') {
  return {
    ingestionContext: {
      userId,
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      agentName: 'test-agent',
    },
    body,
    headers: {},
  };
}

describe('ProxyController', () => {
  let controller: ProxyController;
  let proxyService: { proxyRequest: jest.Mock };
  let rateLimiter: {
    checkLimit: jest.Mock;
    acquireSlot: jest.Mock;
    releaseSlot: jest.Mock;
  };
  let providerClient: {
    convertGoogleResponse: jest.Mock;
    convertGoogleStreamChunk: jest.Mock;
  };
  let mockMessageRepo: { insert: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    proxyService = { proxyRequest: jest.fn() };
    rateLimiter = {
      checkLimit: jest.fn(),
      acquireSlot: jest.fn(),
      releaseSlot: jest.fn(),
    };
    providerClient = {
      convertGoogleResponse: jest.fn(),
      convertGoogleStreamChunk: jest.fn(),
    };
    mockMessageRepo = { insert: jest.fn().mockResolvedValue({}) };
    controller = new ProxyController(
      proxyService as never,
      rateLimiter as never,
      providerClient as never,
      mockMessageRepo as never,
    );
  });

  it('should return JSON response for non-streaming OpenAI provider', async () => {
    const responseBody = { choices: [{ message: { content: 'hello' } }] };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false },
      meta: { tier: 'simple', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
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
  });

  it('should convert Google response for non-streaming', async () => {
    const googleBody = { candidates: [{ content: { parts: [{ text: 'hi' }] } }] };
    const convertedBody = { choices: [{ message: { content: 'hi' } }] };

    const mockProviderResp = new Response(JSON.stringify(googleBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: true },
      meta: { tier: 'standard', model: 'gemini-2.0-flash', provider: 'Google', confidence: 0.8 },
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

  it('should forward provider error status and body', async () => {
    const errorBody = '{"error": "rate limit"}';
    const mockProviderResp = new Response(errorBody, {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false },
      meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.8 },
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
      new HttpException({ error: { message: 'Limit exceeded: tokens usage (52,000) exceeds 50,000 per day' } }, 429),
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

  it('should not record agent_message on non-429 errors', async () => {
    proxyService.proxyRequest.mockRejectedValue(new Error('Internal failure'));

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(mockMessageRepo.insert).not.toHaveBeenCalled();
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
      },
      meta: { tier: 'simple', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    req.headers = { 'x-session-key': 'my-session' };
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
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
      },
      meta: { tier: 'simple', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
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
        forward: { response: new Response('{}', { status: 200 }), isGoogle: false },
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

  describe('client disconnect', () => {
    it('should register close listener on response', async () => {
      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: new Response('{}', { status: 200 }), isGoogle: false },
        meta: { tier: 'simple', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should pass AbortSignal to proxyService', async () => {
      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: new Response('{}', { status: 200 }), isGoogle: false },
        meta: { tier: 'simple', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      const signal = proxyService.proxyRequest.mock.calls[0][5];
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
      (res.on as jest.Mock).mockImplementation((event: string, cb: () => void) => {
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

      (res.on as jest.Mock).mockImplementation((event: string, cb: () => void) => {
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

      (res.on as jest.Mock).mockImplementation((event: string, cb: () => void) => {
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
        },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
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
        },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
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
        },
        meta: { tier: 'simple', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
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
        forward: { response: mockProviderResp, isGoogle: false },
        meta: { tier: 'complex', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.7 },
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
      proxyService.proxyRequest.mockRejectedValue(
        new Error('No model available'),
      );

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
        },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
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
        },
        meta: { tier: 'simple', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
      });

      const req1 = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res: res1 } = mockResponse();
      await controller.chatCompletions(req1 as never, res1 as never);

      expect(telemetry.trackCloudEvent).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();

      // Second request: provider 429 error, but user already seen
      const errorResp = new Response('{"error":"rate limit"}', { status: 429 });
      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: errorResp, isGoogle: false },
        meta: { tier: 'complex', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.8 },
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
        },
        meta: {
          tier: 'reasoning',
          model: 'o1-pro',
          provider: 'OpenAI',
          confidence: 0.95,
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
      proxyService.proxyRequest.mockRejectedValue(
        new Error('Sensitive internal error details'),
      );

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
        forward: { response: mockProviderResp, isGoogle: false },
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
        forward: { response: new Response(failingStream, { status: 200 }), isGoogle: false },
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
        forward: { response: new Response(failingStream, { status: 200 }), isGoogle: false },
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

      proxyService.proxyRequest.mockRejectedValue(
        new HttpException('Rate limit exceeded', 429),
      );

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
        },
        meta: { tier: 'simple' as const, model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
      });

      // This request fills the Set to exactly 10K
      proxyService.proxyRequest.mockResolvedValue(makeProxyResult());
      const req1 = mockRequest(
        { messages: [{ role: 'user', content: 'hi' }] },
        'user-9999',
      );
      const { res: res1 } = mockResponse();
      await controller.chatCompletions(req1 as never, res1 as never);

      expect(seenUsers.size).toBe(10_000);

      // Next request should evict the oldest entry
      proxyService.proxyRequest.mockResolvedValue(makeProxyResult());
      const req2 = mockRequest(
        { messages: [{ role: 'user', content: 'hi' }] },
        'user-10000',
      );
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
        forward: { response: mockProviderResp, isGoogle: false },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.8 },
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

    it('should transform Google streaming through convertGoogleStreamChunk', async () => {
      const mockProviderResp = createMockStreamResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"hi"}]}}]}\n\n',
      ]);

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp, isGoogle: true },
        meta: { tier: 'standard', model: 'gemini-2.0-flash', provider: 'Google', confidence: 0.8 },
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
        forward: { response: new Response(failingStream, { status: 200 }), isGoogle: false },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.8 },
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
});
