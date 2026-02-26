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

  beforeEach(() => {
    jest.clearAllMocks();
    proxyService = { proxyRequest: jest.fn() };
    controller = new ProxyController(proxyService as never);
  });

  describe('tier extraction', () => {
    it('should default to standard when X-Manifest-Tier is missing', async () => {
      const responseBody = { choices: [{ message: { content: 'hello' } }] };
      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response(JSON.stringify(responseBody), { status: 200 }),
        },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI' },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(proxyService.proxyRequest).toHaveBeenCalledWith(
        'user-1',
        req.body,
        'standard',
      );
    });

    it('should use X-Manifest-Tier header when present', async () => {
      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response('{}', { status: 200 }),
        },
        meta: { tier: 'complex', model: 'claude-sonnet-4', provider: 'Anthropic' },
      });

      const req = mockRequest(
        { messages: [{ role: 'user', content: 'hi' }] },
        'user-1',
        { 'x-manifest-tier': 'complex' },
      );
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(proxyService.proxyRequest).toHaveBeenCalledWith(
        'user-1',
        req.body,
        'complex',
      );
    });

    it('should return 400 for invalid tier', async () => {
      const req = mockRequest(
        { messages: [{ role: 'user', content: 'hi' }] },
        'user-1',
        { 'x-manifest-tier': 'mega' },
      );
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          message: expect.stringContaining('Invalid tier'),
          type: 'proxy_error',
        }),
      });
    });
  });

  it('should return JSON response for non-streaming', async () => {
    const responseBody = { choices: [{ message: { content: 'hello' } }] };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp },
      meta: { tier: 'simple', model: 'gpt-4o', provider: 'OpenAI' },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res, headers } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(responseBody);
    expect(headers['X-Manifest-Tier']).toBe('simple');
    expect(headers['X-Manifest-Model']).toBe('gpt-4o');
    expect(headers['X-Manifest-Provider']).toBe('OpenAI');
  });

  it('should NOT include X-Manifest-Confidence header', async () => {
    proxyService.proxyRequest.mockResolvedValue({
      forward: {
        response: new Response('{}', { status: 200 }),
      },
      meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI' },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res, headers } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(headers['X-Manifest-Confidence']).toBeUndefined();
  });

  it('should forward provider error status and body', async () => {
    const errorBody = '{"error": "rate limit"}';
    const mockProviderResp = new Response(errorBody, {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp },
      meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI' },
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

  describe('first proxy request tracking', () => {
    it('should fire routing_first_proxy_request on first successful proxy', async () => {
      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response('{}', { status: 200 }),
        },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI' },
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
        },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI' },
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

    it('should not fire event when proxyService throws', async () => {
      proxyService.proxyRequest.mockRejectedValue(
        new Error('No model available'),
      );

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(telemetry.trackCloudEvent).not.toHaveBeenCalled();
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

    it('should pipe streaming responses directly', async () => {
      const mockProviderResp = createMockStreamResponse([
        'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
      ]);

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: mockProviderResp },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI' },
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

    it('should close stream on error after headers sent', async () => {
      const failingStream = new ReadableStream({
        start(ctrl) {
          ctrl.error(new Error('stream broke'));
        },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: new Response(failingStream, { status: 200 }) },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI' },
      });

      const req = mockRequest({
        messages: [{ role: 'user', content: 'test' }],
        stream: true,
      });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.end).toHaveBeenCalled();
    });
  });
});
