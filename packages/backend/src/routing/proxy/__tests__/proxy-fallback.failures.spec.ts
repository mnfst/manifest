import { Repository } from 'typeorm';
import type { ModelRoute } from 'manifest-shared';
import { ProxyFallbackService } from '../proxy-fallback.service';
import { ProviderKeyService } from '../../routing-core/provider-key.service';
import { CustomProvider } from '../../../entities/custom-provider.entity';
import { OpenaiOauthService } from '../../oauth/openai/openai-oauth.service';
import { MinimaxOauthService } from '../../oauth/minimax/minimax-oauth.service';
import { AnthropicOauthService } from '../../oauth/anthropic/anthropic-oauth.service';
import { GeminiOauthService } from '../../oauth/gemini/gemini-oauth.service';
import { KiroOauthService } from '../../oauth/kiro/kiro-oauth.service';
import { XaiOauthService } from '../../oauth/xai/xai-oauth.service';
import { ProviderClient } from '../provider-client';
import { CopilotTokenService } from '../copilot-token.service';
import { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';
import { AgentModelParamsService } from '../../routing-core/agent-model-params.service';
import { ProviderParamSpecService } from '../../routing-core/provider-param-spec.service';

/**
 * Status-code-driven fallback chain behavior for tryFallbacks().
 *
 * `shouldTriggerFallback(status)` currently returns true for ANY status >= 400,
 * so every upstream error (401 auth, 404 not-found, 429 rate limit, 5xx) keeps
 * the loop going to the next route. These tests pin that contract per status
 * code so a future change that re-introduces auth-failure short-circuit (or
 * any other selective stop) cannot land silently.
 */

describe('ProxyFallbackService.tryFallbacks — failure chain by status code', () => {
  let service: ProxyFallbackService;
  let providerKeyService: jest.Mocked<ProviderKeyService>;
  let providerClient: jest.Mocked<ProviderClient>;

  const body = { messages: [{ role: 'user', content: 'Hello' }], stream: false };

  // Helper: build a structured ModelRoute. Keeps call-sites readable since
  // tryFallbacks takes the route array at positional arg 16.
  const route = (
    provider: string,
    model: string,
    authType: 'api_key' | 'subscription' = 'api_key',
  ): ModelRoute => ({ provider, authType, model });

  // Helper: invoke tryFallbacks with the 16-arg signature. Trailing args we
  // don't care about are passed as undefined.
  const runFallbacks = (models: string[], routes: ModelRoute[] | null, primaryModel = 'gpt-4o') =>
    service.tryFallbacks(
      'agent-1',
      'user-1',
      models,
      body,
      false,
      'sess-1',
      primaryModel,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      routes,
    );

  beforeEach(() => {
    providerKeyService = {
      getProviderApiKey: jest.fn().mockResolvedValue('sk-test'),
      getProviderKeyId: jest.fn().mockResolvedValue('up-fallback'),
      getAuthType: jest.fn().mockResolvedValue('api_key'),
      findProviderForModel: jest.fn().mockResolvedValue(undefined),
      getProviderRegion: jest.fn().mockResolvedValue(null),
      hasActiveProvider: jest.fn().mockResolvedValue(true),
      // Single key selection per attempt — composed from the legacy mocks so
      // existing setups driving getProviderApiKey/getProviderKeyId/getProviderRegion
      // keep working; apiKey, id, and region all come from this one row.
      selectProviderKey: jest.fn(
        async (
          userId: string,
          provider: string,
          authType?: string,
          label?: string,
          agentId?: string,
        ) => {
          const apiKey = await providerKeyService.getProviderApiKey(
            userId,
            provider,
            authType as never,
            label,
            agentId,
          );
          if (apiKey === null || apiKey === undefined) return null;
          const id = await providerKeyService.getProviderKeyId(
            userId,
            provider,
            authType as never,
            label,
            agentId,
          );
          const region = await providerKeyService.getProviderRegion(
            userId,
            provider,
            authType as never,
            label,
            agentId,
          );
          return { apiKey, id, region, label: label ?? 'Default', priority: 0 };
        },
      ),
    } as unknown as jest.Mocked<ProviderKeyService>;

    providerClient = {
      forward: jest.fn(),
    } as unknown as jest.Mocked<ProviderClient>;

    const customProviderRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<Repository<CustomProvider>>;

    const oauthStub = { unwrapToken: jest.fn().mockResolvedValue(null) };

    service = new ProxyFallbackService(
      providerKeyService,
      customProviderRepo,
      oauthStub as unknown as OpenaiOauthService,
      oauthStub as unknown as MinimaxOauthService,
      oauthStub as unknown as AnthropicOauthService,
      oauthStub as unknown as GeminiOauthService,
      oauthStub as unknown as KiroOauthService,
      oauthStub as unknown as XaiOauthService,
      providerClient,
      {
        getCopilotToken: jest.fn().mockResolvedValue('tid=copilot-session'),
      } as unknown as CopilotTokenService,
      {
        getByModel: jest.fn().mockReturnValue(null),
      } as unknown as ModelPricingCacheService,
      {
        get: jest.fn().mockResolvedValue(null),
        list: jest.fn().mockResolvedValue([]),
      } as unknown as AgentModelParamsService,
      {
        getSpecs: jest.fn().mockResolvedValue([]),
        list: jest.fn().mockResolvedValue([]),
      } as unknown as ProviderParamSpecService,
    );
  });

  it('tries all three routes when first returns 429, second returns 429, third returns 200', async () => {
    // Rate-limit → rate-limit → success is the canonical "retry across
    // providers when the cheap one is throttled" path. All three must run
    // and the third's success is what tryFallbacks returns.
    providerClient.forward
      .mockResolvedValueOnce({
        response: new Response('rate limit', { status: 429 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      })
      .mockResolvedValueOnce({
        response: new Response('rate limit', { status: 429 }),
        isGoogle: false,
        isAnthropic: true,
        isChatGpt: false,
      })
      .mockResolvedValueOnce({
        response: new Response('{}', { status: 200 }),
        isGoogle: true,
        isAnthropic: false,
        isChatGpt: false,
      });

    const routes: ModelRoute[] = [
      route('openai', 'gpt-4o-mini'),
      route('anthropic', 'claude-haiku-3.5'),
      route('gemini', 'gemini-2.5-flash'),
    ];
    const result = await runFallbacks(
      ['gpt-4o-mini', 'claude-haiku-3.5', 'gemini-2.5-flash'],
      routes,
    );

    expect(providerClient.forward).toHaveBeenCalledTimes(3);
    expect(result.success).not.toBeNull();
    expect(result.success!.fallbackIndex).toBe(2);
    expect(result.success!.provider).toBe('gemini');
    expect(result.success!.model).toBe('gemini-2.5-flash');
    expect(result.failures).toHaveLength(2);
    expect(result.failures.map((f) => f.status)).toEqual([429, 429]);
    expect(result.failures.map((f) => f.provider)).toEqual(['openai', 'anthropic']);
  });

  it('cooldowns repeated 429 attempts for the same provider key and model', async () => {
    providerClient.forward.mockResolvedValueOnce({
      response: new Response('rate limit', {
        status: 429,
        headers: { 'retry-after': '120' },
      }),
      isGoogle: false,
      isAnthropic: true,
      isChatGpt: false,
    });

    const opts = {
      provider: 'anthropic',
      apiKey: 'sk-ant-oat-token',
      model: 'claude-sonnet-4-6',
      body,
      stream: false,
      sessionKey: 'sess-1',
      agentId: 'agent-1',
      providerKeyLabel: 'Claude Code',
      authType: 'subscription',
    };

    const first = await service.tryForwardToProvider(opts);
    const second = await service.tryForwardToProvider(opts);

    expect(first.response.status).toBe(429);
    expect(second.response.status).toBe(429);
    expect(second.response.headers.get('retry-after')).toBe('120');
    expect(await second.response.text()).toContain('temporarily cooling down');
    expect(providerClient.forward).toHaveBeenCalledTimes(1);
  });

  it('evicts an active cooldown when the cooldown cache is full', async () => {
    const cooldowns = (service as unknown as { rateLimitCooldowns: Map<string, number> })
      .rateLimitCooldowns;
    const farFuture = Date.now() + 60_000;
    for (let i = 0; i < 2_000; i += 1) {
      cooldowns.set(
        `agent-1\u0000anthropic\u0000subscription\u0000Key ${i}\u0000model-${i}`,
        farFuture + i,
      );
    }

    providerClient.forward.mockResolvedValueOnce({
      response: new Response('rate limit', {
        status: 429,
        headers: { 'retry-after': '120' },
      }),
      isGoogle: false,
      isAnthropic: true,
      isChatGpt: false,
    });

    await service.tryForwardToProvider({
      provider: 'anthropic',
      apiKey: 'sk-ant-oat-token',
      model: 'claude-sonnet-4-6',
      body,
      stream: false,
      sessionKey: 'sess-1',
      agentId: 'agent-1',
      providerKeyLabel: 'Claude Code',
      authType: 'subscription',
    });

    expect(cooldowns.size).toBe(2_000);
    expect(cooldowns.has('agent-1\u0000anthropic\u0000subscription\u0000Key 0\u0000model-0')).toBe(
      false,
    );
    expect(
      cooldowns.has(
        'agent-1\u0000anthropic\u0000subscription\u0000Claude Code\u0000claude-sonnet-4-6',
      ),
    ).toBe(true);
  });

  it('does NOT short-circuit on 401 auth errors — continues to next route (current contract)', async () => {
    // shouldTriggerFallback(401) === true, so an auth failure on the first
    // route keeps the loop going. This test pins that behavior: if anyone
    // later wants 401 to halt the chain they need to change
    // fallback-status-codes.ts AND update this test deliberately.
    providerClient.forward
      .mockResolvedValueOnce({
        response: new Response('invalid api key', { status: 401 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      })
      .mockResolvedValueOnce({
        response: new Response('rate limit', { status: 429 }),
        isGoogle: false,
        isAnthropic: true,
        isChatGpt: false,
      })
      .mockResolvedValueOnce({
        response: new Response('{}', { status: 200 }),
        isGoogle: true,
        isAnthropic: false,
        isChatGpt: false,
      });

    const routes: ModelRoute[] = [
      route('openai', 'gpt-4o-mini'),
      route('anthropic', 'claude-haiku-3.5'),
      route('gemini', 'gemini-2.5-flash'),
    ];
    const result = await runFallbacks(
      ['gpt-4o-mini', 'claude-haiku-3.5', 'gemini-2.5-flash'],
      routes,
    );

    expect(providerClient.forward).toHaveBeenCalledTimes(3);
    expect(result.success).not.toBeNull();
    expect(result.success!.provider).toBe('gemini');
    expect(result.failures).toHaveLength(2);
    expect(result.failures[0]).toMatchObject({ status: 401, provider: 'openai' });
    expect(result.failures[1]).toMatchObject({ status: 429, provider: 'anthropic' });
  });

  it('returns success=null with all-404 failures when every fallback lacks the model (no 503 collapse)', async () => {
    // The "model not available on any provider" chain. tryFallbacks must
    // preserve each per-attempt 404 status + body, NOT synthesize a
    // generic 503 — the caller decides how to surface this.
    providerClient.forward.mockImplementation(async () => ({
      // Fresh Response per call — bodies can only be read once.
      response: new Response('{"error":"model not found on this provider"}', {
        status: 404,
      }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    }));

    const routes: ModelRoute[] = [
      route('openai', 'unknown-model-x'),
      route('anthropic', 'unknown-model-x'),
      route('gemini', 'unknown-model-x'),
    ];
    const result = await runFallbacks(
      ['unknown-model-x', 'unknown-model-x', 'unknown-model-x'],
      routes,
    );

    expect(providerClient.forward).toHaveBeenCalledTimes(3);
    expect(result.success).toBeNull();
    expect(result.failures).toHaveLength(3);
    for (const failure of result.failures) {
      expect(failure.status).toBe(404);
      expect(failure.errorBody).toBe('{"error":"model not found on this provider"}');
    }
    expect(result.failures.map((f) => f.fallbackIndex)).toEqual([0, 1, 2]);
    expect(result.failures.map((f) => f.provider)).toEqual(['openai', 'anthropic', 'gemini']);
  });

  it('preserves the LAST fallback errorBody/status when all return 404 (caller surfaces final 404 verbatim)', async () => {
    // Same scenario as above with distinct per-provider error bodies. The
    // final failure entry holds the last attempt's body verbatim — that
    // is what proxy.service projects back to the agent as the user-facing
    // response when the chain exhausts.
    providerClient.forward
      .mockResolvedValueOnce({
        response: new Response('{"error":"openai: model_not_found"}', { status: 404 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      })
      .mockResolvedValueOnce({
        response: new Response('{"error":"anthropic: not_found_error"}', { status: 404 }),
        isGoogle: false,
        isAnthropic: true,
        isChatGpt: false,
      })
      .mockResolvedValueOnce({
        response: new Response('{"error":"gemini: NOT_FOUND"}', { status: 404 }),
        isGoogle: true,
        isAnthropic: false,
        isChatGpt: false,
      });

    const routes: ModelRoute[] = [
      route('openai', 'unknown-model-x'),
      route('anthropic', 'unknown-model-x'),
      route('gemini', 'unknown-model-x'),
    ];
    const result = await runFallbacks(
      ['unknown-model-x', 'unknown-model-x', 'unknown-model-x'],
      routes,
    );

    expect(result.success).toBeNull();
    const last = result.failures[result.failures.length - 1];
    expect(last.status).toBe(404);
    expect(last.errorBody).toBe('{"error":"gemini: NOT_FOUND"}');
    expect(last.provider).toBe('gemini');
    // Sanity: middle entries retain their own bodies — no overwrite.
    expect(result.failures[0].errorBody).toContain('openai: model_not_found');
    expect(result.failures[1].errorBody).toContain('anthropic: not_found_error');
  });
});
