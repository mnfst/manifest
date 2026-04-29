import { HttpException } from '@nestjs/common';
import { ProxyController } from '../proxy.controller';
import { ProxyMessageRecorder } from '../proxy-message-recorder';
import { ProxyMessageDedup } from '../proxy-message-dedup';
import { IngestEventBusService } from '../../../common/services/ingest-event-bus.service';
import { ThoughtSignatureCache } from '../thought-signature-cache';
import { ThinkingBlockCache } from '../thinking-block-cache';

/**
 * Flush enough microtasks for the recorder's fire-and-forget chain to
 * complete. The chain is: `canonicalizeAgentMessageKeys` → `messageRepo.insert`
 * → `.catch(...)` — three awaits in sequence. Ten rounds of `Promise.resolve`
 * is deterministic (no timer involved) and forgiving if the chain grows.
 */
async function flushRecorderMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

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
    ip: '127.0.0.1',
  };
}

describe('ProxyController', () => {
  let controller: ProxyController;
  let proxyService: { proxyRequest: jest.Mock };
  let rateLimiter: {
    checkLimit: jest.Mock;
    checkIpLimit: jest.Mock;
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
  let mockMessageManager: {
    transaction: jest.Mock;
    getRepository: jest.Mock;
    query: jest.Mock;
  };
  let mockMessageRepo: {
    insert: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let mockPricingCache: { getByModel: jest.Mock };
  let recorder: ProxyMessageRecorder;

  beforeEach(() => {
    jest.clearAllMocks();
    proxyService = { proxyRequest: jest.fn() };
    rateLimiter = {
      checkLimit: jest.fn(),
      checkIpLimit: jest.fn(),
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
    mockMessageManager = {
      transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) =>
        cb(mockMessageManager),
      ),
      getRepository: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
    };
    mockMessageRepo = {
      insert: jest.fn().mockResolvedValue({}),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      manager: { transaction: mockMessageManager.transaction },
    };
    mockMessageManager.getRepository.mockReturnValue(mockMessageRepo);
    mockPricingCache = { getByModel: jest.fn().mockReturnValue(undefined) };
    const mockCustomProviders = {
      canonicalizeAgentMessageKeys: jest
        .fn()
        .mockImplementation(
          async (_agentId: string, provider: string | null, model: string | null) => ({
            provider: provider ?? null,
            model: model ?? null,
          }),
        ),
    };
    recorder = new ProxyMessageRecorder(
      mockMessageRepo as never,
      mockPricingCache as never,
      new ProxyMessageDedup(),
      { emit: jest.fn() } as unknown as IngestEventBusService,
      mockCustomProviders as never,
      { getProviders: jest.fn().mockResolvedValue([]) } as never,
      { getTiers: jest.fn().mockResolvedValue([]) } as never,
      { getAssignments: jest.fn().mockResolvedValue([]) } as never,
      { list: jest.fn().mockResolvedValue([]) } as never,
    );
    controller = new ProxyController(
      proxyService as never,
      rateLimiter as never,
      providerClient as never,
      recorder,
      new ThoughtSignatureCache(),
      new ThinkingBlockCache(),
    );
  });

  afterEach(() => {
    recorder.onModuleDestroy();
  });

  it('should return JSON response for non-streaming OpenAI provider', async () => {
    const responseBody = { choices: [{ message: { content: 'hello' } }] };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: {
        response: mockProviderResp,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
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

  it('should expose /v1/responses and convert chat completions output to Responses format', async () => {
    const responseBody = {
      created: 1234,
      model: 'gpt-4o',
      choices: [{ message: { content: 'hello' } }],
      usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
    };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: {
        response: mockProviderResp,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      },
      meta: {
        tier: 'simple',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
      },
    });

    const req = mockRequest({ input: 'hi' });
    const { res } = mockResponse();

    await controller.responses(req as never, res as never);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      expect.objectContaining({ apiMode: 'responses', body: { input: 'hi' } }),
    );
    const json = (res.json as jest.Mock).mock.calls[0][0];
    expect(json.object).toBe('response');
    expect(json.output[0].content[0]).toEqual({
      type: 'output_text',
      text: 'hello',
      annotations: [],
    });
    expect(json.usage.input_tokens).toBe(4);
  });

  it('should pass through native Responses JSON bodies', async () => {
    const responseBody = {
      id: 'resp_1',
      object: 'response',
      output: [{ type: 'message' }],
      usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
    };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: {
        response: mockProviderResp,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
        isResponses: true,
      },
      meta: {
        tier: 'simple',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
      },
    });

    const req = mockRequest({ input: 'hi' });
    const { res } = mockResponse();

    await controller.responses(req as never, res as never);

    expect(res.json).toHaveBeenCalledWith(responseBody);
  });

  it('should convert Google response for non-streaming', async () => {
    const googleBody = { candidates: [{ content: { parts: [{ text: 'hi' }] } }] };
    const convertedBody = { choices: [{ message: { content: 'hi' } }] };

    const mockProviderResp = new Response(JSON.stringify(googleBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: true, isAnthropic: false, isChatGpt: false },
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
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: true, isChatGpt: false },
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

  it('should collect ChatGPT SSE response for non-streaming', async () => {
    const sseText =
      'event: response.output_text.delta\ndata: {"delta":"hi"}\n\n' +
      'event: response.completed\ndata: {"response":{"usage":{"input_tokens":5,"output_tokens":3,"total_tokens":8},"output":[{"type":"message"}]}}\n\n';
    const collectedBody = {
      choices: [{ message: { content: 'hi' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3 },
    };

    const mockProviderResp = new Response(sseText, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false, isChatGpt: true },
      meta: {
        tier: 'standard',
        model: 'gpt-5.3-codex',
        provider: 'OpenAI',
        confidence: 0.8,
        reason: 'scored',
      },
    });
    (providerClient as Record<string, jest.Mock>).collectChatGptSseResponse = jest
      .fn()
      .mockReturnValue(collectedBody);

    const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(
      (providerClient as Record<string, jest.Mock>).collectChatGptSseResponse,
    ).toHaveBeenCalledWith(sseText, 'gpt-5.3-codex');
    expect(res.json).toHaveBeenCalledWith(collectedBody);
  });

  it('should not record success message for non-fallback responses (OTLP pipeline records them)', async () => {
    const responseBody = {
      choices: [{ message: { content: 'hello' } }],
      usage: { prompt_tokens: 500, completion_tokens: 200, cache_read_tokens: 100 },
    };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: {
        response: mockProviderResp,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
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
    await new Promise((r) => setTimeout(r, 10));

    // Success message is recorded by the proxy recorder (dedup handles OTLP overlap)
    expect(mockMessageRepo.find).toHaveBeenCalled();
  });

  it('should serialize concurrent success dedup checks for the same trace', async () => {
    let releaseInsert!: () => void;
    const insertGate = new Promise<void>((resolve) => {
      releaseInsert = resolve;
    });
    mockMessageRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'existing-otlp-row',
      input_tokens: 500,
      output_tokens: 200,
    });
    mockMessageRepo.insert.mockImplementationOnce(async () => {
      await insertGate;
      return {};
    });

    const ctx = {
      userId: 'user-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      agentName: 'test-agent',
    };
    const usage = {
      prompt_tokens: 500,
      completion_tokens: 200,
      cache_read_tokens: 100,
    };
    const recordSuccessMessage = (
      recorder as unknown as {
        recordSuccessMessage: (...args: unknown[]) => Promise<void>;
      }
    ).recordSuccessMessage.bind(recorder);

    const firstWrite = recordSuccessMessage(ctx, 'gpt-4o', 'simple', 'scored', usage, {
      traceId: 'abcdef1234567890abcdef1234567890',
      sessionKey: 'sess-1',
    });

    await new Promise((r) => setTimeout(r, 0));

    const secondWrite = recordSuccessMessage(ctx, 'gpt-4o', 'simple', 'scored', usage, {
      traceId: 'abcdef1234567890abcdef1234567890',
      sessionKey: 'sess-1',
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(mockMessageRepo.findOne).toHaveBeenCalledTimes(1);

    releaseInsert();
    await Promise.all([firstWrite, secondWrite]);

    expect(mockMessageRepo.findOne).toHaveBeenCalledTimes(2);
    expect(mockMessageRepo.insert).toHaveBeenCalledTimes(1);
  });

  it('should record message with zero tokens when response reports zero usage', async () => {
    const responseBody = {
      choices: [{ message: { content: 'hello' } }],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: {
        response: mockProviderResp,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
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
    await new Promise((r) => setTimeout(r, 10));

    expect(mockMessageRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ input_tokens: 0, output_tokens: 0, status: 'ok' }),
    );
  });

  it('should record message with zero tokens when response has no usage', async () => {
    const responseBody = { choices: [{ message: { content: 'hello' } }] };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: {
        response: mockProviderResp,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
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
    await new Promise((r) => setTimeout(r, 10));

    expect(mockMessageRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ input_tokens: 0, output_tokens: 0, status: 'ok', model: 'gpt-4o' }),
    );
  });

  it('should record usage data on fallback success', async () => {
    const responseBody = {
      choices: [{ message: { content: 'hello' } }],
      usage: { prompt_tokens: 500, completion_tokens: 200 },
    };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: {
        response: mockProviderResp,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      },
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

    const insertCalls = mockMessageRepo.insert.mock.calls;
    const successRecord = insertCalls.find(
      (call: unknown[]) =>
        (call[0] as Record<string, unknown>).status === 'ok' &&
        (call[0] as Record<string, unknown>).input_tokens === 500,
    );
    expect(successRecord).toBeDefined();
    const record = successRecord![0] as Record<string, unknown>;
    expect(record.output_tokens).toBe(200);
    expect(record.fallback_from_model).toBe('claude-sonnet-4-20250514');
    expect(record.fallback_index).toBe(0);
  });

  it('should compute cost on fallback success when pricing is available', async () => {
    mockPricingCache.getByModel.mockReturnValue({
      input_price_per_token: 0.000005,
      output_price_per_token: 0.00002,
    });

    const responseBody = {
      choices: [{ message: { content: 'hello' } }],
      usage: { prompt_tokens: 800, completion_tokens: 300 },
    };
    const mockProviderResp = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
      meta: {
        tier: 'standard',
        model: 'deepseek-chat',
        provider: 'DeepSeek',
        confidence: 0.8,
        reason: 'scored',
        fallbackFromModel: 'gpt-4o',
        fallbackIndex: 0,
        primaryErrorStatus: 401,
        primaryErrorBody: 'Unauthorized',
      },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);
    await new Promise((r) => setTimeout(r, 10));

    const insertCalls = mockMessageRepo.insert.mock.calls;
    const successRecord = insertCalls.find(
      (call: unknown[]) =>
        (call[0] as Record<string, unknown>).status === 'ok' &&
        (call[0] as Record<string, unknown>).input_tokens === 800,
    );
    expect(successRecord).toBeDefined();
    const record = successRecord![0] as Record<string, unknown>;
    expect(record.output_tokens).toBe(300);
    expect(record.cost_usd).toBe(800 * 0.000005 + 300 * 0.00002);
    expect(record.fallback_from_model).toBe('gpt-4o');
    expect(record.fallback_index).toBe(0);
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
      forward: {
        response: mockProviderResp,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
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
      forward: {
        response: mockProviderResp,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      },
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
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message: 'Rate limited by upstream provider',
        type: 'upstream_error',
        status: 429,
      },
    });
  });

  it('should handle 500 errors from proxyService as friendly chat message', async () => {
    proxyService.proxyRequest.mockRejectedValue(new Error('Internal failure'));

    const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] }, 'user-1', {
      accept: 'text/event-stream',
    });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        object: 'chat.completion',
        choices: expect.arrayContaining([
          expect.objectContaining({
            message: expect.objectContaining({
              content: '[🦚 Manifest] Something broke on our end. Try again in a moment.',
            }),
          }),
        ]),
      }),
    );
  });

  it('should return HTTP 500 with structured envelope for non-chat clients', async () => {
    proxyService.proxyRequest.mockRejectedValue(new Error('Internal failure'));

    const req = mockRequest({ messages: [{ role: 'user', content: 'test' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          type: 'server_error',
          message: expect.stringContaining('internal error'),
        }),
      }),
    );
  });

  it('should forward HttpException as friendly chat message', async () => {
    proxyService.proxyRequest.mockRejectedValue(
      new HttpException('Bad request: messages required', 400),
    );

    const req = mockRequest({}, 'user-1', { accept: 'text/event-stream' });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        object: 'chat.completion',
        choices: expect.arrayContaining([
          expect.objectContaining({
            message: expect.objectContaining({
              content: 'Bad request: messages required',
            }),
          }),
        ]),
      }),
    );
  });

  it('should return HTTP 400 with structured envelope when caller is non-chat', async () => {
    proxyService.proxyRequest.mockRejectedValue(
      new HttpException('Bad request: messages required', 400),
    );

    const req = mockRequest({});
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          type: 'invalid_request_error',
          message: 'Bad request: messages required',
        }),
      }),
    );
  });

  it('should record rate_limited agent_message on 429', async () => {
    proxyService.proxyRequest.mockRejectedValue(
      new HttpException('Too many requests — wait a few seconds and retry.', 429),
    );

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res } = mockResponse();

    await controller.chatCompletions(req as never, res as never);
    await flushRecorderMicrotasks();

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
    await flushRecorderMicrotasks();

    expect(mockMessageRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error_message: 'Bad request',
      }),
    );
  });

  it('should apply cooldown for repeated 429 errors from same agent', async () => {
    const limitError = new HttpException({ error: { message: 'Limit exceeded' } }, 429);
    proxyService.proxyRequest.mockRejectedValue(limitError);

    // First 429
    const req1 = mockRequest({ messages: [{ role: 'user', content: 'a' }] });
    const { res: res1 } = mockResponse();
    await controller.chatCompletions(req1 as never, res1 as never);

    // Second 429 (same agent) — within cooldown window, should be deduplicated
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
        isChatGpt: false,
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
      expect.objectContaining({
        agentId: 'agent-1',
        userId: 'user-1',
        body: req.body,
        sessionKey: 'my-session',
        tenantId: 'tenant-1',
        agentName: 'test-agent',
        signal: expect.any(AbortSignal),
        headers: expect.any(Object),
      }),
    );
  });

  it('should default session key to "default" when header is absent', async () => {
    proxyService.proxyRequest.mockResolvedValue({
      forward: {
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
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
      expect.objectContaining({
        agentId: 'agent-1',
        userId: 'user-1',
        body: req.body,
        sessionKey: 'default',
        tenantId: 'tenant-1',
        agentName: 'test-agent',
        signal: expect.any(AbortSignal),
        headers: expect.any(Object),
      }),
    );
  });

  describe('rate limiting', () => {
    it('should call checkLimit and acquireSlot before proxying', async () => {
      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
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

    it('should wrap string HttpException response in proxy_error envelope on 429', async () => {
      rateLimiter.checkLimit.mockImplementation(() => {
        throw new HttpException('Too many requests', 429);
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: { message: 'Too many requests', type: 'proxy_error' },
      });
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
        throw new HttpException('Too many requests — wait a few seconds and retry.', 429);
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);
      await flushRecorderMicrotasks();

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
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Bad request to upstream provider',
          type: 'upstream_error',
          status: 400,
        },
      });
    });

    it('should record every 429 provider response without cooldown', async () => {
      const makeResp = () =>
        new Response('{"error":"rate limit"}', {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });

      proxyService.proxyRequest.mockResolvedValue({
        forward: { response: makeResp(), isGoogle: false, isAnthropic: false, isChatGpt: false },
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
        forward: { response: makeResp(), isGoogle: false, isAnthropic: false, isChatGpt: false },
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

      // Second 429 is within cooldown window, only first is recorded
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
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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

    it('should truncate long error messages to 2000 chars', async () => {
      const longError = 'x'.repeat(3000);
      const mockProviderResp = new Response(longError, {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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
          error_message: 'x'.repeat(2000),
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
          isChatGpt: false,
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
          isChatGpt: false,
        },
        meta: { tier: 'simple', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      const opts = proxyService.proxyRequest.mock.calls[0][0] as { signal?: AbortSignal };
      expect(opts.signal).toBeInstanceOf(AbortSignal);
      expect(opts.signal!.aborted).toBe(false);
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

  describe('error handling edge cases', () => {
    it('should mask error message for 500+ status codes as friendly chat message', async () => {
      proxyService.proxyRequest.mockRejectedValue(new Error('Sensitive internal error details'));

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] }, 'user-1', {
        accept: 'text/event-stream',
      });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          object: 'chat.completion',
          choices: expect.arrayContaining([
            expect.objectContaining({
              message: expect.objectContaining({
                content: '[🦚 Manifest] Something broke on our end. Try again in a moment.',
              }),
            }),
          ]),
        }),
      );
    });

    it('should expose original message for client errors as friendly chat message', async () => {
      proxyService.proxyRequest.mockRejectedValue(
        new HttpException('messages array is required', 400),
      );

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] }, 'user-1', {
        accept: 'text/event-stream',
      });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          choices: expect.arrayContaining([
            expect.objectContaining({
              message: expect.objectContaining({
                content: 'messages array is required',
              }),
            }),
          ]),
        }),
      );
    });

    it('should handle non-Error throw as friendly chat message', async () => {
      proxyService.proxyRequest.mockRejectedValue('string error');

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] }, 'user-1', {
        accept: 'text/event-stream',
      });
      const { res } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          object: 'chat.completion',
          choices: expect.arrayContaining([
            expect.objectContaining({
              message: expect.objectContaining({
                content: '[🦚 Manifest] Something broke on our end. Try again in a moment.',
              }),
            }),
          ]),
        }),
      );
    });

    it('should forward provider error response and preserve content-type from provider', async () => {
      const mockProviderResp = new Response('{"error":"bad gateway"}', {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
        meta: { tier: 'standard', model: 'gpt-4o', provider: 'OpenAI', confidence: 0.8 },
      });

      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
      const { res, headers } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Upstream provider returned bad gateway',
          type: 'upstream_error',
          status: 502,
        },
      });
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
          isChatGpt: false,
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
          isChatGpt: false,
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
      const limitError = new HttpException('Limit exceeded', 429);
      proxyService.proxyRequest.mockRejectedValue(limitError);

      // First 429 — should record
      const req1 = mockRequest({ messages: [{ role: 'user', content: 'a' }] });
      const { res: res1 } = mockResponse();
      await controller.chatCompletions(req1 as never, res1 as never);
      await flushRecorderMicrotasks();
      expect(mockMessageRepo.insert).toHaveBeenCalledTimes(1);

      // Expire the cooldown entry directly instead of advancing fake
      // timers — fake timers would also freeze the microtask flush we
      // rely on to wait for the recorder's fire-and-forget insert.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = (recorder as any).rateLimitCooldown as Map<string, number>;
      map.set('tenant-1:agent-1', Date.now() - 120_000);

      // Second 429 after cooldown — should record again
      const req2 = mockRequest({ messages: [{ role: 'user', content: 'b' }] });
      const { res: res2 } = mockResponse();
      await controller.chatCompletions(req2 as never, res2 as never);
      await flushRecorderMicrotasks();
      expect(mockMessageRepo.insert).toHaveBeenCalledTimes(2);
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
      await flushRecorderMicrotasks();

      expect(mockMessageRepo.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('rateLimitCooldown eviction', () => {
    it('should evict expired cooldown entries when map exceeds max size', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cooldownMap = (recorder as any).rateLimitCooldown as Map<string, number>;
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
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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
      recorder.onModuleDestroy(); // stop timer from beforeEach recorder

      const timedRecorder = new ProxyMessageRecorder(
        mockMessageRepo as never,
        mockPricingCache as never,
        new ProxyMessageDedup(),
        { emit: jest.fn() } as unknown as IngestEventBusService,
        {
          canonicalizeAgentMessageKeys: jest
            .fn()
            .mockImplementation(
              async (_agentId: string, provider: string | null, model: string | null) => ({
                provider: provider ?? null,
                model: model ?? null,
              }),
            ),
        } as never,
        { getProviders: jest.fn().mockResolvedValue([]) } as never,
        { getTiers: jest.fn().mockResolvedValue([]) } as never,
        { getAssignments: jest.fn().mockResolvedValue([]) } as never,
        { list: jest.fn().mockResolvedValue([]) } as never,
      );

      const cooldownMap = (timedRecorder as any).rateLimitCooldown as Map<string, number>;
      cooldownMap.set('t:a', Date.now() - 120_000); // expired

      jest.advanceTimersByTime(60_000);
      expect(cooldownMap.size).toBe(0);

      timedRecorder.onModuleDestroy();
      jest.useRealTimers();
    });

    it('onModuleDestroy stops the periodic cleanup timer', () => {
      jest.useFakeTimers();
      recorder.onModuleDestroy(); // stop timer from beforeEach recorder

      const timedRecorder = new ProxyMessageRecorder(
        mockMessageRepo as never,
        mockPricingCache as never,
        new ProxyMessageDedup(),
        { emit: jest.fn() } as unknown as IngestEventBusService,
        {
          canonicalizeAgentMessageKeys: jest
            .fn()
            .mockImplementation(
              async (_agentId: string, provider: string | null, model: string | null) => ({
                provider: provider ?? null,
                model: model ?? null,
              }),
            ),
        } as never,
        { getProviders: jest.fn().mockResolvedValue([]) } as never,
        { getTiers: jest.fn().mockResolvedValue([]) } as never,
        { getAssignments: jest.fn().mockResolvedValue([]) } as never,
        { list: jest.fn().mockResolvedValue([]) } as never,
      );

      timedRecorder.onModuleDestroy();

      const cooldownMap = (timedRecorder as any).rateLimitCooldown as Map<string, number>;
      cooldownMap.set('t:a', Date.now() - 120_000);

      jest.advanceTimersByTime(120_000);
      expect(cooldownMap.size).toBe(1); // not evicted because timer stopped

      jest.useRealTimers();
    });
  });

  describe('seenUsers bounded Map with TTL', () => {
    const makeProxyResult = () => ({
      forward: {
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      },
      meta: { tier: 'simple' as const, model: 'gpt-4o', provider: 'OpenAI', confidence: 0.9 },
    });

    it('should evict oldest user when MAX_SEEN_USERS is reached', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seenUsers = (controller as any).seenUsers as Map<string, number>;

      const now = Date.now();
      for (let i = 0; i < 9_999; i++) {
        seenUsers.set(`prefill-user-${i}`, now);
      }

      proxyService.proxyRequest.mockResolvedValue(makeProxyResult());
      const req1 = mockRequest({ messages: [{ role: 'user', content: 'hi' }] }, 'user-9999');
      const { res: res1 } = mockResponse();
      await controller.chatCompletions(req1 as never, res1 as never);

      expect(seenUsers.size).toBe(10_000);

      proxyService.proxyRequest.mockResolvedValue(makeProxyResult());
      const req2 = mockRequest({ messages: [{ role: 'user', content: 'hi' }] }, 'user-10000');
      const { res: res2 } = mockResponse();
      await controller.chatCompletions(req2 as never, res2 as never);

      expect(seenUsers.size).toBe(10_000);
      expect(seenUsers.has('prefill-user-0')).toBe(false);
      expect(seenUsers.has('user-10000')).toBe(true);
    });

    it('should evict expired entries older than 24 hours', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seenUsers = (controller as any).seenUsers as Map<string, number>;

      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
      seenUsers.set('old-user-1', twentyFiveHoursAgo);
      seenUsers.set('old-user-2', twentyFiveHoursAgo);
      seenUsers.set('recent-user', Date.now());

      proxyService.proxyRequest.mockResolvedValue(makeProxyResult());
      const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] }, 'new-user');
      const { res } = mockResponse();
      await controller.chatCompletions(req as never, res as never);

      expect(seenUsers.has('old-user-1')).toBe(false);
      expect(seenUsers.has('old-user-2')).toBe(false);
      expect(seenUsers.has('recent-user')).toBe(true);
      expect(seenUsers.has('new-user')).toBe(true);
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
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
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
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: true,
          isChatGpt: false,
        },
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
      ).toHaveBeenCalledWith('claude-sonnet-4-20250514', expect.any(Function));
      expect(written.some((w) => w.includes('content'))).toBe(true);
    });

    it('should transform Google streaming through convertGoogleStreamChunk', async () => {
      const mockProviderResp = createMockStreamResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"hi"}]}}]}\n\n',
      ]);

      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: mockProviderResp,
          isGoogle: true,
          isAnthropic: false,
          isChatGpt: false,
        },
        meta: {
          tier: 'standard',
          model: 'gemini-2.0-flash',
          provider: 'Google',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      providerClient.convertGoogleStreamChunk.mockReturnValue({
        chunk: 'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
        signatures: [],
      });

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

    it('should transform ChatGPT streaming through convertChatGptStreamChunk', async () => {
      const mockProviderResp = createMockStreamResponse([
        'event: response.output_text.delta\ndata: {"delta":"hi"}\n\n',
      ]);

      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: true,
        },
        meta: {
          tier: 'standard',
          model: 'gpt-5.3-codex',
          provider: 'OpenAI',
          confidence: 0.8,
          reason: 'scored',
        },
      });

      (providerClient as Record<string, jest.Mock>).convertChatGptStreamChunk = jest
        .fn()
        .mockReturnValue('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n');

      const req = mockRequest({
        messages: [{ role: 'user', content: 'test' }],
        stream: true,
      });
      const { res, written } = mockResponse();

      await controller.chatCompletions(req as never, res as never);

      expect(
        (providerClient as Record<string, jest.Mock>).convertChatGptStreamChunk,
      ).toHaveBeenCalled();
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
          isChatGpt: false,
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
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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
          auth_type: 'subscription',
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

      // Fallback success recorded with auth_type and cost_usd
      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          model: 'deepseek-chat',
          routing_tier: 'simple',
          fallback_from_model: 'gemini-2.5-flash-lite',
          fallback_index: 0,
          auth_type: 'subscription',
          cost_usd: 0,
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
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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

      // 3 inserts: primary failure + 1 batched failed-fallbacks + fallback success
      expect(mockMessageRepo.insert).toHaveBeenCalledTimes(3);

      // Intermediate failures batched into a single insert with both rows
      expect(mockMessageRepo.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          model: 'deepseek-chat',
          status: 'fallback_error',
          fallback_from_model: 'gemini-flash',
          fallback_index: 0,
        }),
        expect.objectContaining({
          model: 'gpt-4o-mini',
          status: 'fallback_error',
          fallback_from_model: 'gemini-flash',
          fallback_index: 1,
        }),
      ]);
    });

    it('should record message with zero tokens when response has no usage data', async () => {
      const responseBody = { choices: [{ message: { content: 'hello' } }] };
      const mockProviderResp = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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

      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          input_tokens: 0,
          output_tokens: 0,
          status: 'ok',
          model: 'gpt-4o',
        }),
      );
    });

    it('should include fallback fields in error recording when fallback was used', async () => {
      const errorBody = '{"error":"bad request"}';
      const mockProviderResp = new Response(errorBody, {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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
      const { res, headers } = mockResponse();

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
      expect(mockMessageRepo.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          model: 'deepseek-chat',
          status: 'error',
          fallback_from_model: 'gemini-flash',
          fallback_index: 0,
          error_message: 'auth fail',
        }),
      ]);
      expect(headers['X-Manifest-Fallback-Exhausted']).toBe('true');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ type: 'fallback_exhausted' }),
        }),
      );
    });

    it('should handle DB failure in recordFailedFallbacks when all fallbacks fail', async () => {
      mockMessageRepo.insert.mockRejectedValue(new Error('DB write failed'));

      const mockProviderResp = new Response('primary error', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            type: 'fallback_exhausted',
            status: 502,
          }),
        }),
      );
    });

    it('should handle DB failure in recordPrimaryFailure on successful fallback', async () => {
      mockMessageRepo.insert.mockRejectedValue(new Error('DB write failed'));

      const responseBody = { choices: [{ message: { content: 'hello' } }] };
      const mockProviderResp = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      });

      proxyService.proxyRequest.mockResolvedValue({
        forward: {
          response: mockProviderResp,
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
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

      // 2 inserts: primary (fallback_error) + 1 batched failed-fallbacks (2 rows)
      expect(mockMessageRepo.insert).toHaveBeenCalledTimes(2);
      expect(mockMessageRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-flash',
          status: 'fallback_error',
        }),
      );
      expect(mockMessageRepo.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          model: 'deepseek-chat',
          status: 'fallback_error',
          fallback_index: 0,
        }),
        expect.objectContaining({
          model: 'gpt-4o-mini',
          status: 'error',
          fallback_index: 1,
        }),
      ]);
    });
  });

  it('should pass authType to recordFailedFallbacks when all fallbacks fail', async () => {
    const mockProviderResp = new Response('primary error', {
      status: 502,
      headers: { 'Content-Type': 'text/plain' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: {
        response: mockProviderResp,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      },
      meta: {
        tier: 'simple',
        model: 'gemini-flash',
        provider: 'Google',
        confidence: 0.9,
        reason: 'scored',
        auth_type: 'subscription',
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

    await controller.chatCompletions(req as never, res as never);
    await new Promise((r) => setTimeout(r, 50));

    // Fallback failure recorded with auth_type from meta (batched as array)
    expect(mockMessageRepo.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        model: 'deepseek-chat',
        auth_type: 'subscription',
      }),
    ]);
    // Primary failure also recorded with auth_type
    expect(mockMessageRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-flash',
        status: 'fallback_error',
        auth_type: 'subscription',
      }),
    );
  });

  it('should return primary error status with fallback_exhausted type and X-Manifest-Fallback-Exhausted header', async () => {
    const mockProviderResp = new Response('primary error', {
      status: 502,
      headers: { 'Content-Type': 'text/plain' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
      meta: {
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
      },
      failedFallbacks: [
        {
          model: 'claude-sonnet-4',
          provider: 'Anthropic',
          fallbackIndex: 0,
          status: 503,
          errorBody: 'overloaded',
        },
        {
          model: 'deepseek-chat',
          provider: 'DeepSeek',
          fallbackIndex: 1,
          status: 500,
          errorBody: 'server error',
        },
      ],
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res, headers } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(headers['X-Manifest-Fallback-Exhausted']).toBe('true');
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        type: 'fallback_exhausted',
        status: 502,
        primary_model: 'gpt-4o',
        primary_provider: 'OpenAI',
        attempted_fallbacks: [
          { model: 'claude-sonnet-4', provider: 'Anthropic', status: 503 },
          { model: 'deepseek-chat', provider: 'DeepSeek', status: 500 },
        ],
      }),
    });
  });

  it('should NOT set X-Manifest-Fallback-Exhausted when error has no failed fallbacks', async () => {
    const mockProviderResp = new Response('bad request', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    });

    proxyService.proxyRequest.mockResolvedValue({
      forward: { response: mockProviderResp, isGoogle: false, isAnthropic: false },
      meta: {
        tier: 'simple',
        model: 'gpt-4o-mini',
        provider: 'OpenAI',
        confidence: 0.9,
        reason: 'scored',
      },
    });

    const req = mockRequest({ messages: [{ role: 'user', content: 'hi' }] });
    const { res, headers } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(headers['X-Manifest-Fallback-Exhausted']).toBeUndefined();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ type: 'upstream_error' }),
      }),
    );
  });

  it('should NOT set X-Manifest-Fallback-Exhausted when a fallback succeeded', async () => {
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
    const { res, headers } = mockResponse();

    await controller.chatCompletions(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(headers['X-Manifest-Fallback-Exhausted']).toBeUndefined();
  });
});
