import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getProviderParamSpecs,
  type AuthType,
  type ModelRoute,
  type ProviderParamSpecCatalog,
} from 'manifest-shared';
import { ProxyService } from '../proxy.service';
import type { ResolveService } from '../../resolve/resolve.service';
import type { ProviderKeyService } from '../../routing-core/provider-key.service';
import type { TierService } from '../../routing-core/tier.service';
import type { OpenaiOauthService } from '../../oauth/openai/openai-oauth.service';
import type { MinimaxOauthService } from '../../oauth/minimax/minimax-oauth.service';
import type { AnthropicOauthService } from '../../oauth/anthropic/anthropic-oauth.service';
import type { GeminiOauthService } from '../../oauth/gemini/gemini-oauth.service';
import type { KiroOauthService } from '../../oauth/kiro/kiro-oauth.service';
import type { XaiOauthService } from '../../oauth/xai/xai-oauth.service';
import type { SessionMomentumService } from '../session-momentum.service';
import type { LimitCheckService } from '../../../notifications/services/limit-check.service';
import type { ProxyFallbackService } from '../proxy-fallback.service';
import type { ThoughtSignatureCache } from '../thought-signature-cache';
import type { ThinkingBlockCache } from '../thinking-block-cache';
import type { ReasoningContentCache } from '../reasoning-content-cache';
import { AgentModelParamsService } from '../../routing-core/agent-model-params.service';
import type { ProviderParamSpecService } from '../../routing-core/provider-param-spec.service';

/**
 * Stream-warmup helper is mocked because the real implementation depends on
 * a streaming Response body. We control its return value per test.
 */
jest.mock('../stream-warmup', () => ({
  peekStream: jest.fn(),
  STREAM_WARMUP_MS: 15_000,
}));

import { peekStream } from '../stream-warmup';
const mockedPeek = peekStream as jest.MockedFunction<typeof peekStream>;

const route = (provider: string, authType: ModelRoute['authType'], model: string): ModelRoute => ({
  provider,
  authType,
  model,
});

const okResponse = (status = 200) =>
  new Response('{"ok":true}', { status, headers: { 'content-type': 'application/json' } });

const specCatalog: ProviderParamSpecCatalog = [
  {
    provider: 'deepseek',
    authType: 'api_key',
    model: 'deepseek-v4-flash',
    params: [
      {
        path: 'thinking.type',
        type: 'enum',
        label: 'Thinking mode',
        description: 'Controls whether DeepSeek thinking mode is enabled.',
        default: 'enabled',
        values: ['enabled', 'disabled'],
        group: 'reasoning',
      },
    ],
  },
];

