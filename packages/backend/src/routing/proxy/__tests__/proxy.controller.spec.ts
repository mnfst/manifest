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
  let providerClient: {
    convertGoogleResponse: jest.Mock;
    convertGoogleStreamChunk: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    proxyService = { proxyRequest: jest.fn() };
    providerClient = {
      convertGoogleResponse: jest.fn(),
      convertGoogleStreamChunk: jest.fn(),
    };
    controller = new ProxyController(
      proxyService as never,
      providerClient as never,
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
    );
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
