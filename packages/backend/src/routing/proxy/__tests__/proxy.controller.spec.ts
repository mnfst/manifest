import { HttpException } from '@nestjs/common';
import { ProxyController } from '../proxy.controller';

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