describe('ProxyService — orchestration', () => {
  let resolveService: jest.Mocked<Pick<ResolveService, 'resolve' | 'resolveForTier'>>;
  let providerKeyService: jest.Mocked<
    Pick<
      ProviderKeyService,
      'getProviderApiKey' | 'getProviderRegion' | 'getProviderKeyId' | 'selectProviderKey'
    >
  >;
  let tierService: jest.Mocked<Pick<TierService, 'getTiers'>>;
  let openaiOauth: jest.Mocked<Pick<OpenaiOauthService, 'unwrapToken'>>;
  let minimaxOauth: jest.Mocked<Pick<MinimaxOauthService, 'unwrapToken'>>;
  let anthropicOauth: jest.Mocked<Pick<AnthropicOauthService, 'unwrapToken'>>;
  let geminiOauth: jest.Mocked<Pick<GeminiOauthService, 'unwrapToken'>>;
  let kiroOauth: jest.Mocked<Pick<KiroOauthService, 'unwrapToken'>>;
  let xaiOauth: jest.Mocked<Pick<XaiOauthService, 'unwrapToken'>>;
  let momentum: jest.Mocked<
    Pick<
      SessionMomentumService,
      'recordTier' | 'recordCategory' | 'getRecentTiers' | 'getRecentCategories'
    >
  >;
  let limitCheck: jest.Mocked<Pick<LimitCheckService, 'checkLimits'>>;
  let fallbackService: jest.Mocked<
    Pick<ProxyFallbackService, 'tryForwardToProvider' | 'tryFallbacks'>
  >;
  let configService: ConfigService;
  let signatureCache: ThoughtSignatureCache;
  let thinkingCache: ThinkingBlockCache;
  let reasoningCache: ReasoningContentCache;
  let modelParamsService: { get: jest.Mock; list: jest.Mock; set: jest.Mock; delete: jest.Mock };
  let providerParamSpecs: { getSpecs: jest.Mock; list: jest.Mock };
  let svc: ProxyService;

  beforeEach(() => {
    jest.clearAllMocks();

    resolveService = {
      resolve: jest.fn(),
      resolveForTier: jest.fn(),
    };
    providerKeyService = {
      getProviderApiKey: jest.fn().mockResolvedValue('decrypted-key'),
      getProviderRegion: jest.fn().mockResolvedValue(null),
      getProviderKeyId: jest.fn().mockResolvedValue('up-default'),
      // Single key selection per request: apiKey, id, and region are all
      // projected from this one row so they can never diverge.
      selectProviderKey: jest.fn().mockResolvedValue({
        apiKey: 'decrypted-key',
        id: 'up-default',
        region: null,
        label: 'Default',
        priority: 0,
      }),
    };
    tierService = { getTiers: jest.fn().mockResolvedValue([]) };
    openaiOauth = { unwrapToken: jest.fn().mockResolvedValue(null) };
    minimaxOauth = { unwrapToken: jest.fn().mockResolvedValue(null) };
    anthropicOauth = { unwrapToken: jest.fn().mockResolvedValue(null) };
    geminiOauth = { unwrapToken: jest.fn().mockResolvedValue(null) };
    kiroOauth = { unwrapToken: jest.fn().mockResolvedValue(null) };
    xaiOauth = { unwrapToken: jest.fn().mockResolvedValue(null) };
    momentum = {
      recordTier: jest.fn(),
      recordCategory: jest.fn(),
      getRecentTiers: jest.fn().mockReturnValue([]),
      getRecentCategories: jest.fn().mockReturnValue([]),
    };
    limitCheck = { checkLimits: jest.fn().mockResolvedValue(null) };
    fallbackService = {
      tryForwardToProvider: jest.fn(),
      tryFallbacks: jest.fn(),
    };
    configService = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    signatureCache = {
      retrieve: jest.fn().mockReturnValue(null),
    } as unknown as ThoughtSignatureCache;
    thinkingCache = { retrieve: jest.fn().mockReturnValue(null) } as unknown as ThinkingBlockCache;
    reasoningCache = {
      retrieve: jest.fn().mockReturnValue(null),
    } as unknown as ReasoningContentCache;

    modelParamsService = {
      get: jest.fn().mockResolvedValue(null),
      list: jest.fn().mockResolvedValue([]),
      set: jest.fn(),
      delete: jest.fn(),
    };
    providerParamSpecs = {
      getSpecs: jest.fn(async (provider: string, authType: string, model: string) =>
        getProviderParamSpecs(specCatalog, provider, authType as AuthType, model),
      ),
      list: jest.fn().mockResolvedValue(specCatalog),
    };

    svc = new ProxyService(
      resolveService as unknown as ResolveService,
      providerKeyService as unknown as ProviderKeyService,
      tierService as unknown as TierService,
      openaiOauth as unknown as OpenaiOauthService,
      minimaxOauth as unknown as MinimaxOauthService,
      anthropicOauth as unknown as AnthropicOauthService,
      geminiOauth as unknown as GeminiOauthService,
      kiroOauth as unknown as KiroOauthService,
      xaiOauth as unknown as XaiOauthService,
      momentum as unknown as SessionMomentumService,
      limitCheck as unknown as LimitCheckService,
      fallbackService as unknown as ProxyFallbackService,
      configService,
      signatureCache,
      thinkingCache,
      reasoningCache,
      modelParamsService as unknown as AgentModelParamsService,
      providerParamSpecs as unknown as ProviderParamSpecService,
    );
  });

  const baseOpts = (overrides: Partial<Parameters<ProxyService['proxyRequest']>[0]> = {}) => ({
    agentId: 'agent-1',
    userId: 'user-1',
    body: { messages: [{ role: 'user', content: 'hi' }] },
    sessionKey: 'sess-1',
    tenantId: 'tenant-1',
    agentName: 'demo-agent',
    ...overrides,
  });

  describe('payload validation', () => {
    it('throws when messages is missing', async () => {
      await expect(svc.proxyRequest(baseOpts({ body: {} as never }))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when messages is empty', async () => {
      await expect(svc.proxyRequest(baseOpts({ body: { messages: [] } as never }))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when messages exceeds the max', async () => {
      const messages = Array.from({ length: 1001 }, () => ({ role: 'user', content: 'x' }));
      await expect(svc.proxyRequest(baseOpts({ body: { messages } as never }))).rejects.toThrow(
        /1000/,
      );
    });

    it('replaces null content with empty string', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: null,
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      const body = { messages: [{ role: 'user', content: null }] };
      const result = await svc.proxyRequest(baseOpts({ body } as never));
      // Routing was called — sanitized message reached the resolver.
      expect(resolveService.resolve).toHaveBeenCalled();
      expect(result.forward.response.status).toBeGreaterThanOrEqual(200);
    });
  });

  describe('limit enforcement', () => {
    it('returns a friendly limit response when checkLimits flags an excess', async () => {
      limitCheck.checkLimits.mockResolvedValue({
        metricType: 'cost',
        actual: 500,
        threshold: 100,
        period: 'monthly',
      } as never);
      const result = await svc.proxyRequest(baseOpts());
      expect(result.forward.response.status).toBe(200);
      const body = await result.forward.response.text();
      expect(body).toContain('M200');
    });

    it('formats token-based limits without a dollar sign', async () => {
      limitCheck.checkLimits.mockResolvedValue({
        metricType: 'tokens',
        actual: 1_000,
        threshold: 500,
        period: 'daily',
      } as never);
      const result = await svc.proxyRequest(baseOpts());
      const body = await result.forward.response.text();
      expect(body).toContain('M200');
    });

    it('skips limit checks when agentName is missing', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: null,
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      await svc.proxyRequest({ ...baseOpts(), agentName: undefined });
      expect(limitCheck.checkLimits).not.toHaveBeenCalled();
    });
  });

  describe('no route resolved', () => {
    it('returns a friendly no-provider response', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: null,
        fallback_routes: null,
        confidence: 0,
        score: 0,
        reason: 'scored',
      });
      const result = await svc.proxyRequest(baseOpts());
      const body = await result.forward.response.text();
      expect(body).toContain('M101');
    });
  });

  describe('no credentials', () => {
    it('returns the M100 friendly response', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      providerKeyService.selectProviderKey.mockResolvedValue(null);
      const result = await svc.proxyRequest(baseOpts());
      const body = await result.forward.response.text();
      expect(body).toContain('M100');
    });
  });

  describe('happy path forward', () => {
    it('returns the forward result and records tier momentum on a 200 non-stream response', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(200),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await svc.proxyRequest(baseOpts());
      expect(result.meta.tier).toBe('standard');
      expect(result.meta.model).toBe('gpt-4o');
      expect(result.meta.provider).toBe('openai');
      expect(momentum.recordTier).toHaveBeenCalledWith('sess-1', 'standard');
    });

    it('passes the raw stored OpenAI OAuth blob alongside the unwrapped access token', async () => {
      const rawBlob = JSON.stringify({
        t: 'cached-access',
        r: 'refresh-token',
        e: Date.now() + 10 * 60 * 1000,
      });
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: { ...route('openai', 'subscription', 'gpt-5.3-codex'), keyLabel: 'Work' },
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      // The single key selection surfaces the stored OAuth blob; the subscription
      // re-read path then re-fetches the freshest blob for the 401-retry rawApiKey.
      providerKeyService.selectProviderKey.mockResolvedValue({
        apiKey: rawBlob,
        id: 'up-default',
        region: null,
        label: 'Work',
        priority: 0,
      });
      providerKeyService.getProviderApiKey.mockResolvedValue(rawBlob);
      openaiOauth.unwrapToken.mockResolvedValue('cached-access');
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(200),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: true,
      });

      await svc.proxyRequest(baseOpts());

      expect(fallbackService.tryForwardToProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          authType: 'subscription',
          apiKey: 'cached-access',
          rawApiKey: rawBlob,
          providerKeyLabel: 'Work',
          agentId: 'agent-1',
          tenantId: 'tenant-1',
        }),
      );
    });

    it('passes the latest stored OAuth blob after preflight refresh rotates tokens', async () => {
      const staleBlob = JSON.stringify({
        t: 'stale-access',
        r: 'stale-refresh',
        e: Date.now() - 10 * 60 * 1000,
      });
      const refreshedBlob = JSON.stringify({
        t: 'fresh-access',
        r: 'rotated-refresh',
        e: Date.now() + 10 * 60 * 1000,
      });
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: { ...route('openai', 'subscription', 'gpt-5.3-codex'), keyLabel: 'Work' },
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      // selectProviderKey surfaces the stale blob (used for the preflight unwrap);
      // the subscription re-read then returns the rotated blob for the retry path.
      providerKeyService.selectProviderKey.mockResolvedValue({
        apiKey: staleBlob,
        id: 'up-default',
        region: null,
        label: 'Work',
        priority: 0,
      });
      providerKeyService.getProviderApiKey.mockResolvedValue(refreshedBlob);
      openaiOauth.unwrapToken.mockResolvedValue('fresh-access');
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(200),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: true,
      });

      await svc.proxyRequest(baseOpts());

      // Single selection + a single subscription re-read for the freshest blob.
      expect(providerKeyService.selectProviderKey).toHaveBeenCalledTimes(1);
      expect(providerKeyService.getProviderApiKey).toHaveBeenCalledTimes(1);
      expect(fallbackService.tryForwardToProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          authType: 'subscription',
          apiKey: 'fresh-access',
          rawApiKey: refreshedBlob,
          providerKeyLabel: 'Work',
        }),
      );
    });

    it('records the specificity category when the route originates from specificity', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 0.9,
        score: 0,
        reason: 'specificity',
        specificity_category: 'coding',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      await svc.proxyRequest(baseOpts());
      expect(momentum.recordCategory).toHaveBeenCalledWith('sess-1', 'coding');
    });

    it('skips category recording for unknown values', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 0.9,
        score: 0,
        reason: 'specificity',
        specificity_category: 'not-a-category' as never,
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      await svc.proxyRequest(baseOpts());
      expect(momentum.recordCategory).not.toHaveBeenCalled();
    });

    it('hands the fallback service a paramMergeContext carrying the agent and route scope', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('deepseek', 'api_key', 'deepseek-v4-flash'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await svc.proxyRequest(baseOpts());
      const call = fallbackService.tryForwardToProvider.mock.calls[0][0];
      // Body stays raw — the merge happens per-attempt inside the fallback
      // service so each fallback iteration looks up its own scoped route.
      expect(call.body).toEqual({ messages: [{ role: 'user', content: 'hi' }] });
      expect(call.paramMergeContext).toEqual({ agentId: 'agent-1', scopeKey: 'tier:standard' });
    });

    it('looks up the primary route model params for the snapshot', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('deepseek', 'api_key', 'deepseek-v4-flash'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      modelParamsService.get.mockResolvedValueOnce({ thinking: { type: 'enabled' } });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await svc.proxyRequest(baseOpts());
      expect(modelParamsService.get).toHaveBeenCalledWith(
        'agent-1',
        'tier:standard',
        'deepseek',
        'api_key',
        'deepseek-v4-flash',
      );
    });

    // Snapshot lookup must use the same normalized model id as the forward.
    // Anthropic strips dots (claude-sonnet-4.6 -> claude-sonnet-4-6); using
    // route.model would key the snapshot off a different row than the wire,
    // letting metadata drift from what was actually sent.
    it('snapshot lookup uses the normalized model id for Anthropic so it matches the forward', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('anthropic', 'api_key', 'claude-sonnet-4.6'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: true,
        isChatGpt: false,
      });

      await svc.proxyRequest(baseOpts());
      expect(modelParamsService.get).toHaveBeenCalledWith(
        'agent-1',
        'tier:standard',
        'anthropic',
        'api_key',
        'claude-sonnet-4-6',
      );
    });

    it('passes the inbound body through unchanged so the per-attempt merge can re-merge each fallback', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('deepseek', 'api_key', 'deepseek-v4-flash'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await svc.proxyRequest(
        baseOpts({
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            thinking: { type: 'enabled' },
          } as never,
        }),
      );
      // The body still carries the client-supplied thinking field; the
      // fallback service applies the resolved Manifest params last.
      expect(fallbackService.tryForwardToProvider.mock.calls[0][0].body.thinking).toEqual({
        type: 'enabled',
      });
    });

    it('does not record momentum for non-scoring tiers (e.g. "default")', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'default',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 1,
        score: 0,
        reason: 'default',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      await svc.proxyRequest(baseOpts());
      expect(momentum.recordTier).not.toHaveBeenCalled();
    });

    // Telemetry snapshot proofs. The `RoutingMeta.request_params` field
    // drives the per-row Model Parameters accordion in the dashboard; these
    // tests pin (a) it gets populated for the primary provider on success,
    // (b) the snapshot is re-derived per provider so a fallback record
    // never carries another vendor's knob, and (c) providers without a
    // known param key (today: anything that isn't DeepSeek for `thinking`)
    // produce a null snapshot so existing rows stay clean.
    it("populates meta.request_params with the provider's effective default for known keys (DeepSeek thinking enabled)", async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('deepseek', 'api_key', 'deepseek-v4-flash'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      const result = await svc.proxyRequest(baseOpts());
      // No saved per-model params for this attempt, so the snapshot
      // records the provider's own natural API default. DeepSeek's
      // silent default is `enabled`.
      expect(result.meta.request_params).toEqual({ thinking: { type: 'enabled' } });
    });

    it("snapshot reflects the user's stored override when present", async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('deepseek', 'api_key', 'deepseek-v4-flash'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      modelParamsService.get.mockResolvedValueOnce({ thinking: { type: 'enabled' } });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      const result = await svc.proxyRequest(baseOpts());
      expect(result.meta.request_params).toEqual({ thinking: { type: 'enabled' } });
    });

    it('snapshot is null when the resolved model has no DB-backed param specs', async () => {
      // Forward-compat property: models that never appear in the DB-backed
      // spec catalog produce a null snapshot. New params light up by adding
      // MPS catalog entries — no proxy code needed.
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      const result = await svc.proxyRequest(baseOpts());
      expect(result.meta.request_params).toBeNull();
    });
  });

  describe('fallback chain on non-2xx responses', () => {
    beforeEach(() => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: [route('anthropic', 'api_key', 'claude')],
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
    });

    it('triggers the fallback chain on a 502 response', async () => {
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: new Response('upstream broken', { status: 502 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      fallbackService.tryFallbacks.mockResolvedValue({
        success: {
          forward: {
            response: okResponse(),
            isGoogle: false,
            isAnthropic: true,
            isChatGpt: false,
          },
          model: 'claude',
          provider: 'anthropic',
          fallbackIndex: 0,
        },
        failures: [],
      } as never);

      const result = await svc.proxyRequest(baseOpts());
      expect(result.meta.fallbackFromModel).toBe('gpt-4o');
      expect(result.meta.provider).toBe('anthropic');
      expect(result.meta.primaryProvider).toBe('openai');
    });

    it('returns the successful fallback auth_type, not the primary auth_type (#1173)', async () => {
      // Mixed-auth chain: primary openai/api_key fails, fallback
      // anthropic/subscription succeeds. The recorder reads meta.auth_type to
      // compute cost_usd (subscription => 0, api_key => priced). Returning
      // the primary's auth_type here charges or zeros the wrong row.
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: [route('anthropic', 'subscription', 'claude')],
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: new Response('rate limited', { status: 429 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      fallbackService.tryFallbacks.mockResolvedValue({
        success: {
          forward: {
            response: okResponse(),
            isGoogle: false,
            isAnthropic: true,
            isChatGpt: false,
          },
          model: 'claude',
          provider: 'anthropic',
          fallbackIndex: 0,
          authType: 'subscription',
        },
        failures: [],
      } as never);

      const result = await svc.proxyRequest(baseOpts());
      // Successful fallback row needs the FALLBACK's auth_type for correct cost.
      expect(result.meta.auth_type).toBe('subscription');
      // Primary failure row (recorded later by the response handler) needs the
      // PRIMARY's auth_type — preserved separately so we don't lose it.
      expect(result.meta.primaryAuthType).toBe('api_key');
    });

    it('records the api_key fallback auth_type when a subscription primary fails (#1173 inverse)', async () => {
      // Inverse of the previous case: subscription primary fails to a billed
      // api_key fallback. Without the fix, the success row would carry
      // auth_type=subscription and write cost_usd=0 for what was actually
      // a paid API call.
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'subscription', 'gpt-4o'),
        fallback_routes: [route('anthropic', 'api_key', 'claude')],
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: new Response('subscription expired', { status: 503 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      fallbackService.tryFallbacks.mockResolvedValue({
        success: {
          forward: {
            response: okResponse(),
            isGoogle: false,
            isAnthropic: true,
            isChatGpt: false,
          },
          model: 'claude',
          provider: 'anthropic',
          fallbackIndex: 0,
          authType: 'api_key',
        },
        failures: [],
      } as never);

      const result = await svc.proxyRequest(baseOpts());
      expect(result.meta.auth_type).toBe('api_key');
      expect(result.meta.primaryAuthType).toBe('subscription');
    });

    it('does not trigger fallback when the primary returns 200', async () => {
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(200),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      const result = await svc.proxyRequest(baseOpts());
      expect(fallbackService.tryFallbacks).not.toHaveBeenCalled();
      expect(result.forward.response.status).toBe(200);
    });

    it('returns the primary error rebuilt when all fallbacks fail', async () => {
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: new Response('upstream broken', { status: 503 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      fallbackService.tryFallbacks.mockResolvedValue({
        success: null,
        failures: [
          {
            model: 'claude',
            provider: 'anthropic',
            fallbackIndex: 0,
            status: 503,
            errorBody: 'fallback also broken',
          },
        ],
      } as never);

      const result = await svc.proxyRequest(baseOpts());
      expect(result.forward.response.status).toBe(503);
      expect(result.failedFallbacks).toHaveLength(1);
    });

    it('falls through to the resolver-provided fallback_routes', async () => {
      // resolved.fallback_routes is non-null — tier service should NOT be consulted.
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: new Response('boom', { status: 500 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      fallbackService.tryFallbacks.mockResolvedValue({
        success: {
          forward: {
            response: okResponse(),
            isGoogle: false,
            isAnthropic: true,
            isChatGpt: false,
          },
          model: 'claude',
          provider: 'anthropic',
          fallbackIndex: 0,
        },
        failures: [],
      } as never);

      await svc.proxyRequest(baseOpts());
      expect(tierService.getTiers).not.toHaveBeenCalled();
    });

    it('skips non-stream fallback routes when response mode is stream', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: [
          route('custom:local', 'api_key', 'local-model'),
          route('anthropic', 'api_key', 'claude'),
        ],
        response_mode: 'stream',
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: new Response('boom', { status: 500 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      fallbackService.tryFallbacks.mockResolvedValue({
        success: null,
        failures: [],
      } as never);

      await svc.proxyRequest(baseOpts());

      const call = fallbackService.tryFallbacks.mock.calls[0];
      expect(call[2]).toEqual(['claude']);
      expect(call[14]).toEqual([route('anthropic', 'api_key', 'claude')]);
    });

    it('does not retry a lifted stream fallback as its own fallback', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('anthropic', 'api_key', 'claude'),
        fallback_routes: null,
        response_mode: 'stream',
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'standard',
          fallback_routes: [route('anthropic', 'api_key', 'claude')],
        } as never,
      ]);
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: new Response('boom', { status: 500 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await svc.proxyRequest(baseOpts());

      expect(fallbackService.tryFallbacks).not.toHaveBeenCalled();
      expect(result.forward.response.status).toBe(500);
    });

    it('looks up tier fallbacks when the resolver returned null', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'standard',
          fallback_routes: [route('anthropic', 'api_key', 'claude')],
        } as never,
      ]);
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: new Response('boom', { status: 500 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      fallbackService.tryFallbacks.mockResolvedValue({
        success: null,
        failures: [],
      } as never);

      await svc.proxyRequest(baseOpts());
      expect(tierService.getTiers).toHaveBeenCalledWith('agent-1');
    });

    it('returns null fallback chain when neither resolver nor tier provides routes', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      tierService.getTiers.mockResolvedValue([]);
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: new Response('boom', { status: 500 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await svc.proxyRequest(baseOpts());
      // tryFallbacks not called because fallbackRoutes is empty.
      expect(fallbackService.tryFallbacks).not.toHaveBeenCalled();
      expect(result.forward.response.status).toBe(500);
    });
  });

  describe('stream warmup', () => {
    beforeEach(() => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: [route('anthropic', 'api_key', 'claude')],
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
    });

    it('returns the peeked stream when warmup succeeds', async () => {
      const streamRes = new Response(new ReadableStream(), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: streamRes,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      mockedPeek.mockResolvedValue({
        ok: true,
        stream: new ReadableStream(),
      } as never);

      const result = await svc.proxyRequest({
        ...baseOpts({ body: { messages: [{ role: 'user', content: 'hi' }], stream: true } }),
      });
      expect(result.forward.response.status).toBe(200);
      expect(mockedPeek).toHaveBeenCalledWith(streamRes.body, 15_000);
      expect(momentum.recordTier).toHaveBeenCalled();
    });

    it('falls back to the chain when warmup fails', async () => {
      const streamRes = new Response(new ReadableStream(), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: streamRes,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      mockedPeek.mockResolvedValue({
        ok: false,
        reason: 'timeout',
        message: 'peek timeout',
      } as never);
      fallbackService.tryFallbacks.mockResolvedValue({
        success: {
          forward: {
            response: okResponse(),
            isGoogle: false,
            isAnthropic: true,
            isChatGpt: false,
          },
          model: 'claude',
          provider: 'anthropic',
          fallbackIndex: 0,
        },
        failures: [],
      } as never);

      const result = await svc.proxyRequest(
        baseOpts({ body: { messages: [{ role: 'user', content: 'hi' }], stream: true } }),
      );
      expect(result.meta.fallbackFromModel).toBe('gpt-4o');
    });

    it('returns the synthetic 502 when warmup fails and no fallbacks are available', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      tierService.getTiers.mockResolvedValue([]);
      const streamRes = new Response(new ReadableStream(), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: streamRes,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      mockedPeek.mockResolvedValue({
        ok: false,
        reason: 'closed',
        message: 'closed before data',
      } as never);

      const result = await svc.proxyRequest(
        baseOpts({ body: { messages: [{ role: 'user', content: 'hi' }], stream: true } }),
      );
      expect(result.forward.response.status).toBe(502);
    });
    it('preserves isResponses on the peeked stream (warmup success path)', async () => {
      const streamRes = new Response(new ReadableStream(), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: streamRes,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
        isResponses: true,
      });
      mockedPeek.mockResolvedValue({ ok: true, stream: new ReadableStream() } as never);

      const result = await svc.proxyRequest(
        baseOpts({ body: { messages: [{ role: 'user', content: 'hi' }], stream: true } }),
      );
      expect(result.forward.isResponses).toBe(true);
    });

    it('preserves isResponses on the synthetic 502 forward (warmup failure, no fallbacks)', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      tierService.getTiers.mockResolvedValue([]);
      const streamRes = new Response(new ReadableStream(), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: streamRes,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
        isResponses: true,
      });
      mockedPeek.mockResolvedValue({
        ok: false,
        reason: 'closed',
        message: 'closed before data',
      } as never);

      const result = await svc.proxyRequest(
        baseOpts({ body: { messages: [{ role: 'user', content: 'hi' }], stream: true } }),
      );
      expect(result.forward.isResponses).toBe(true);
    });

    it('preserves isResponses on the rebuilt forward when fallbacks are exhausted', async () => {
      const streamRes = new Response('upstream error', {
        status: 500,
        headers: { 'content-type': 'text/event-stream' },
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: streamRes,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
        isResponses: true,
      });
      fallbackService.tryFallbacks.mockResolvedValue({
        success: null,
        failures: [{ model: 'claude', provider: 'anthropic', status: 500, error: 'upstream' }],
      } as never);

      const result = await svc.proxyRequest(
        baseOpts({ body: { messages: [{ role: 'user', content: 'hi' }] } }),
      );
      expect(result.forward.isResponses).toBe(true);
    });
  });

  describe('routing dispatch', () => {
    it('invokes resolveForTier with simple when the last user message contains HEARTBEAT_OK', async () => {
      resolveService.resolveForTier.mockResolvedValue({
        tier: 'simple',
        route: route('openai', 'api_key', 'gpt-4o-mini'),
        fallback_routes: null,
        confidence: 1,
        score: 0,
        reason: 'heartbeat',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await svc.proxyRequest(
        baseOpts({
          body: { messages: [{ role: 'user', content: 'HEARTBEAT_OK' }] },
        }),
      );
      expect(resolveService.resolveForTier).toHaveBeenCalledWith('agent-1', 'tenant-1', 'simple');
      expect(resolveService.resolve).not.toHaveBeenCalled();
    });

    it('detects HEARTBEAT_OK in array-content user messages', async () => {
      resolveService.resolveForTier.mockResolvedValue({
        tier: 'simple',
        route: route('openai', 'api_key', 'gpt-4o-mini'),
        fallback_routes: null,
        confidence: 1,
        score: 0,
        reason: 'heartbeat',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await svc.proxyRequest(
        baseOpts({
          body: {
            messages: [
              {
                role: 'user',
                content: [{ type: 'text', text: 'something HEARTBEAT_OK' }],
              },
            ],
          },
        }),
      );
      expect(resolveService.resolveForTier).toHaveBeenCalledWith('agent-1', 'tenant-1', 'simple');
    });

    it('does not detect heartbeat when no user message exists', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await svc.proxyRequest(
        baseOpts({
          body: { messages: [{ role: 'system', content: 'sys-only' }] },
        }),
      );
      // No user message — fall to resolve(), not resolveForTier.
      expect(resolveService.resolve).toHaveBeenCalled();
    });

    it('returns false from heartbeat detection for non-string non-array content', async () => {
      // content is an object (e.g. an image-only payload) — falls through to
      // `return false` so we route via the regular resolver instead of
      // resolveForTier('simple').
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await svc.proxyRequest(
        baseOpts({
          body: {
            messages: [{ role: 'user', content: { custom: 'object' } }],
          },
        } as never),
      );
      expect(resolveService.resolveForTier).not.toHaveBeenCalled();
      expect(resolveService.resolve).toHaveBeenCalled();
    });

    it('exercises the per-request signature, thinking, and reasoning lookup closures', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      fallbackService.tryForwardToProvider.mockImplementation(async (opts) => {
        // Invoke the lookups so coverage hits the closure bodies.
        opts.signatureLookup?.('tool-call-1');
        opts.thinkingLookup?.('first-use-1');
        opts.reasoningContentLookup?.('reasoning-call-1');
        return {
          response: okResponse(),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        };
      });

      await svc.proxyRequest(baseOpts());
      expect(signatureCache.retrieve).toHaveBeenCalledWith('sess-1', 'tool-call-1');
      expect(thinkingCache.retrieve).toHaveBeenCalledWith('sess-1', 'first-use-1');
      expect(reasoningCache.retrieve).toHaveBeenCalledWith('sess-1', 'reasoning-call-1');
    });

    it('strips system / developer roles when scoring', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
        confidence: 0.9,
        score: 5,
        reason: 'scored',
      });
      fallbackService.tryForwardToProvider.mockResolvedValue({
        response: okResponse(),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      await svc.proxyRequest(
        baseOpts({
          body: {
            messages: [
              { role: 'system', content: 'long-system-prompt' },
              { role: 'developer', content: 'developer-prompt' },
              { role: 'user', content: 'real-question' },
            ],
          },
        }),
      );
      const [, , scoringMessages] = resolveService.resolve.mock.calls[0];
      expect((scoringMessages as Array<{ role: string }>).every((m) => m.role === 'user')).toBe(
        true,
      );
    });
  });
});
