import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { BenchmarkService } from './benchmark.service';
import type { ProviderClient } from '../routing/proxy/provider-client';
import type { ProviderKeyService } from '../routing/routing-core/provider-key.service';
import type { ResolveAgentService } from '../routing/routing-core/resolve-agent.service';
import type { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import type { IngestEventBusService } from '../common/services/ingest-event-bus.service';
import type { BenchmarkHistoryService } from './benchmark-history.service';
import type { Repository } from 'typeorm';
import type { AgentMessage } from '../entities/agent-message.entity';
import type { RunBenchmarkDto } from './dto/run-benchmark.dto';

const USER_ID = 'user-1';
const AGENT = { id: 'agent-1', tenant_id: 'tenant-1', name: 'demo' };

// Minimum required shape — any missing DTO field would be a type error here
// rather than a silent test-time failure. Extra fields (runId, position,
// rawRequestBody, requestHeaders) are optional so the `Partial<>` overrides
// handle them without a cast.
function makeDto(overrides: Partial<RunBenchmarkDto> = {}): RunBenchmarkDto {
  const base: Pick<RunBenchmarkDto, 'agentName' | 'model' | 'provider' | 'authType' | 'messages'> =
    {
      agentName: 'demo',
      model: 'openai/gpt-4o',
      provider: 'openai',
      authType: 'api_key',
      messages: [{ role: 'user', content: 'hi' }],
    };
  return { ...base, ...overrides };
}

function jsonResponse(
  body: unknown,
  init: ResponseInit & { headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
}

interface Mocks {
  resolveAgent: { resolve: jest.Mock };
  providerKeyService: {
    hasActiveProvider: jest.Mock;
    getAuthType: jest.Mock;
    getProviderApiKey: jest.Mock;
  };
  providerClient: {
    forward: jest.Mock;
    convertGoogleResponse: jest.Mock;
    convertAnthropicResponse: jest.Mock;
    convertChatGptResponse: jest.Mock;
  };
  pricingCache: { getByModel: jest.Mock };
  eventBus: { emit: jest.Mock };
  history: { saveColumn: jest.Mock };
  rateLimiter: { acquireSlot: jest.Mock; releaseSlot: jest.Mock };
  messageRepo: { insert: jest.Mock; manager: { transaction: jest.Mock } };
}

interface MocksOverrides {
  resolveAgent?: { resolve: jest.Mock };
  providerKeyService?: {
    hasActiveProvider: jest.Mock;
    getAuthType: jest.Mock;
    getProviderApiKey: jest.Mock;
  };
  providerClient?: {
    forward: jest.Mock;
    convertGoogleResponse: jest.Mock;
    convertAnthropicResponse: jest.Mock;
    convertChatGptResponse: jest.Mock;
  };
  pricingCache?: { getByModel: jest.Mock };
  eventBus?: { emit: jest.Mock };
  history?: { saveColumn: jest.Mock };
  rateLimiter?: { acquireSlot: jest.Mock; releaseSlot: jest.Mock };
  // Tests can pass just `{ insert }` here — the wrapper plumbs the txn-aware
  // manager around it.
  messageRepo?: { insert: jest.Mock };
}

function stripMessageRepo(o: MocksOverrides): Omit<MocksOverrides, 'messageRepo'> {
  const { messageRepo: _ignored, ...rest } = o;
  return rest;
}

function buildService(mocks: MocksOverrides = {}): { service: BenchmarkService; mocks: Mocks } {
  // The transactional persistSuccess path calls messageRepo.manager.transaction
  // and threads an EntityManager down into recordSuccess + history.saveColumn.
  // The mock just runs the callback with a manager whose getRepository returns
  // the same insert mock — the assertions still target messageRepo.insert /
  // history.saveColumn.
  const overrideRepo = mocks.messageRepo as { insert?: jest.Mock } | undefined;
  const messageInsert = overrideRepo?.insert ?? jest.fn().mockResolvedValue(undefined);
  const txn = jest.fn().mockImplementation(async (cb: (m: unknown) => unknown) =>
    cb({
      getRepository: () => ({ insert: messageInsert }),
    }),
  );
  const full: Mocks = {
    resolveAgent: {
      resolve: jest.fn().mockResolvedValue(AGENT),
    },
    providerKeyService: {
      hasActiveProvider: jest.fn().mockResolvedValue(true),
      getAuthType: jest.fn().mockResolvedValue('api_key'),
      getProviderApiKey: jest.fn().mockResolvedValue('sk-test'),
    },
    providerClient: {
      forward: jest.fn(),
      convertGoogleResponse: jest.fn(),
      convertAnthropicResponse: jest.fn(),
      convertChatGptResponse: jest.fn(),
    },
    pricingCache: {
      getByModel: jest.fn().mockReturnValue({
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000002,
      }),
    },
    eventBus: { emit: jest.fn() },
    history: { saveColumn: jest.fn().mockResolvedValue(undefined) },
    rateLimiter: {
      acquireSlot: jest.fn(),
      releaseSlot: jest.fn(),
    },
    messageRepo: { insert: messageInsert, manager: { transaction: txn } },
    // Strip the override's `messageRepo` — its `{ insert }` was already
    // captured into `messageInsert` above and re-wrapped with `manager.txn`.
    ...stripMessageRepo(mocks),
  };
  const service = new BenchmarkService(
    full.resolveAgent as unknown as ResolveAgentService,
    full.providerKeyService as unknown as ProviderKeyService,
    full.providerClient as unknown as ProviderClient,
    full.pricingCache as unknown as ModelPricingCacheService,
    full.eventBus as unknown as IngestEventBusService,
    full.history as unknown as BenchmarkHistoryService,
    full.rateLimiter as unknown as import('../routing/proxy/proxy-rate-limiter').ProxyRateLimiter,
    full.messageRepo as unknown as Repository<AgentMessage>,
  );
  return { service, mocks: full };
}

describe('BenchmarkService', () => {
  it('returns content + metrics and records a success message on happy path', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse({
        choices: [{ message: { content: 'hello there' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });

    const result = await service.run(USER_ID, makeDto());

    expect(result.content).toBe('hello there');
    expect(result.metrics.inputTokens).toBe(10);
    expect(result.metrics.outputTokens).toBe(5);
    expect(result.metrics.cost).toBeCloseTo(10 * 0.000001 + 5 * 0.000002);
    expect(result.metrics.durationMs).toBeGreaterThanOrEqual(0);
    expect(mocks.messageRepo.insert).toHaveBeenCalledTimes(1);
    const row = mocks.messageRepo.insert.mock.calls[0][0];
    expect(row).toMatchObject({
      routing_tier: 'benchmark',
      routing_reason: null,
      status: 'ok',
      provider: 'openai',
      model: 'openai/gpt-4o',
      input_tokens: 10,
      output_tokens: 5,
      recorded: false,
    });
    expect(mocks.eventBus.emit).toHaveBeenCalledWith(USER_ID);
  });

  it('throws NotFoundException when the provider is not connected', async () => {
    const { service } = buildService({
      providerKeyService: {
        hasActiveProvider: jest.fn().mockResolvedValue(false),
        getAuthType: jest.fn(),
        getProviderApiKey: jest.fn(),
      },
    });
    await expect(service.run(USER_ID, makeDto())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when the provider key is missing', async () => {
    const { service } = buildService({
      providerKeyService: {
        hasActiveProvider: jest.fn().mockResolvedValue(true),
        getAuthType: jest.fn().mockResolvedValue('api_key'),
        getProviderApiKey: jest.fn().mockResolvedValue(null),
      },
    });
    await expect(service.run(USER_ID, makeDto())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records an error row and throws BadGatewayException on upstream 4xx/5xx', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: new Response('rate limited', { status: 429 }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });

    await expect(service.run(USER_ID, makeDto())).rejects.toBeInstanceOf(BadGatewayException);
    expect(mocks.messageRepo.insert).toHaveBeenCalledTimes(1);
    expect(mocks.messageRepo.insert.mock.calls[0][0]).toMatchObject({
      routing_tier: 'benchmark',
      status: 'error',
      error_http_status: 429,
      recorded: false,
    });
  });

  it('uses the Anthropic converter when the provider response is in Anthropic format', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse({ content: [{ type: 'text', text: 'anthropic raw' }] }),
      isGoogle: false,
      isAnthropic: true,
      isChatGpt: false,
    });
    mocks.providerClient.convertAnthropicResponse.mockReturnValue({
      choices: [{ message: { content: 'anthropic normalized' } }],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    });

    const result = await service.run(USER_ID, makeDto({ provider: 'anthropic' }));

    expect(mocks.providerClient.convertAnthropicResponse).toHaveBeenCalled();
    expect(result.content).toBe('anthropic normalized');
  });

  it('wraps a ProviderClient network error in a BadGatewayException', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockRejectedValue(new Error('ECONNRESET'));
    await expect(service.run(USER_ID, makeDto())).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('throws BadGatewayException when the provider response is not JSON', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: new Response('<html>oops</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });
    await expect(service.run(USER_ID, makeDto())).rejects.toMatchObject({
      message: 'Provider returned a non-JSON response',
    });
  });

  it('uses the ChatGPT (Responses API) converter when the provider response is in that format', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse({ output: [] }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: true,
    });
    mocks.providerClient.convertChatGptResponse.mockReturnValue({
      choices: [{ message: { content: 'chatgpt normalized' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const result = await service.run(USER_ID, makeDto());
    expect(mocks.providerClient.convertChatGptResponse).toHaveBeenCalled();
    expect(result.content).toBe('chatgpt normalized');
  });

  it('uses the Google converter when the provider response is in Google format', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse({ candidates: [] }),
      isGoogle: true,
      isAnthropic: false,
      isChatGpt: false,
    });
    mocks.providerClient.convertGoogleResponse.mockReturnValue({
      choices: [{ message: { content: 'gemini normalized' } }],
      usage: { prompt_tokens: 2, completion_tokens: 4 },
    });
    const result = await service.run(USER_ID, makeDto());
    expect(mocks.providerClient.convertGoogleResponse).toHaveBeenCalled();
    expect(result.content).toBe('gemini normalized');
  });

  it('extracts content from OpenAI-style array-of-parts responses', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse({
        choices: [
          {
            message: {
              content: [
                { type: 'text', text: 'Hello ' },
                'bare string ',
                { type: 'image', url: 'ignored' },
                { text: 'world' },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });
    const result = await service.run(USER_ID, makeDto());
    // Multi-part assistant content is joined with `\n` so paragraph/turn
    // boundaries the provider emitted via separate text blocks survive into
    // the column UI. Empty parts (non-text blocks like images) are dropped.
    expect(result.content).toBe('Hello \nbare string \nworld');
  });

  it('falls back to "" when no user message exists and the last message has nullish content', async () => {
    // The DTO validator normally enforces non-empty content, but the service
    // is robust to a malformed input that smuggles past it (legacy callers,
    // direct internal use). Hits the trailing `?? ''` branch in extractPrompt.
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });
    await service.run(
      USER_ID,
      makeDto({
        // Bypass the DTO type — at runtime the field can land as undefined
        // if the validator was disabled or skipped (we still want a clean
        // empty-string prompt rather than NaN/undefined leaking out).
        messages: [{ role: 'assistant', content: undefined as unknown as string }],
      }),
    );
    // saveColumn now receives an EntityManager as the second arg (transactional
    // write); the matcher accepts anything for the manager slot.
    expect(mocks.history.saveColumn).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: '' }),
      expect.anything(),
    );
  });

  it('falls back to the last message when there is no user message', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });
    await service.run(
      USER_ID,
      makeDto({
        messages: [
          { role: 'system', content: 'you are a helper' },
          { role: 'assistant', content: 'ack' },
        ],
      }),
    );
    expect(mocks.history.saveColumn).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'ack' }),
      expect.anything(),
    );
  });

  it('logs and swallows repo failures when recording an error row', async () => {
    const { service, mocks } = buildService({
      messageRepo: {
        insert: jest.fn().mockRejectedValue(new Error('db down')),
      },
    });
    mocks.providerClient.forward.mockResolvedValue({
      response: new Response('boom', { status: 500 }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });
    await expect(service.run(USER_ID, makeDto())).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('forwards the verbatim rawRequestBody when provided (stream/model/stream_options stripped)', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse({
        choices: [{ message: { content: 'replayed' } }],
        usage: { prompt_tokens: 8, completion_tokens: 4 },
      }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });

    await service.run(
      USER_ID,
      makeDto({
        rawRequestBody: {
          messages: [{ role: 'user', content: 'original' }],
          temperature: 0.7,
          tools: [{ name: 'x' }],
          stream: true,
          stream_options: { include_usage: true },
          model: 'ignored/old-model',
        },
      }),
    );

    const call = mocks.providerClient.forward.mock.calls[0][0];
    expect(call.body).toEqual({
      messages: [{ role: 'user', content: 'original' }],
      temperature: 0.7,
      tools: [{ name: 'x' }],
    });
  });

  it('falls back to providerKeyService.getAuthType when the DTO omits authType', async () => {
    const { service, mocks } = buildService();
    mocks.providerKeyService.getAuthType.mockResolvedValueOnce('subscription');
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });

    const dto = makeDto();
    delete (dto as Partial<RunBenchmarkDto>).authType;
    await service.run(USER_ID, dto);

    expect(mocks.providerKeyService.getAuthType).toHaveBeenCalledWith('agent-1', 'openai');
    // The resolved authType is propagated to the recorded row.
    expect(mocks.messageRepo.insert.mock.calls[0][0]).toMatchObject({
      auth_type: 'subscription',
    });
  });

  it('wraps a non-Error provider-client rejection (covers the String(err) branch)', async () => {
    // The forwardRequest catch coerces err to a string only when it is not
    // an Error instance. Throwing a bare string exercises the alternate
    // branch of the `err instanceof Error ? err.message : String(err)` ternary.
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockRejectedValue('plain string failure');
    await expect(service.run(USER_ID, makeDto())).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('treats missing usage fields as zero tokens', async () => {
    // No prompt_tokens / completion_tokens — the `?? 0` fallbacks fire so
    // the metrics row stays well-formed instead of carrying NaN.
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });
    const result = await service.run(USER_ID, makeDto());
    expect(result.metrics.inputTokens).toBe(0);
    expect(result.metrics.outputTokens).toBe(0);
  });

  it('treats an empty body string as `{}` rather than throwing on JSON parse', async () => {
    // The `bodyText ? JSON.parse(...) : {}` short-circuit prevents an empty
    // 200 from blowing up; we should still produce an empty-content row.
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: new Response('', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });
    const result = await service.run(USER_ID, makeDto());
    expect(result.content).toBe('');
    expect(result.metrics.inputTokens).toBe(0);
  });

  it('logs and swallows non-Error rejections when recording an error row', async () => {
    // Hits the `err instanceof Error ? err.message : err` ternary in
    // recordError — exercising the alternate branch keeps logging output
    // sane when something throws a non-Error (libraries occasionally do).
    const { service, mocks } = buildService({
      messageRepo: {
        insert: jest.fn().mockRejectedValue('non-error string'),
      },
    });
    mocks.providerClient.forward.mockResolvedValue({
      response: new Response('boom', { status: 500 }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });
    await expect(service.run(USER_ID, makeDto())).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('acquires + releases a concurrency slot on the happy path', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });
    await service.run(USER_ID, makeDto());
    expect(mocks.rateLimiter.acquireSlot).toHaveBeenCalledWith(USER_ID);
    expect(mocks.rateLimiter.releaseSlot).toHaveBeenCalledWith(USER_ID);
  });

  it('still releases the concurrency slot when the provider call throws', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockRejectedValue(new Error('network down'));
    await expect(service.run(USER_ID, makeDto())).rejects.toBeInstanceOf(BadGatewayException);
    expect(mocks.rateLimiter.releaseSlot).toHaveBeenCalledWith(USER_ID);
  });

  it('redacts UUIDs / request-id / org-id shaped tokens in the surfaced error', async () => {
    // Defense-in-depth: provider error bodies often echo internal request/
    // org/account identifiers that are useful only as recon for follow-on
    // attacks. Cap at 120 chars and replace those tokens with `[id]`.
    const { service, mocks } = buildService();
    const noisy =
      'rate limit org_abcdef123456 request_id=req_zzz9999 trace deadbeef-1234-4321-aaaa-1234567890ab';
    // mockImplementation so each call gets a fresh Response (response.text()
    // consumes the body — calling service.run twice on the same Response
    // throws on the second read).
    mocks.providerClient.forward.mockImplementation(async () => ({
      response: new Response(noisy, { status: 429 }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    }));
    await expect(service.run(USER_ID, makeDto())).rejects.toMatchObject({
      message: expect.not.stringMatching(/abcdef123456|req_zzz9999|deadbeef-1234/),
    });
    await expect(service.run(USER_ID, makeDto())).rejects.toMatchObject({
      message: expect.stringMatching(/Provider returned 429:.*\[id\]/),
    });
  });

  it('caps the surfaced error snippet at 120 characters', async () => {
    const { service, mocks } = buildService();
    const longBody = 'x'.repeat(500);
    mocks.providerClient.forward.mockResolvedValue({
      response: new Response(longBody, { status: 500 }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });
    let captured: Error | undefined;
    try {
      await service.run(USER_ID, makeDto());
    } catch (err) {
      captured = err as Error;
    }
    expect(captured).toBeDefined();
    // "Provider returned 500: " is 23 chars; the snippet itself must be ≤ 120.
    const snippet = captured!.message.replace(/^Provider returned \d+: /, '');
    expect(snippet.length).toBeLessThanOrEqual(120);
  });

  it('truncateError returns just the status when the body is empty/whitespace', async () => {
    // Empty body → snippet === '' → falls into the no-snippet branch of
    // the truncateError ternary.
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: new Response('   ', { status: 503 }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });
    await expect(service.run(USER_ID, makeDto())).rejects.toMatchObject({
      message: 'Provider returned 503',
    });
  });

  it('returns empty content when the assistant message content is null/undefined', async () => {
    // `extractContent` falls through to '' when raw is neither string nor
    // Array. Hits the final return-empty branch at the bottom of the method.
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse({
        choices: [{ message: { content: null } }],
        usage: { prompt_tokens: 1, completion_tokens: 0 },
      }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });
    const result = await service.run(USER_ID, makeDto());
    expect(result.content).toBe('');
  });

  it('returns empty content when there is no choice at all', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse({ usage: { prompt_tokens: 1, completion_tokens: 0 } }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });
    const result = await service.run(USER_ID, makeDto());
    expect(result.content).toBe('');
  });

  it('only returns whitelisted response headers', async () => {
    const { service, mocks } = buildService();
    mocks.providerClient.forward.mockResolvedValue({
      response: jsonResponse(
        {
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        },
        {
          headers: {
            'x-ratelimit-remaining': '99',
            'set-cookie': 'leaked=1',
            'x-request-id': 'abc',
          },
        },
      ),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });

    const result = await service.run(USER_ID, makeDto());

    expect(result.headers['x-ratelimit-remaining']).toBe('99');
    expect(result.headers['x-request-id']).toBe('abc');
    expect(result.headers['set-cookie']).toBeUndefined();
  });
});
