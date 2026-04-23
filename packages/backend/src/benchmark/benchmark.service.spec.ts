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

function makeDto(overrides: Partial<RunBenchmarkDto> = {}): RunBenchmarkDto {
  return {
    agentName: 'demo',
    model: 'openai/gpt-4o',
    provider: 'openai',
    authType: 'api_key',
    messages: [{ role: 'user', content: 'hi' }],
    ...overrides,
  } as RunBenchmarkDto;
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
  messageRepo: { insert: jest.Mock };
}

function buildService(mocks: Partial<Mocks> = {}): { service: BenchmarkService; mocks: Mocks } {
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
    messageRepo: { insert: jest.fn().mockResolvedValue(undefined) },
    ...mocks,
  };
  const service = new BenchmarkService(
    full.resolveAgent as unknown as ResolveAgentService,
    full.providerKeyService as unknown as ProviderKeyService,
    full.providerClient as unknown as ProviderClient,
    full.pricingCache as unknown as ModelPricingCacheService,
    full.eventBus as unknown as IngestEventBusService,
    full.history as unknown as BenchmarkHistoryService,
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
      routing_reason: 'benchmark',
      routing_tier: null,
      status: 'ok',
      provider: 'openai',
      model: 'openai/gpt-4o',
      input_tokens: 10,
      output_tokens: 5,
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
      routing_reason: 'benchmark',
      status: 'error',
      error_http_status: 429,
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
    expect(result.content).toBe('Hello bare string world');
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
