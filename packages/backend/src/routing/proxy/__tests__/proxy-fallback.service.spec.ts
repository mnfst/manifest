import { Repository } from 'typeorm';
import {
  ProxyFallbackService,
  normalizeProviderModel,
  resolveApiKey,
} from '../proxy-fallback.service';
import { ProviderKeyService } from '../../routing-core/provider-key.service';
import { CustomProvider } from '../../../entities/custom-provider.entity';
import { OpenaiOauthService } from '../../oauth/openai-oauth.service';
import { MinimaxOauthService } from '../../oauth/minimax-oauth.service';
import { ProviderClient } from '../provider-client';
import { CopilotTokenService } from '../copilot-token.service';
import { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';

describe('ProxyFallbackService', () => {
  let service: ProxyFallbackService;
  let providerKeyService: jest.Mocked<ProviderKeyService>;
  let customProviderRepo: jest.Mocked<Repository<CustomProvider>>;
  let openaiOauth: jest.Mocked<OpenaiOauthService>;
  let minimaxOauth: jest.Mocked<MinimaxOauthService>;
  let providerClient: jest.Mocked<ProviderClient>;
  let copilotToken: jest.Mocked<CopilotTokenService>;
  let pricingCache: jest.Mocked<ModelPricingCacheService>;

  beforeEach(() => {
    providerKeyService = {
      getProviderApiKey: jest.fn(),
      getAuthType: jest.fn().mockResolvedValue('api_key'),
      findProviderForModel: jest.fn().mockResolvedValue(undefined),
      getProviderRegion: jest.fn().mockResolvedValue(null),
      hasActiveProvider: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<ProviderKeyService>;

    customProviderRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<Repository<CustomProvider>>;

    openaiOauth = {
      unwrapToken: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<OpenaiOauthService>;

    minimaxOauth = {
      unwrapToken: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<MinimaxOauthService>;

    providerClient = {
      forward: jest.fn(),
    } as unknown as jest.Mocked<ProviderClient>;

    copilotToken = {
      getCopilotToken: jest.fn().mockResolvedValue('tid=copilot-session-token'),
    } as unknown as jest.Mocked<CopilotTokenService>;

    pricingCache = {
      getByModel: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelPricingCacheService>;

    service = new ProxyFallbackService(
      providerKeyService,
      customProviderRepo,
      openaiOauth,
      minimaxOauth,
      providerClient,
      copilotToken,
      pricingCache,
    );
  });

  const body = { messages: [{ role: 'user', content: 'Hello' }], stream: false };

  describe('tryForwardToProvider', () => {
    it('returns forward result on success', async () => {
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await service.tryForwardToProvider({
        provider: 'OpenAI',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: false,
        sessionKey: 'sess-1',
      });

      expect(result.response.ok).toBe(true);
    });

    it('catches transport errors and returns synthetic response', async () => {
      providerClient.forward.mockRejectedValue(new Error('fetch failed'));

      const result = await service.tryForwardToProvider({
        provider: 'OpenAI',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: false,
        sessionKey: 'sess-1',
      });

      expect(result.response.ok).toBe(false);
      expect(result.response.status).toBe(503);
    });

    it('rethrows non-transport errors', async () => {
      providerClient.forward.mockRejectedValue(new Error('boom'));

      await expect(
        service.tryForwardToProvider({
          provider: 'OpenAI',
          apiKey: 'sk-test',
          model: 'gpt-4o',
          body,
          stream: false,
          sessionKey: 'sess-1',
        }),
      ).rejects.toThrow('boom');
    });

    it('rethrows when signal is aborted', async () => {
      const ac = new AbortController();
      ac.abort();
      providerClient.forward.mockRejectedValue(new Error('aborted'));

      await expect(
        service.tryForwardToProvider({
          provider: 'OpenAI',
          apiKey: 'sk-test',
          model: 'gpt-4o',
          body,
          stream: false,
          sessionKey: 'sess-1',
          signal: ac.signal,
        }),
      ).rejects.toThrow('aborted');
    });

    it('returns timeout response for TimeoutError', async () => {
      const err = new Error('timeout');
      err.name = 'TimeoutError';
      providerClient.forward.mockRejectedValue(err);

      const result = await service.tryForwardToProvider({
        provider: 'OpenAI',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: false,
        sessionKey: 'sess-1',
      });

      expect(result.response.status).toBe(504);
    });

    it('adds x-grok-conv-id header for xai provider', async () => {
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.tryForwardToProvider({
        provider: 'xai',
        apiKey: 'sk-xai',
        model: 'grok-2',
        body,
        stream: false,
        sessionKey: 'my-session',
      });

      expect(providerClient.forward).toHaveBeenCalledWith({
        provider: 'xai',
        apiKey: 'sk-xai',
        model: 'grok-2',
        body,
        stream: false,
        extraHeaders: { 'x-grok-conv-id': 'my-session' },
      });
    });

    it('exchanges copilot token before forwarding', async () => {
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.tryForwardToProvider({
        provider: 'copilot',
        apiKey: 'ghu_token',
        model: 'copilot/claude-sonnet-4.6',
        body,
        stream: false,
        sessionKey: 'sess-1',
      });

      expect(copilotToken.getCopilotToken).toHaveBeenCalledWith('ghu_token');
      expect(providerClient.forward).toHaveBeenCalledWith({
        provider: 'copilot',
        apiKey: 'tid=copilot-session-token',
        model: 'claude-sonnet-4.6',
        body,
        stream: false,
      });
    });

    it('builds custom endpoint for custom providers', async () => {
      customProviderRepo.findOne.mockResolvedValue({
        id: 'cp-1',
        base_url: 'https://api.groq.com/openai/v1',
      } as never);
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.tryForwardToProvider({
        provider: 'custom:cp-1',
        apiKey: 'key',
        model: 'custom:cp-1/llama',
        body,
        stream: false,
        sessionKey: 'sess-1',
      });

      expect(providerClient.forward).toHaveBeenCalledWith({
        provider: 'custom:cp-1',
        apiKey: 'key',
        model: 'llama',
        body,
        stream: false,
        customEndpoint: expect.objectContaining({ baseUrl: 'https://api.groq.com/openai' }),
      });
    });

    it('uses minimax subscription base URL override', async () => {
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.tryForwardToProvider({
        provider: 'minimax',
        apiKey: 'token',
        model: 'MiniMax-M2.5',
        body,
        stream: false,
        sessionKey: 'sess-1',
        authType: 'subscription',
        resourceUrl: 'https://api.minimax.io/anthropic',
      });

      expect(providerClient.forward).toHaveBeenCalledWith({
        provider: 'minimax',
        apiKey: 'token',
        model: 'MiniMax-M2.5',
        body,
        stream: false,
        customEndpoint: expect.objectContaining({
          baseUrl: 'https://api.minimax.io/anthropic',
          format: 'anthropic',
        }),
        authType: 'subscription',
      });
    });

    it('ignores invalid minimax resource URL', async () => {
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.tryForwardToProvider({
        provider: 'minimax',
        apiKey: 'token',
        model: 'MiniMax-M2.5',
        body,
        stream: false,
        sessionKey: 'sess-1',
        authType: 'subscription',
        resourceUrl: 'not-a-valid-url',
      });

      // Should forward without custom endpoint
      expect(providerClient.forward).toHaveBeenCalledWith({
        provider: 'minimax',
        apiKey: 'token',
        model: 'MiniMax-M2.5',
        body,
        stream: false,
        authType: 'subscription',
      });
    });
  });

  describe('tryFallbacks', () => {
    it('returns success on first successful fallback', async () => {
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-ant');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: true,
        isChatGpt: false,
      });
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);

      const result = await service.tryFallbacks(
        'agent-1',
        'user-1',
        ['claude-sonnet-4'],
        body,
        false,
        'sess-1',
        'gpt-4o',
      );

      expect(result.success).not.toBeNull();
      expect(result.success!.model).toBe('claude-sonnet-4');
      expect(result.success!.provider).toBe('Anthropic');
      expect(result.success!.fallbackIndex).toBe(0);
      expect(result.failures).toHaveLength(0);
    });

    it('returns null success when all fallbacks fail', async () => {
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('error', { status: 500 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);

      const result = await service.tryFallbacks(
        'agent-1',
        'user-1',
        ['model-a'],
        body,
        false,
        'sess-1',
        'gpt-4o',
      );

      expect(result.success).toBeNull();
      expect(result.failures).toHaveLength(1);
    });

    it('skips models with no provider data', async () => {
      pricingCache.getByModel.mockReturnValue(null as never);
      providerKeyService.findProviderForModel.mockResolvedValue(undefined);

      const result = await service.tryFallbacks(
        'agent-1',
        'user-1',
        ['unknown-model'],
        body,
        false,
        'sess-1',
        'gpt-4o',
      );

      expect(result.success).toBeNull();
      expect(result.failures).toHaveLength(0);
      expect(providerClient.forward).not.toHaveBeenCalled();
    });

    it('skips models with no API key', async () => {
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);
      providerKeyService.getProviderApiKey.mockResolvedValue(null);

      const result = await service.tryFallbacks(
        'agent-1',
        'user-1',
        ['claude-sonnet-4'],
        body,
        false,
        'sess-1',
        'gpt-4o',
      );

      expect(result.success).toBeNull();
      expect(result.failures).toHaveLength(0);
    });

    it('resolves custom provider from model prefix', async () => {
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-custom');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await service.tryFallbacks(
        'agent-1',
        'user-1',
        ['custom:cp-1/my-model'],
        body,
        false,
        'sess-1',
        'gpt-4o',
      );

      expect(result.success).not.toBeNull();
      expect(result.success!.provider).toBe('custom:cp-1');
    });

    it('tries alternate auth_type for same provider when primary failed (#1272)', async () => {
      providerKeyService.getAuthType.mockImplementation(
        async (_agentId: string, _provider: string, exclude?: Set<string>) => {
          if (exclude && exclude.has('subscription')) return 'api_key';
          return 'subscription';
        },
      );
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-api-key');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: true,
        isChatGpt: false,
      });
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);

      const result = await service.tryFallbacks(
        'agent-1',
        'user-1',
        ['claude-sonnet-4'],
        body,
        false,
        'sess-1',
        'gpt-4o',
        undefined,
        'anthropic',
        'subscription',
      );

      expect(result.success).not.toBeNull();
      // getAuthType should have been called with the exclusion set
      expect(providerKeyService.getAuthType).toHaveBeenCalledWith(
        'agent-1',
        'Anthropic',
        new Set(['subscription']),
      );
      // getProviderApiKey should use the alternate auth type
      expect(providerKeyService.getProviderApiKey).toHaveBeenCalledWith(
        'agent-1',
        'Anthropic',
        'api_key',
      );
    });

    it('does not exclude auth types for different provider', async () => {
      providerKeyService.getAuthType.mockResolvedValue('api_key');
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      pricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' } as never);

      await service.tryFallbacks(
        'agent-1',
        'user-1',
        ['gpt-4o'],
        body,
        false,
        'sess-1',
        'claude-sonnet-4',
        undefined,
        'anthropic',
        'subscription',
      );

      // OpenAI is a different provider, so no exclusion set should be passed
      expect(providerKeyService.getAuthType).toHaveBeenCalledWith('agent-1', 'OpenAI', undefined);
    });

    it('accumulates failed auth types across same-provider fallbacks', async () => {
      providerKeyService.getAuthType
        .mockResolvedValueOnce('api_key')
        .mockResolvedValueOnce('api_key');
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('error', { status: 401 }),
          isGoogle: false,
          isAnthropic: true,
          isChatGpt: false,
        })
        .mockResolvedValueOnce({
          response: new Response('error', { status: 401 }),
          isGoogle: false,
          isAnthropic: true,
          isChatGpt: false,
        });
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);

      await service.tryFallbacks(
        'agent-1',
        'user-1',
        ['claude-sonnet-4', 'claude-haiku-3.5'],
        body,
        false,
        'sess-1',
        'gpt-4o',
        undefined,
        'anthropic',
        'subscription',
      );

      // First call: exclusion contains 'subscription' (from primary)
      expect(providerKeyService.getAuthType).toHaveBeenNthCalledWith(
        1,
        'agent-1',
        'Anthropic',
        new Set(['subscription']),
      );
      // Second call: exclusion now also contains 'api_key' (from first fallback failure)
      expect(providerKeyService.getAuthType).toHaveBeenNthCalledWith(
        2,
        'agent-1',
        'Anthropic',
        new Set(['subscription', 'api_key']),
      );
    });

    it('continues chain when upstream returns 424 (no longer a sentinel)', async () => {
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('upstream 424', { status: 424 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        })
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        });
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);

      const result = await service.tryFallbacks(
        'agent-1',
        'user-1',
        ['model-a', 'model-b'],
        body,
        false,
        'sess-1',
        'gpt-4o',
      );

      expect(result.success).not.toBeNull();
      expect(result.success!.model).toBe('model-b');
      expect(result.success!.fallbackIndex).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].status).toBe(424);
      expect(providerClient.forward).toHaveBeenCalledTimes(2);
    });

    it('falls through to findProviderForModel when inferred prefix provider is inactive (#1383)', async () => {
      // Model has 'anthropic/' prefix but Anthropic is disabled
      providerKeyService.hasActiveProvider.mockResolvedValue(false);
      // findProviderForModel correctly maps to OpenRouter
      providerKeyService.findProviderForModel.mockResolvedValue('openrouter');
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-or');
      pricingCache.getByModel.mockReturnValue(null as never);
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await service.tryFallbacks(
        'agent-1',
        'user-1',
        ['anthropic/claude-sonnet-4'],
        body,
        false,
        'sess-1',
        'gpt-4o',
      );

      expect(result.success).not.toBeNull();
      expect(result.success!.provider).toBe('openrouter');
      expect(providerKeyService.hasActiveProvider).toHaveBeenCalledWith('agent-1', 'anthropic');
    });
  });

  describe('normalizeProviderModel', () => {
    it('normalizes Anthropic dotted model IDs', () => {
      expect(normalizeProviderModel('Anthropic', 'claude-sonnet-4.6')).toBe('claude-sonnet-4-6');
      expect(normalizeProviderModel('anthropic', 'claude-sonnet-4.6')).toBe('claude-sonnet-4-6');
    });

    it('passes through non-Anthropic models unchanged', () => {
      expect(normalizeProviderModel('OpenAI', 'gpt-4o')).toBe('gpt-4o');
    });
  });

  describe('resolveApiKey', () => {
    it('unwraps OpenAI subscription token', async () => {
      openaiOauth.unwrapToken.mockResolvedValue('access-token');

      const result = await resolveApiKey(
        'openai',
        'blob',
        'subscription',
        'agent-1',
        'user-1',
        openaiOauth,
        minimaxOauth,
      );

      expect(result.apiKey).toBe('access-token');
      expect(openaiOauth.unwrapToken).toHaveBeenCalledWith('blob', 'agent-1', 'user-1');
    });

    it('unwraps MiniMax subscription token with resource URL', async () => {
      minimaxOauth.unwrapToken.mockResolvedValue({
        t: 'mm-token',
        r: 'mm-refresh',
        e: Date.now() + 60000,
        u: 'https://api.minimax.io',
      });

      const result = await resolveApiKey(
        'minimax',
        'blob',
        'subscription',
        'agent-1',
        'user-1',
        openaiOauth,
        minimaxOauth,
      );

      expect(result.apiKey).toBe('mm-token');
      expect(result.resourceUrl).toBe('https://api.minimax.io');
    });

    it('returns original key for non-subscription auth', async () => {
      const result = await resolveApiKey(
        'openai',
        'sk-key',
        'api_key',
        'agent-1',
        'user-1',
        openaiOauth,
        minimaxOauth,
      );

      expect(result.apiKey).toBe('sk-key');
      expect(openaiOauth.unwrapToken).not.toHaveBeenCalled();
    });

    it('returns original key when unwrap returns null', async () => {
      openaiOauth.unwrapToken.mockResolvedValue(null);

      const result = await resolveApiKey(
        'openai',
        'blob',
        'subscription',
        'agent-1',
        'user-1',
        openaiOauth,
        minimaxOauth,
      );

      expect(result.apiKey).toBe('blob');
    });

    it('does not unwrap for non-OpenAI/MiniMax subscription', async () => {
      const result = await resolveApiKey(
        'anthropic',
        'sk-ant',
        'subscription',
        'agent-1',
        'user-1',
        openaiOauth,
        minimaxOauth,
      );

      expect(result.apiKey).toBe('sk-ant');
      expect(openaiOauth.unwrapToken).not.toHaveBeenCalled();
      expect(minimaxOauth.unwrapToken).not.toHaveBeenCalled();
    });

    it('returns original key when MiniMax unwrap returns null', async () => {
      minimaxOauth.unwrapToken.mockResolvedValue(null);

      const result = await resolveApiKey(
        'minimax',
        'blob',
        'subscription',
        'agent-1',
        'user-1',
        openaiOauth,
        minimaxOauth,
      );

      expect(result.apiKey).toBe('blob');
    });

    it('returns Z.ai subscription API key unchanged (no OAuth unwrap)', async () => {
      const result = await resolveApiKey(
        'zai',
        'zai-sub-key',
        'subscription',
        'agent-1',
        'user-1',
        openaiOauth,
        minimaxOauth,
      );

      expect(result.apiKey).toBe('zai-sub-key');
      expect(result.resourceUrl).toBeUndefined();
      expect(openaiOauth.unwrapToken).not.toHaveBeenCalled();
      expect(minimaxOauth.unwrapToken).not.toHaveBeenCalled();
    });
  });
});
