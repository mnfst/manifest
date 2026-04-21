import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ProxyService } from '../proxy.service';
import { ProxyFallbackService } from '../proxy-fallback.service';
import { ResolveService } from '../../resolve/resolve.service';
import { ProviderKeyService } from '../../routing-core/provider-key.service';
import { TierService } from '../../routing-core/tier.service';
import { CustomProvider } from '../../../entities/custom-provider.entity';
import { OpenaiOauthService } from '../../oauth/openai-oauth.service';
import { MinimaxOauthService } from '../../oauth/minimax-oauth.service';
import { ProviderClient } from '../provider-client';
import { SessionMomentumService } from '../session-momentum.service';
import { CopilotTokenService } from '../copilot-token.service';
import { LimitCheckService } from '../../../notifications/services/limit-check.service';
import { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';
import { ThoughtSignatureCache } from '../thought-signature-cache';
import { ThinkingBlockCache } from '../thinking-block-cache';

describe('ProxyService', () => {
  let service: ProxyService;
  let resolveService: jest.Mocked<ResolveService>;
  let providerKeyService: jest.Mocked<ProviderKeyService>;
  let tierService: jest.Mocked<TierService>;
  let customProviderRepo: jest.Mocked<Repository<CustomProvider>>;
  let openaiOauth: jest.Mocked<OpenaiOauthService>;
  let minimaxOauth: jest.Mocked<MinimaxOauthService>;
  let providerClient: jest.Mocked<ProviderClient>;
  let momentum: SessionMomentumService;
  let copilotToken: jest.Mocked<CopilotTokenService>;
  let limitCheck: jest.Mocked<LimitCheckService>;
  let pricingCache: jest.Mocked<ModelPricingCacheService>;
  let configService: jest.Mocked<ConfigService>;
  let fallbackService: ProxyFallbackService;

  beforeEach(() => {
    resolveService = {
      resolve: jest.fn(),
    } as unknown as jest.Mocked<ResolveService>;

    providerKeyService = {
      getProviderApiKey: jest.fn(),
      getProviderRegion: jest.fn().mockResolvedValue(null),
      getAuthType: jest.fn().mockResolvedValue('api_key'),
      findProviderForModel: jest.fn().mockResolvedValue(undefined),
      hasActiveProvider: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<ProviderKeyService>;

    tierService = {
      getTiers: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<TierService>;

    providerClient = {
      forward: jest.fn(),
    } as unknown as jest.Mocked<ProviderClient>;

    momentum = new SessionMomentumService();

    copilotToken = {
      getCopilotToken: jest.fn().mockResolvedValue('tid=copilot-session-token'),
    } as unknown as jest.Mocked<CopilotTokenService>;

    limitCheck = {
      checkLimits: jest.fn().mockResolvedValue(null),
      invalidateCache: jest.fn(),
    } as unknown as jest.Mocked<LimitCheckService>;

    customProviderRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<Repository<CustomProvider>>;

    openaiOauth = {
      unwrapToken: jest.fn().mockResolvedValue(null),
      generateAuthorizationUrl: jest.fn(),
      exchangeCode: jest.fn(),
      refreshAccessToken: jest.fn(),
    } as unknown as jest.Mocked<OpenaiOauthService>;

    minimaxOauth = {
      unwrapToken: jest.fn().mockResolvedValue(null),
      startAuthorization: jest.fn(),
      pollAuthorization: jest.fn(),
      refreshAccessToken: jest.fn(),
    } as unknown as jest.Mocked<MinimaxOauthService>;

    pricingCache = {
      getByModel: jest.fn().mockReturnValue(null),
      getAll: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<ModelPricingCacheService>;

    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'app.betterAuthUrl') return 'http://localhost:3001';
        if (key === 'app.port') return 3001;
        return fallback;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    fallbackService = new ProxyFallbackService(
      providerKeyService,
      customProviderRepo,
      openaiOauth,
      minimaxOauth,
      providerClient,
      copilotToken,
      pricingCache,
    );

    service = new ProxyService(
      resolveService,
      providerKeyService,
      tierService,
      openaiOauth,
      minimaxOauth,
      momentum,
      limitCheck,
      fallbackService,
      configService,
      new ThoughtSignatureCache(),
      new ThinkingBlockCache(),
    );
  });

  afterEach(() => {
    momentum.onModuleDestroy();
  });

  const body = {
    messages: [{ role: 'user', content: 'Hello' }],
    stream: false,
  };

  it('throws BadRequestException when messages are missing', async () => {
    await expect(
      service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: {},
        sessionKey: 'default',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when messages array is empty', async () => {
    await expect(
      service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: { messages: [] },
        sessionKey: 'default',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when messages array exceeds 1000', async () => {
    const messages = Array.from({ length: 1001 }, (_, i) => ({
      role: 'user',
      content: `msg-${i}`,
    }));
    await expect(
      service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: { messages },
        sessionKey: 'default',
      }),
    ).rejects.toThrow('messages array exceeds maximum length of 1000');
  });

  it('sanitizes null content fields before forwarding', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'simple',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 0.9,
      score: 0.5,
      reason: 'scored',
    });
    providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
    providerClient.forward.mockResolvedValue({
      response: new Response('{}', { status: 200 }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });

    const body = {
      messages: [
        { role: 'assistant', content: null },
        { role: 'user', content: 'Hello' },
      ],
      stream: false,
    };

    await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body,
      sessionKey: 'default',
    });

    // Null content should have been replaced with empty string in-place
    expect(body.messages[0].content).toBe('');
    expect(body.messages[1].content).toBe('Hello');
  });

  it('does not mutate non-null content fields during sanitization', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'simple',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 0.9,
      score: 0.5,
      reason: 'scored',
    });
    providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
    providerClient.forward.mockResolvedValue({
      response: new Response('{}', { status: 200 }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });

    const body = {
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: '' },
      ],
      stream: false,
    };

    await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body,
      sessionKey: 'default',
    });

    expect(body.messages[0].content).toBe('You are helpful');
    expect(body.messages[1].content).toBe('Hello');
    expect(body.messages[2].content).toBe('');
  });

  it('sanitizes multiple null content fields in a single request', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'simple',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 0.9,
      score: 0.5,
      reason: 'scored',
    });
    providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
    providerClient.forward.mockResolvedValue({
      response: new Response('{}', { status: 200 }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });

    const body = {
      messages: [
        { role: 'assistant', content: null },
        { role: 'assistant', content: null },
        { role: 'user', content: 'test' },
      ],
      stream: false,
    };

    await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body,
      sessionKey: 'default',
    });

    expect(body.messages[0].content).toBe('');
    expect(body.messages[1].content).toBe('');
    expect(body.messages[2].content).toBe('test');
  });

  it('returns synthetic response when no model is resolved', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'simple',
      model: null,
      provider: null,
      confidence: 0.5,
      score: -0.1,
      reason: 'ambiguous',
    });

    const result = await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body,
      sessionKey: 'default',
    });

    expect(result.forward.response.ok).toBe(true);
    const json = (await result.forward.response.json()) as Record<string, unknown>;
    expect((json.id as string).startsWith('chatcmpl-manifest-')).toBe(true);
    expect(json.object).toBe('chat.completion');
    expect(json.model).toBe('manifest');
    const choices = json.choices as { message: { content: string } }[];
    expect(choices[0].message.content).toContain("You're connected");
    expect(choices[0].message.content).toContain('no providers are set up yet');
    expect(result.meta).toEqual({
      tier: 'simple',
      model: 'manifest',
      provider: 'manifest',
      confidence: 1,
      reason: 'no_provider',
    });
  });

  it('points no-provider response at the agent Routing page', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'simple',
      model: null,
      provider: null,
      confidence: 0.5,
      score: -0.1,
      reason: 'ambiguous',
    });

    const result = await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body,
      sessionKey: 'default',
      agentName: 'my-agent',
    });

    const json = (await result.forward.response.json()) as Record<string, unknown>;
    const choices = json.choices as { message: { content: string } }[];
    expect(choices[0].message.content).toContain('http://localhost:3001/agents/my-agent/routing');
  });

  it('uses bare base URL in no-provider response when agentName is missing', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'simple',
      model: null,
      provider: null,
      confidence: 0.5,
      score: -0.1,
      reason: 'ambiguous',
    });

    const result = await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body,
      sessionKey: 'default',
    });

    const json = (await result.forward.response.json()) as Record<string, unknown>;
    const choices = json.choices as { message: { content: string } }[];
    expect(choices[0].message.content).toContain('http://localhost:3001');
    expect(choices[0].message.content).not.toContain('/routing');
    expect(choices[0].message.content).not.toContain('/agents/');
  });

  it('falls back to localhost URL when betterAuthUrl is empty', async () => {
    configService.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'app.betterAuthUrl') return '';
      if (key === 'app.port') return 4000;
      return fallback;
    });

    resolveService.resolve.mockResolvedValue({
      tier: 'simple',
      model: null,
      provider: null,
      confidence: 0.5,
      score: -0.1,
      reason: 'ambiguous',
    });

    const result = await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body,
      sessionKey: 'default',
      agentName: 'test-agent',
    });

    const json = (await result.forward.response.json()) as Record<string, unknown>;
    const choices = json.choices as { message: { content: string } }[];
    expect(choices[0].message.content).toContain('http://localhost:4000/agents/test-agent/routing');
  });

  it('returns synthetic streaming response when no model is resolved', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'simple',
      model: null,
      provider: null,
      confidence: 0.5,
      score: -0.1,
      reason: 'ambiguous',
    });

    const result = await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body: { ...body, stream: true },
      sessionKey: 'default',
    });

    expect(result.forward.response.ok).toBe(true);
    const text = await result.forward.response.text();
    expect(text).toContain('data: {');
    expect(text).toContain('chat.completion.chunk');
    expect(text).toContain("You're connected");
    expect(text).toContain('data: [DONE]');
    expect(result.meta.reason).toBe('no_provider');
  });

  it('returns friendly response when no API key found for provider', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'standard',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 0.8,
      score: 0.1,
      reason: 'scored',
    });
    providerKeyService.getProviderApiKey.mockResolvedValue(null);

    const result = await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body,
      sessionKey: 'default',
      agentName: 'my-agent',
    });

    expect(result.forward.response.status).toBe(200);
    const json = (await result.forward.response.json()) as {
      choices: { message: { content: string } }[];
    };
    expect(json.choices[0].message.content).toContain('No OpenAI API key yet');
    expect(json.choices[0].message.content).toContain('/agents/my-agent/routing');
    expect(result.meta.reason).toBe('no_provider_key');
  });

  it('resolves, forwards, and records momentum on success', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'standard',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 0.8,
      score: 0.1,
      reason: 'scored',
    });
    providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');

    const mockResponse = new Response('{}', { status: 200 });
    providerClient.forward.mockResolvedValue({
      response: mockResponse,
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });

    const result = await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body,
      sessionKey: 'sess-1',
    });

    expect(result.meta).toEqual({
      tier: 'standard',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 0.8,
      reason: 'scored',
    });

    // Check momentum was recorded
    expect(momentum.getRecentTiers('sess-1')).toEqual(['standard']);

    // Verify forward was called correctly (signal is undefined when not provided)
    expect(providerClient.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'OpenAI',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: false,
      }),
    );
  });

  it('applies the stored Qwen region when resolver returns the Alibaba alias', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'standard',
      model: 'qwen3.5-flash',
      provider: 'Alibaba',
      confidence: 0.8,
      score: 0.1,
      reason: 'scored',
    });
    providerKeyService.getProviderApiKey.mockResolvedValue('sk-qwen');
    providerKeyService.getProviderRegion.mockResolvedValue('singapore');
    providerClient.forward.mockResolvedValue({
      response: new Response('{}', { status: 200 }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });

    await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body,
      sessionKey: 'sess-qwen',
    });
  });

  it('passes recentTiers from momentum to resolver', async () => {
    // Pre-populate momentum
    momentum.recordTier('sess-1', 'complex');
    momentum.recordTier('sess-1', 'complex');

    resolveService.resolve.mockResolvedValue({
      tier: 'complex',
      model: 'claude-sonnet-4',
      provider: 'Anthropic',
      confidence: 0.9,
      score: 0.2,
      reason: 'momentum',
    });
    providerKeyService.getProviderApiKey.mockResolvedValue('sk-ant');
    providerClient.forward.mockResolvedValue({
      response: new Response('{}', { status: 200 }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });

    await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body,
      sessionKey: 'sess-1',
    });

    expect(resolveService.resolve).toHaveBeenCalledWith(
      'agent-1',
      body.messages,
      undefined,
      undefined,
      undefined,
      ['complex', 'complex'],
      undefined,
      undefined,
    );
  });

  it('normalizes Anthropic dotted model ids before forwarding', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'complex',
      model: 'claude-sonnet-4.6',
      provider: 'Anthropic',
      confidence: 0.9,
      score: 0.2,
      reason: 'scored',
      auth_type: 'subscription',
    });
    providerKeyService.getProviderApiKey.mockResolvedValue('sk-ant-oat');
    providerClient.forward.mockResolvedValue({
      response: new Response('{}', { status: 200 }),
      isGoogle: false,
      isAnthropic: true,
      isChatGpt: false,
    });

    const result = await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body,
      sessionKey: 'sess-1',
    });

    expect(result.meta.model).toBe('claude-sonnet-4-6');
    expect(providerClient.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'Anthropic',
        apiKey: 'sk-ant-oat',
        model: 'claude-sonnet-4-6',
        body,
        stream: false,
        authType: 'subscription',
      }),
    );
  });

  it('passes tools and tool_choice to the resolver', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'standard',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 0.8,
      score: 0.1,
      reason: 'scored',
    });
    providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
    providerClient.forward.mockResolvedValue({
      response: new Response('{}', { status: 200 }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });

    const bodyWithTools = {
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [{ type: 'function', function: { name: 'get_weather' } }],
      tool_choice: 'auto',
      stream: false,
    };

    await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body: bodyWithTools,
      sessionKey: 'default',
    });

    // Resolver should receive tools and tool_choice for scoring
    expect(resolveService.resolve).toHaveBeenCalledWith(
      'agent-1',
      expect.any(Array),
      bodyWithTools.tools,
      bodyWithTools.tool_choice,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    // But the full body (with tools) should be forwarded to the provider
    expect(providerClient.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'OpenAI',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body: bodyWithTools,
        stream: false,
      }),
    );
  });

  it('passes AbortSignal through to providerClient.forward', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'standard',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 0.8,
      score: 0.1,
      reason: 'scored',
    });
    providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
    providerClient.forward.mockResolvedValue({
      response: new Response('{}', { status: 200 }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    });

    const abortController = new AbortController();
    await service.proxyRequest({
      agentId: 'agent-1',
      userId: 'user-1',
      body,
      sessionKey: 'default',
      tenantId: undefined,
      agentName: undefined,
      signal: abortController.signal,
    });

    expect(providerClient.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'OpenAI',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        body,
        stream: false,
        signal: abortController.signal,
      }),
    );
  });

  describe('heartbeat detection', () => {
    const heartbeatBody = {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        {
          role: 'user',
          content: 'Check tasks and reply HEARTBEAT_OK if nothing needs attention.',
        },
      ],
      stream: false,
    };

    it('routes heartbeat prompts to simple tier via resolveForTier', async () => {
      resolveService.resolveForTier = jest.fn().mockResolvedValue({
        tier: 'simple',
        model: 'gpt-4o-mini',
        provider: 'OpenAI',
        confidence: 1,
        score: 0,
        reason: 'heartbeat',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: heartbeatBody,
        sessionKey: 'sess-1',
      });

      expect(resolveService.resolveForTier).toHaveBeenCalledWith('agent-1', 'simple');
      expect(resolveService.resolve).not.toHaveBeenCalled();
      expect(result.meta.tier).toBe('simple');
      expect(result.meta.model).toBe('gpt-4o-mini');
    });

    it('forwards the full unmodified body for heartbeat requests', async () => {
      resolveService.resolveForTier = jest.fn().mockResolvedValue({
        tier: 'simple',
        model: 'gpt-4o-mini',
        provider: 'OpenAI',
        confidence: 1,
        score: 0,
        reason: 'heartbeat',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: heartbeatBody,
        sessionKey: 'sess-1',
      });

      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'OpenAI',
          apiKey: 'sk-test',
          model: 'gpt-4o-mini',
          body: heartbeatBody,
          stream: false,
        }),
      );
    });

    it('does NOT detect heartbeat when HEARTBEAT_OK is only in an earlier user message', async () => {
      const buriedHeartbeatBody = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          {
            role: 'user',
            content: 'Check tasks and reply HEARTBEAT_OK if nothing needs attention.',
          },
          { role: 'assistant', content: 'HEARTBEAT_OK' },
          { role: 'user', content: 'Thanks, anything else?' },
        ],
        stream: false,
      };

      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 5,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: buriedHeartbeatBody,
        sessionKey: 'sess-1',
      });

      expect(resolveService.resolve).toHaveBeenCalled();
      expect(result.meta.tier).toBe('standard');
      expect(result.meta.reason).toBe('scored');
    });

    it('detects heartbeat when HEARTBEAT_OK is in the last user message with prior history', async () => {
      const lastMsgHeartbeatBody = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'What is the weather?' },
          { role: 'assistant', content: 'It is sunny.' },
          {
            role: 'user',
            content: 'Check tasks and reply HEARTBEAT_OK if nothing needs attention.',
          },
        ],
        stream: false,
      };

      resolveService.resolveForTier = jest.fn().mockResolvedValue({
        tier: 'simple',
        model: 'gpt-4o-mini',
        provider: 'OpenAI',
        confidence: 1,
        score: 0,
        reason: 'heartbeat',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: lastMsgHeartbeatBody,
        sessionKey: 'sess-1',
      });

      expect(resolveService.resolveForTier).toHaveBeenCalledWith('agent-1', 'simple');
      expect(resolveService.resolve).not.toHaveBeenCalled();
      expect(result.meta.tier).toBe('simple');
      expect(result.meta.reason).toBe('heartbeat');
    });

    it('detects heartbeat when HEARTBEAT_OK is in array content parts', async () => {
      const arrayContentBody = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Check tasks and reply HEARTBEAT_OK if nothing needs attention.',
              },
            ],
          },
        ],
        stream: false,
      };

      resolveService.resolveForTier = jest.fn().mockResolvedValue({
        tier: 'simple',
        model: 'gpt-4o-mini',
        provider: 'OpenAI',
        confidence: 1,
        score: 0,
        reason: 'heartbeat',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: arrayContentBody,
        sessionKey: 'sess-1',
      });

      expect(resolveService.resolveForTier).toHaveBeenCalledWith('agent-1', 'simple');
      expect(result.meta.tier).toBe('simple');
      expect(result.meta.reason).toBe('heartbeat');
    });

    it('does not treat non-string non-array content as heartbeat', async () => {
      const objectContentBody = {
        messages: [
          {
            role: 'user',
            content: { type: 'image_url', image_url: 'data:image/png;base64,...' },
          },
        ],
        stream: false,
      };

      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: objectContentBody,
        sessionKey: 'default',
      });

      // Should NOT be routed as heartbeat
      expect(resolveService.resolve).toHaveBeenCalled();
      expect(result.meta.reason).toBe('scored');
    });

    it('does not detect heartbeat when user content is null (non-string, non-array)', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'simple',
        model: 'gpt-4o-mini',
        provider: 'OpenAI',
        confidence: 0.9,
        score: -0.3,
        reason: 'short_message',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const bodyWithNullContent = {
        messages: [{ role: 'user', content: null }],
        stream: false,
      };

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: bodyWithNullContent,
        sessionKey: 'default',
      });

      // Should use resolve (not resolveForTier) since heartbeat is not detected
      expect(resolveService.resolve).toHaveBeenCalled();
    });

    it('does not detect heartbeat when HEARTBEAT_OK is absent', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(resolveService.resolve).toHaveBeenCalled();
    });
  });

  describe('system prompt stripping', () => {
    const setupMocks = () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'simple',
        model: 'gpt-4o-mini',
        provider: 'OpenAI',
        confidence: 0.9,
        score: -0.3,
        reason: 'short_message',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
    };

    it('strips system and developer messages before scoring', async () => {
      setupMocks();

      const bodyWithSystem = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant with lots of keywords...' },
          { role: 'developer', content: 'Internal developer instructions...' },
          { role: 'user', content: 'hi' },
        ],
        stream: false,
      };

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: bodyWithSystem,
        sessionKey: 'default',
      });

      // Scorer should only receive the user message (system/developer stripped)
      const scoredMessages = resolveService.resolve.mock.calls[0][1];
      expect(scoredMessages).toEqual([{ role: 'user', content: 'hi' }]);
    });

    it('forwards the full unmodified body to the provider', async () => {
      setupMocks();

      const bodyWithSystem = {
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'hi' },
        ],
        stream: false,
      };

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: bodyWithSystem,
        sessionKey: 'default',
      });

      // Provider should get the FULL body including system messages
      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'OpenAI',
          apiKey: 'sk-test',
          model: 'gpt-4o-mini',
          body: bodyWithSystem,
          stream: false,
        }),
      );
    });

    it('limits scoring to last 10 non-system messages', async () => {
      setupMocks();

      // Build a conversation with 15 user messages + system
      const messages = [
        { role: 'system', content: 'System prompt' },
        ...Array.from({ length: 15 }, (_, i) => ({
          role: 'user',
          content: `Message ${i}`,
        })),
      ];

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: { messages, stream: false },
        sessionKey: 'default',
      });

      const scoredMessages = resolveService.resolve.mock.calls[0][1];
      expect(scoredMessages).toHaveLength(10);
      // Should be the last 10 user messages (5-14)
      expect(scoredMessages[0].content).toBe('Message 5');
      expect(scoredMessages[9].content).toBe('Message 14');
    });
  });

  describe('limit checking', () => {
    const setupSuccessMocks = () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
    };

    it('returns friendly response when limit is exceeded', async () => {
      limitCheck.checkLimits.mockResolvedValue({
        ruleId: 'r1',
        metricType: 'tokens',
        threshold: 50000,
        actual: 52000,
        period: 'day',
      });

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
        tenantId: 'tenant-1',
        agentName: 'my-agent',
      });

      expect(result.forward.response.status).toBe(200);
      const json = (await result.forward.response.json()) as {
        choices: { message: { content: string } }[];
      };
      expect(json.choices[0].message.content).toContain('You hit your tokens limit');
      expect(json.choices[0].message.content).toContain(
        'http://localhost:3001/agents/my-agent/limits',
      );
      expect(result.meta.reason).toBe('limit_exceeded');
    });

    it('does not check limits when tenantId/agentName are not provided', async () => {
      setupSuccessMocks();

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(limitCheck.checkLimits).not.toHaveBeenCalled();
    });

    it('does not check limits when only tenantId is provided without agentName', async () => {
      setupSuccessMocks();

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
        tenantId: 'tenant-1',
      });

      expect(limitCheck.checkLimits).not.toHaveBeenCalled();
    });

    it('does not check limits when only agentName is provided without tenantId', async () => {
      setupSuccessMocks();

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
        tenantId: undefined,
        agentName: 'my-agent',
      });

      expect(limitCheck.checkLimits).not.toHaveBeenCalled();
    });

    it('proceeds normally when no limit is exceeded', async () => {
      setupSuccessMocks();
      limitCheck.checkLimits.mockResolvedValue(null);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
        tenantId: 'tenant-1',
        agentName: 'my-agent',
      });

      expect(limitCheck.checkLimits).toHaveBeenCalledWith('tenant-1', 'my-agent');
      expect(result.meta.model).toBe('gpt-4o');
    });

    it('formats cost limit with dollar sign and 2 decimal places', async () => {
      limitCheck.checkLimits.mockResolvedValue({
        ruleId: 'r2',
        metricType: 'cost',
        threshold: 10.0,
        actual: 12.5,
        period: 'month',
      });

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
        tenantId: 'tenant-1',
        agentName: 'my-agent',
      });

      const json = (await result.forward.response.json()) as {
        choices: { message: { content: string } }[];
      };
      expect(json.choices[0].message.content).toContain('$12.50');
      expect(json.choices[0].message.content).toContain('$10.00');
      expect(json.choices[0].message.content).toContain('/month');
    });

    it('formats token limit with locale string', async () => {
      limitCheck.checkLimits.mockResolvedValue({
        ruleId: 'r3',
        metricType: 'tokens',
        threshold: 100000,
        actual: 105000,
        period: 'day',
      });

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
        tenantId: 'tenant-1',
        agentName: 'my-agent',
      });

      const json = (await result.forward.response.json()) as {
        choices: { message: { content: string } }[];
      };
      // toLocaleString formats numbers with commas
      expect(json.choices[0].message.content).toContain('105,000');
      expect(json.choices[0].message.content).toContain('100,000');
      expect(json.choices[0].message.content).toContain('/day');
    });
  });

  describe('max_tokens forwarding', () => {
    it('passes max_tokens to the resolver', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const bodyWithMaxTokens = {
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 4096,
        stream: false,
      };

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: bodyWithMaxTokens,
        sessionKey: 'default',
      });

      expect(resolveService.resolve).toHaveBeenCalledWith(
        'agent-1',
        expect.any(Array),
        undefined,
        undefined,
        4096,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('xai extra headers', () => {
    it('passes x-grok-conv-id header for xai provider', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'grok-2',
        provider: 'xai',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-xai-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'my-session',
      });

      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'xai',
          apiKey: 'sk-xai-test',
          model: 'grok-2',
          body,
          stream: false,
          extraHeaders: { 'x-grok-conv-id': 'my-session' },
        }),
      );
    });
  });

  describe('scoring edge cases', () => {
    it('skips assistant messages when checking for heartbeat', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const bodyWithAssistant = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'HEARTBEAT_OK assistant message' },
          { role: 'user', content: 'Continue' },
        ],
        stream: false,
      };

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: bodyWithAssistant,
        sessionKey: 'default',
      });

      // Heartbeat check skips non-user messages, so HEARTBEAT_OK in assistant is ignored.
      // resolve (not resolveForTier) should be called.
      expect(resolveService.resolve).toHaveBeenCalled();
    });

    it('handles body where all messages are system/developer (empty scoring list)', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'simple',
        model: 'gpt-4o-mini',
        provider: 'OpenAI',
        confidence: 0.9,
        score: -0.3,
        reason: 'short_message',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const bodyWithOnlySystem = {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'developer', content: 'Internal instructions' },
        ],
        stream: false,
      };

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body: bodyWithOnlySystem,
        sessionKey: 'default',
      });

      // Scorer receives empty array after filtering
      const scoredMessages = resolveService.resolve.mock.calls[0][1];
      expect(scoredMessages).toEqual([]);

      // But the full body is forwarded to the provider
      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'OpenAI',
          apiKey: 'sk-test',
          model: 'gpt-4o-mini',
          body: bodyWithOnlySystem,
          stream: false,
        }),
      );
    });
  });

  describe('custom provider resolution', () => {
    it('builds custom endpoint and strips model prefix for custom provider', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'custom:cp-uuid/llama-3.1-70b',
        provider: 'custom:cp-uuid',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('gsk_test');
      customProviderRepo.findOne.mockResolvedValue({
        id: 'cp-uuid',
        agent_id: 'agent-1',
        user_id: 'user-1',
        base_url: 'https://api.groq.com/openai/v1',
        name: 'Groq',
        models: [],
        created_at: '2026-03-04T00:00:00Z',
      } as never);
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess-1',
      });

      expect(customProviderRepo.findOne).toHaveBeenCalledWith({ where: { id: 'cp-uuid' } });
      // Forward should use the raw model name (without custom prefix)
      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'custom:cp-uuid',
          apiKey: 'gsk_test',
          model: 'llama-3.1-70b',
          body,
          stream: false,
          customEndpoint: expect.objectContaining({
            baseUrl: 'https://api.groq.com/openai',
            format: 'openai',
          }),
        }),
      );
      expect(result.meta.provider).toBe('custom:cp-uuid');
    });

    it('falls back to normal forwarding when custom provider not found in DB', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'custom:cp-missing/model',
        provider: 'custom:cp-missing',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('key');
      customProviderRepo.findOne.mockResolvedValue(null);
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess-1',
      });

      // No custom endpoint — forward without it
      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'custom:cp-missing',
          apiKey: 'key',
          model: 'custom:cp-missing/model',
          body,
          stream: false,
        }),
      );
    });
  });

  describe('copilot token exchange', () => {
    it('exchanges GitHub token for Copilot API token before forwarding', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'copilot/claude-sonnet-4.6',
        provider: 'copilot',
        confidence: 0.9,
        score: 0.5,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('ghu_github_oauth_token');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess-1',
      });

      expect(copilotToken.getCopilotToken).toHaveBeenCalledWith('ghu_github_oauth_token');
      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'copilot',
          apiKey: 'tid=copilot-session-token',
          model: 'claude-sonnet-4.6',
          body,
          stream: false,
        }),
      );
    });

    it('does not strip prefix for copilot models without copilot/ prefix', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'copilot',
        confidence: 0.9,
        score: 0.5,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('ghu_token');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess-1',
      });

      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'copilot',
          apiKey: 'tid=copilot-session-token',
          model: 'gpt-4o',
          body,
          stream: false,
        }),
      );
    });

    it('does not exchange token for non-copilot providers', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'openai',
        confidence: 0.9,
        score: 0.5,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-openai-key');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess-1',
      });

      expect(copilotToken.getCopilotToken).not.toHaveBeenCalled();
      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          apiKey: 'sk-openai-key',
          model: 'gpt-4o',
          body,
          stream: false,
        }),
      );
    });
  });

  describe('empty-string API key passthrough', () => {
    it('allows empty-string API key (Ollama) without throwing', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'simple',
        model: 'llama3',
        provider: 'Ollama',
        confidence: 0.7,
        score: -0.2,
        reason: 'scored',
      });
      // Ollama returns '' (empty string, not null)
      providerKeyService.getProviderApiKey.mockResolvedValue('');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(result.meta.provider).toBe('Ollama');
      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'Ollama',
          apiKey: '',
          model: 'llama3',
          body,
          stream: false,
        }),
      );
    });
  });

  describe('subscription provider with stored token', () => {
    it('proxies subscription providers using their stored token', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'claude-sonnet-4',
        provider: 'Anthropic',
        confidence: 0.9,
        score: 0.2,
        reason: 'scored',
        auth_type: 'subscription',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('skst-token-123');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess-1',
      });

      expect(result.meta.provider).toBe('Anthropic');
      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'Anthropic',
          apiKey: 'skst-token-123',
          model: 'claude-sonnet-4',
          body,
          stream: false,
          authType: 'subscription',
        }),
      );
    });

    it('returns friendly response for subscription provider without stored token', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'claude-sonnet-4',
        provider: 'Anthropic',
        confidence: 0.9,
        score: 0.2,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue(null);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess-1',
      });

      expect(result.forward.response.status).toBe(200);
      const json = (await result.forward.response.json()) as {
        choices: { message: { content: string } }[];
      };
      expect(json.choices[0].message.content).toContain('No Anthropic API key yet');
      expect(result.meta.reason).toBe('no_provider_key');
    });
  });

  describe('fallback retry logic', () => {
    it('does not attempt fallbacks when primary succeeds', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(tierService.getTiers).not.toHaveBeenCalled();
      expect(result.meta.fallbackFromModel).toBeUndefined();
      expect(result.meta.fallbackIndex).toBeUndefined();
    });

    it('tries specificity fallback models before tier fallbacks when a specific-tier route fails', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-5.4',
        provider: 'OpenAI',
        confidence: 0.95,
        score: 0,
        reason: 'specificity',
        specificity_category: 'coding',
        fallback_models: ['claude-sonnet-4'],
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-openai')
        .mockResolvedValueOnce('sk-ant');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('error', { status: 429 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        })
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: true,
          isChatGpt: false,
        });
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: null },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(result.meta.fallbackFromModel).toBe('gpt-5.4');
      expect(result.meta.fallbackIndex).toBe(0);
      expect(result.meta.primaryErrorStatus).toBe(429);
      expect(result.meta.model).toBe('claude-sonnet-4');
      expect(result.meta.specificity_category).toBe('coding');
    });

    it('tries fallback model when primary returns 429', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-test')
        .mockResolvedValueOnce('sk-ant');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('error', { status: 429 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        })
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: true,
          isChatGpt: false,
        });
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['claude-sonnet-4'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(result.meta.fallbackFromModel).toBe('gpt-4o');
      expect(result.meta.fallbackIndex).toBe(0);
      expect(result.meta.primaryErrorStatus).toBe(429);
      expect(result.meta.primaryErrorBody).toBe('error');
      expect(result.meta.model).toBe('claude-sonnet-4');
    });

    it('tries fallback model when primary throws a transport error', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-test')
        .mockResolvedValueOnce('sk-ant');
      providerClient.forward
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: true,
          isChatGpt: false,
        });
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['claude-sonnet-4'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });
      const primaryError = JSON.parse(result.meta.primaryErrorBody ?? '{}') as {
        error?: { message?: string };
      };

      expect(result.meta.fallbackFromModel).toBe('gpt-4o');
      expect(result.meta.fallbackIndex).toBe(0);
      expect(result.meta.primaryErrorStatus).toBe(503);
      expect(primaryError.error?.message).toBe('Failed to reach upstream provider');
      expect(result.meta.model).toBe('claude-sonnet-4');
    });

    it('sanitizes transport error details when no fallback models are configured', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockRejectedValue(
        new TypeError('Failed to parse URL from https://bad.example/v1?key=secret-token'),
      );
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: null },
      ] as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });
      const errorBody = JSON.parse(await result.forward.response.text()) as {
        error?: { message?: string };
      };

      expect(result.forward.response.status).toBe(503);
      expect(errorBody.error?.message).toBe(
        'Failed to reach upstream provider: Failed to parse URL from https://bad.example/v1?key=***',
      );
    });

    it('tries fallback model when primary returns 400', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'simple',
        model: 'gpt-5.1-codex-mini',
        provider: 'OpenAI',
        confidence: 0.7,
        score: 0.1,
        reason: 'scored',
        auth_type: 'subscription',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('skst-openai')
        .mockResolvedValueOnce('sk-deepseek');
      providerKeyService.getAuthType.mockResolvedValueOnce('api_key');
      openaiOauth.unwrapToken.mockResolvedValueOnce('oauth-openai');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('{"detail":"Instructions are required"}', { status: 400 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: true,
        })
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        });
      tierService.getTiers.mockResolvedValue([
        { tier: 'simple', fallback_models: ['deepseek-chat'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'DeepSeek' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(result.meta.fallbackFromModel).toBe('gpt-5.1-codex-mini');
      expect(result.meta.fallbackIndex).toBe(0);
      expect(result.meta.primaryErrorStatus).toBe(400);
      expect(result.meta.primaryErrorBody).toBe('{"detail":"Instructions are required"}');
      expect(result.meta.model).toBe('deepseek-chat');
      expect(result.meta.provider).toBe('DeepSeek');
      expect(providerClient.forward).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          provider: 'OpenAI',
          apiKey: 'oauth-openai',
          model: 'gpt-5.1-codex-mini',
          body,
          stream: false,
          authType: 'subscription',
        }),
      );
      expect(providerClient.forward).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          provider: 'DeepSeek',
          apiKey: 'sk-deepseek',
          model: 'deepseek-chat',
          body,
          stream: false,
          authType: 'api_key',
        }),
      );
    });

    it('returns original error when no fallback models configured', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('error', { status: 500 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: null },
      ] as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(result.forward.response.ok).toBe(false);
    });

    it('skips fallback model with no pricing data', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-test')
        .mockResolvedValueOnce('sk-ant');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('error', { status: 502 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        })
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: true,
          isChatGpt: false,
        });
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['unknown-model', 'claude-sonnet-4'] },
      ] as never);
      pricingCache.getByModel
        .mockReturnValueOnce(null as never)
        .mockReturnValueOnce({ provider: 'Anthropic' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(result.meta.model).toBe('claude-sonnet-4');
      expect(result.meta.fallbackIndex).toBe(1);
    });

    it('skips fallback model when provider has no API key configured', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      // Primary key, then null for first fallback provider, then valid for second
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-test') // primary
        .mockResolvedValueOnce(null) // first fallback: no API key
        .mockResolvedValueOnce('sk-deepseek'); // second fallback
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('overloaded', { status: 500 }),
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
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['claude-sonnet-4', 'deepseek-chat'] },
      ] as never);
      pricingCache.getByModel
        .mockReturnValueOnce({ provider: 'Anthropic' } as never) // first fallback has pricing
        .mockReturnValueOnce({ provider: 'DeepSeek' } as never); // second fallback has pricing

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      // First fallback (claude-sonnet-4) skipped because getProviderApiKey returned null
      // Second fallback (deepseek-chat) succeeded
      expect(result.meta.model).toBe('deepseek-chat');
      expect(result.meta.fallbackIndex).toBe(1);
      // forward was called only twice: primary + second fallback (first was skipped)
      expect(providerClient.forward).toHaveBeenCalledTimes(2);
      expect(result.failedFallbacks).toHaveLength(0);
    });

    it('continues fallback chain through retriable errors', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-test')
        .mockResolvedValueOnce('sk-a')
        .mockResolvedValueOnce('sk-b');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('overloaded', { status: 500 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        })
        .mockResolvedValueOnce({
          response: new Response('rate limited', { status: 429 }),
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
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['model-a', 'model-b'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'ProvA' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(result.meta.model).toBe('model-b');
      expect(result.meta.fallbackIndex).toBe(1);
      expect(providerClient.forward).toHaveBeenCalledTimes(3);
      expect(result.failedFallbacks).toHaveLength(1);
      expect(result.failedFallbacks![0]).toEqual({
        model: 'model-a',
        provider: 'ProvA',
        fallbackIndex: 0,
        status: 429,
        errorBody: 'rate limited',
      });
    });

    it('continues fallback chain when a fallback throws a timeout error', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      const timeoutError = new Error('The operation was aborted due to timeout');
      timeoutError.name = 'TimeoutError';

      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-test')
        .mockResolvedValueOnce('sk-a')
        .mockResolvedValueOnce('sk-b');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('overloaded', { status: 500 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        })
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        });
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['model-a', 'model-b'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'ProvA' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });
      const fallbackError = JSON.parse(result.failedFallbacks?.[0].errorBody ?? '{}') as {
        error?: { message?: string };
      };

      expect(result.meta.model).toBe('model-b');
      expect(result.meta.fallbackIndex).toBe(1);
      expect(result.failedFallbacks).toHaveLength(1);
      expect(result.failedFallbacks?.[0].status).toBe(504);
      expect(fallbackError.error?.message).toBe('Upstream provider request timed out');
    });

    it('treats upstream 424 as retriable and continues fallback chain', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-test')
        .mockResolvedValueOnce('sk-a')
        .mockResolvedValueOnce('sk-b');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('overloaded', { status: 500 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        })
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
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['model-a', 'model-b'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'ProvA' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      // model-a returned 424, model-b was tried and succeeded
      expect(result.forward.response.ok).toBe(true);
      expect(providerClient.forward).toHaveBeenCalledTimes(3);
      expect(result.failedFallbacks).toHaveLength(1);
      expect(result.failedFallbacks![0].status).toBe(424);
    });

    it('does not attempt fallbacks when primary returns a redirect', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('redirect', { status: 301 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(tierService.getTiers).not.toHaveBeenCalled();
      expect(result.forward.response.status).toBe(301);
    });

    it('rethrows aborted provider requests instead of treating them as fallback failures', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockRejectedValue(new Error('aborted'));

      const abortController = new AbortController();
      abortController.abort();

      await expect(
        service.proxyRequest({
          agentId: 'agent-1',
          userId: 'user-1',
          body,
          sessionKey: 'default',
          tenantId: undefined,
          agentName: undefined,
          signal: abortController.signal,
        }),
      ).rejects.toThrow('aborted');

      expect(tierService.getTiers).not.toHaveBeenCalled();
    });

    it('rethrows non-transport provider errors', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockRejectedValue(new Error('boom'));

      await expect(
        service.proxyRequest({ agentId: 'agent-1', userId: 'user-1', body, sessionKey: 'default' }),
      ).rejects.toThrow('boom');

      expect(tierService.getTiers).not.toHaveBeenCalled();
    });

    it('falls back from api_key primary to subscription fallback model', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
        auth_type: 'api_key',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-openai') // primary
        .mockResolvedValueOnce('skst-anthropic-token'); // fallback (subscription)
      // getAuthType returns subscription for the fallback provider
      providerKeyService.getAuthType.mockResolvedValueOnce('subscription');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('rate limited', { status: 429 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        })
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: true,
          isChatGpt: false,
        });
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['claude-sonnet-4'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(result.meta.fallbackFromModel).toBe('gpt-4o');
      expect(result.meta.model).toBe('claude-sonnet-4');
      expect(result.meta.provider).toBe('Anthropic');
      expect(result.meta.primaryErrorStatus).toBe(429);
      // Primary was called with api_key auth_type
      expect(providerClient.forward).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          provider: 'OpenAI',
          apiKey: 'sk-openai',
          model: 'gpt-4o',
          body,
          stream: false,
          authType: 'api_key',
        }),
      );
      // Fallback resolves auth_type via getAuthType and passes subscription
      expect(providerClient.forward).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          provider: 'Anthropic',
          apiKey: 'skst-anthropic-token',
          model: 'claude-sonnet-4',
          body,
          stream: false,
          authType: 'subscription',
        }),
      );
      // getAuthType was called for the fallback provider (different provider, no exclusions)
      expect(providerKeyService.getAuthType).toHaveBeenCalledWith(
        'agent-1',
        'Anthropic',
        undefined,
      );
      // getProviderApiKey was called with subscription for the fallback
      expect(providerKeyService.getProviderApiKey).toHaveBeenNthCalledWith(
        2,
        'agent-1',
        'Anthropic',
        'subscription',
      );
    });

    it('normalizes Anthropic dotted fallback ids before forwarding', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
        auth_type: 'api_key',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-openai')
        .mockResolvedValueOnce('skst-anthropic-token');
      providerKeyService.getAuthType.mockResolvedValueOnce('subscription');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('rate limited', { status: 429 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        })
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: true,
          isChatGpt: false,
        });
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['claude-sonnet-4.6'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(result.meta.model).toBe('claude-sonnet-4-6');
      expect(providerClient.forward).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          provider: 'Anthropic',
          apiKey: 'skst-anthropic-token',
          model: 'claude-sonnet-4-6',
          body,
          stream: false,
          authType: 'subscription',
        }),
      );
    });

    it('falls back from subscription primary to api_key fallback model', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'complex',
        model: 'claude-sonnet-4',
        provider: 'Anthropic',
        confidence: 0.9,
        score: 0.2,
        reason: 'scored',
        auth_type: 'subscription',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('skst-token') // primary (subscription)
        .mockResolvedValueOnce('sk-openai'); // fallback (api_key)
      // getAuthType returns api_key for the fallback provider (OpenAI)
      providerKeyService.getAuthType.mockResolvedValueOnce('api_key');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('overloaded', { status: 503 }),
          isGoogle: false,
          isAnthropic: true,
          isChatGpt: false,
        })
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        });
      tierService.getTiers.mockResolvedValue([
        { tier: 'complex', fallback_models: ['gpt-4o'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(result.meta.fallbackFromModel).toBe('claude-sonnet-4');
      expect(result.meta.model).toBe('gpt-4o');
      expect(result.meta.provider).toBe('OpenAI');
      // Primary forwarded with subscription auth_type
      expect(providerClient.forward).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          provider: 'Anthropic',
          apiKey: 'skst-token',
          model: 'claude-sonnet-4',
          body,
          stream: false,
          authType: 'subscription',
        }),
      );
      // Fallback forwarded with api_key auth_type
      expect(providerClient.forward).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          provider: 'OpenAI',
          apiKey: 'sk-openai',
          model: 'gpt-4o',
          body,
          stream: false,
          authType: 'api_key',
        }),
      );
    });

    it('falls back between two subscription providers', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'claude-sonnet-4',
        provider: 'Anthropic',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
        auth_type: 'subscription',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('skst-anthropic') // primary (subscription)
        .mockResolvedValueOnce('skst-google'); // fallback (subscription)
      // getAuthType returns subscription for the fallback provider too
      providerKeyService.getAuthType.mockResolvedValueOnce('subscription');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('server error', { status: 500 }),
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
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['gemini-2.5-flash'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'Google' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(result.meta.fallbackFromModel).toBe('claude-sonnet-4');
      expect(result.meta.model).toBe('gemini-2.5-flash');
      expect(result.meta.provider).toBe('Google');
      expect(result.meta.fallbackIndex).toBe(0);
      // Fallback forwarded with subscription auth_type
      expect(providerClient.forward).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          provider: 'Google',
          apiKey: 'skst-google',
          model: 'gemini-2.5-flash',
          body,
          stream: false,
          authType: 'subscription',
        }),
      );
    });

    it('skips fallback model with subscription auth but no stored token', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
        auth_type: 'api_key',
      });
      // getAuthType returns subscription for Anthropic, api_key for DeepSeek
      providerKeyService.getAuthType
        .mockResolvedValueOnce('subscription')
        .mockResolvedValueOnce('api_key');
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-openai') // primary
        .mockResolvedValueOnce(null) // first fallback: subscription with no token
        .mockResolvedValueOnce('sk-deepseek'); // second fallback: has key
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('rate limited', { status: 429 }),
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
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['claude-sonnet-4', 'deepseek-chat'] },
      ] as never);
      pricingCache.getByModel
        .mockReturnValueOnce({ provider: 'Anthropic' } as never)
        .mockReturnValueOnce({ provider: 'DeepSeek' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      // Anthropic fallback skipped (subscription with no token), DeepSeek succeeded
      expect(result.meta.model).toBe('deepseek-chat');
      expect(result.meta.provider).toBe('DeepSeek');
      expect(result.meta.fallbackIndex).toBe(1);
      // forward called twice: primary + second fallback (first was skipped)
      expect(providerClient.forward).toHaveBeenCalledTimes(2);
      expect(result.failedFallbacks).toHaveLength(0);
      // Verify getAuthType was called for both fallback providers (different from primary, no exclusions)
      expect(providerKeyService.getAuthType).toHaveBeenCalledWith(
        'agent-1',
        'Anthropic',
        undefined,
      );
      expect(providerKeyService.getAuthType).toHaveBeenCalledWith('agent-1', 'DeepSeek', undefined);
    });

    it('resolves fallback provider via findProviderForModel when pricing and name inference fail', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-test') // primary
        .mockResolvedValueOnce('sk-niche'); // fallback
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('auth error', { status: 401 }),
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
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['niche-model-v1'] },
      ] as never);
      // No pricing data for this model
      pricingCache.getByModel.mockReturnValue(null as never);
      // inferProviderFromModelName returns undefined (no slash prefix)
      // findProviderForModel finds it in the user's connected providers
      providerKeyService.findProviderForModel.mockResolvedValue('niche-provider');

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(providerKeyService.findProviderForModel).toHaveBeenCalledWith(
        'agent-1',
        'niche-model-v1',
      );
      expect(result.meta.model).toBe('niche-model-v1');
      expect(result.meta.provider).toBe('niche-provider');
      expect(result.meta.fallbackFromModel).toBe('gpt-4o');
      expect(result.meta.fallbackIndex).toBe(0);
      expect(result.meta.primaryErrorStatus).toBe(401);
    });

    it('resolves custom provider fallback via model prefix', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-test')
        .mockResolvedValueOnce('sk-custom');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('error', { status: 500 }),
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
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['custom:cp-abc/my-model'] },
      ] as never);
      customProviderRepo.findOne.mockResolvedValue({
        base_url: 'https://my-endpoint.com/v1',
      } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(result.meta.model).toBe('custom:cp-abc/my-model');
      expect(result.meta.fallbackFromModel).toBe('gpt-4o');
    });

    it('returns all failed fallbacks when all fail', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'simple',
        model: 'gemini-flash',
        provider: 'Google',
        confidence: 0.9,
        score: -0.3,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('bad-google-key')
        .mockResolvedValueOnce('bad-ds-key');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('server error', { status: 500 }),
          isGoogle: true,
          isAnthropic: false,
          isChatGpt: false,
        })
        .mockResolvedValueOnce({
          response: new Response('gateway timeout', { status: 504 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        });
      tierService.getTiers.mockResolvedValue([
        { tier: 'simple', fallback_models: ['deepseek-chat'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'DeepSeek' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      expect(result.forward.response.ok).toBe(false);
      expect(result.forward.response.status).toBe(500);
      expect(result.failedFallbacks).toHaveLength(1);
      expect(result.failedFallbacks![0]).toEqual({
        model: 'deepseek-chat',
        provider: 'DeepSeek',
        fallbackIndex: 0,
        status: 504,
        errorBody: 'gateway timeout',
      });
    });

    it('preserves primary provider status when all fallbacks are exhausted', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.5,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');

      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('rate limited', { status: 429 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        })
        .mockResolvedValueOnce({
          response: new Response('overloaded', { status: 503 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        })
        .mockResolvedValueOnce({
          response: new Response('server error', { status: 500 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        });

      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['claude-sonnet-4', 'deepseek-chat'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      // Status is the primary provider's actual error (429), not a synthetic 424
      expect(result.forward.response.status).toBe(429);
      expect(result.failedFallbacks).toHaveLength(2);
    });
  });

  describe('auth type fallback for same provider (#1272)', () => {
    it('passes primary provider and auth_type to tryFallbacks', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'claude-sonnet-4',
        provider: 'anthropic',
        confidence: 0.9,
        score: 0.5,
        reason: 'scored',
        auth_type: 'subscription',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sub-token');

      // Primary fails
      providerClient.forward.mockResolvedValueOnce({
        response: new Response('error', { status: 401 }),
        isGoogle: false,
        isAnthropic: true,
        isChatGpt: false,
      });

      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['claude-haiku-3.5'] },
      ] as never);

      // Fallback also fails so we get the primary's 401 status
      providerKeyService.getAuthType.mockResolvedValue('api_key');
      providerClient.forward.mockResolvedValueOnce({
        response: new Response('also error', { status: 500 }),
        isGoogle: false,
        isAnthropic: true,
        isChatGpt: false,
      });
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'default',
      });

      // Verify tryFallbacks receives primary context so it can exclude auth_type
      expect(providerKeyService.getAuthType).toHaveBeenCalledWith(
        'agent-1',
        'Anthropic',
        new Set(['subscription']),
      );
    });
  });

  describe('OpenAI OAuth token unwrap', () => {
    it('unwraps JSON token blob for OpenAI subscription', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'openai',
        confidence: 1.0,
        score: 0.5,
        reason: 'scored',
        auth_type: 'subscription',
      });
      const tokenBlob = JSON.stringify({
        t: 'access-tok',
        r: 'refresh-tok',
        e: Date.now() + 60000,
      });
      providerKeyService.getProviderApiKey.mockResolvedValue(tokenBlob);
      openaiOauth.unwrapToken.mockResolvedValue('access-tok');
      providerClient.forward.mockResolvedValue({
        response: new Response('ok', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess',
      });

      expect(openaiOauth.unwrapToken).toHaveBeenCalledWith(tokenBlob, 'agent-1', 'user-1');
      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          apiKey: 'access-tok',
          model: 'gpt-4o',
          body: expect.any(Object),
          stream: false,
          authType: 'subscription',
        }),
      );
    });

    it('skips unwrap for non-OpenAI subscription providers', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'claude-sonnet-4',
        provider: 'anthropic',
        confidence: 1.0,
        score: 0.5,
        reason: 'scored',
        auth_type: 'subscription',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-ant-oat-token');
      providerClient.forward.mockResolvedValue({
        response: new Response('ok', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess',
      });

      expect(openaiOauth.unwrapToken).not.toHaveBeenCalled();
      expect(minimaxOauth.unwrapToken).not.toHaveBeenCalled();
    });

    it('skips unwrap for OpenAI api_key auth', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'openai',
        confidence: 1.0,
        score: 0.5,
        reason: 'scored',
        auth_type: 'api_key',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-key-1234');
      providerClient.forward.mockResolvedValue({
        response: new Response('ok', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess',
      });

      expect(openaiOauth.unwrapToken).not.toHaveBeenCalled();
    });

    it('unwraps OAuth token in fallback flow for OpenAI subscription', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'claude-sonnet-4',
        provider: 'anthropic',
        confidence: 1.0,
        score: 0.5,
        reason: 'scored',
        auth_type: 'api_key',
      });
      providerKeyService.getProviderApiKey
        .mockResolvedValueOnce('sk-ant-key') // primary
        .mockResolvedValueOnce('{"t":"fb-tok","r":"fb-ref","e":9999999999999}'); // fallback
      providerKeyService.getAuthType.mockResolvedValueOnce('subscription');
      tierService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['gpt-4o'] } as never,
      ]);

      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('error', { status: 429 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        })
        .mockResolvedValueOnce({
          response: new Response('ok', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        });

      pricingCache.getByModel.mockReturnValue({
        model_name: 'gpt-4o',
        provider: 'OpenAI',
      } as never);

      openaiOauth.unwrapToken.mockResolvedValue('fb-tok');

      const result = await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess',
      });

      expect(openaiOauth.unwrapToken).toHaveBeenCalledWith(
        '{"t":"fb-tok","r":"fb-ref","e":9999999999999}',
        'agent-1',
        'user-1',
      );
      expect(result.meta.model).toBe('gpt-4o');
    });

    it('unwraps JSON token blob for MiniMax subscription and forwards resource URL', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'MiniMax-M2.5',
        provider: 'minimax',
        confidence: 1.0,
        score: 0.5,
        reason: 'scored',
        auth_type: 'subscription',
      });
      const tokenBlob = JSON.stringify({
        t: 'minimax-access',
        r: 'minimax-refresh',
        e: Date.now() + 60000,
        u: 'https://api.minimax.io/anthropic',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue(tokenBlob);
      minimaxOauth.unwrapToken.mockResolvedValue({
        t: 'minimax-access',
        r: 'minimax-refresh',
        e: Date.now() + 60000,
        u: 'https://api.minimax.io/anthropic',
      });
      providerClient.forward.mockResolvedValue({
        response: new Response('ok', { status: 200 }),
        isGoogle: false,
        isAnthropic: true,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess',
      });

      expect(minimaxOauth.unwrapToken).toHaveBeenCalledWith(tokenBlob, 'agent-1', 'user-1');
      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'minimax',
          apiKey: 'minimax-access',
          model: 'MiniMax-M2.5',
          body: expect.any(Object),
          stream: false,
          customEndpoint: expect.objectContaining({
            baseUrl: 'https://api.minimax.io/anthropic',
            format: 'anthropic',
          }),
          authType: 'subscription',
        }),
      );
    });

    it('passes thinkingLookup that delegates to ThinkingBlockCache.retrieve', async () => {
      const cache = new ThinkingBlockCache();
      cache.store('sess-think', 'tu-42', [
        { type: 'thinking', thinking: 'cached', signature: 'sig' },
      ]);

      const svcWithCache = new ProxyService(
        resolveService,
        providerKeyService,
        tierService,
        openaiOauth,
        minimaxOauth,
        momentum,
        limitCheck,
        fallbackService,
        configService,
        new ThoughtSignatureCache(),
        cache,
      );

      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await svcWithCache.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess-think',
      });

      const callArgs = providerClient.forward.mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      const lookup = callArgs.thinkingLookup as (id: string) => unknown;
      expect(lookup('tu-42')).toEqual([{ type: 'thinking', thinking: 'cached', signature: 'sig' }]);
      expect(lookup('nonexistent')).toBeNull();
    });

    it('records the specificity category on a successful resolve for session stickiness', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.9,
        score: 0.2,
        reason: 'specificity',
        specificity_category: 'coding',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess-sticky',
      });

      expect(momentum.getRecentCategories('sess-sticky')).toEqual(['coding']);
    });

    it('skips category recording when the resolve result has no specificity category', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.5,
        score: 0.2,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess-no-cat',
      });

      expect(momentum.getRecentCategories('sess-no-cat')).toBeUndefined();
    });

    it('ignores non-canonical specificity category values surfaced by the resolver', async () => {
      // Cast through `any` — the type guards `specificity_category` to valid
      // categories, but the runtime guard in `recordCategoryIfValid` must still
      // reject non-canonical values if they ever slip through (e.g. a future
      // resolver surfacing an unknown tag).
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.5,
        score: 0.2,
        reason: 'specificity',
        specificity_category: 'not_a_real_category' as unknown as 'coding',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess-bad-cat',
      });

      expect(momentum.getRecentCategories('sess-bad-cat')).toBeUndefined();
    });

    it('forwards recentCategories from momentum into ResolveService.resolve', async () => {
      momentum.recordCategory('sess-history', 'coding');
      momentum.recordCategory('sess-history', 'coding');
      momentum.recordCategory('sess-history', 'coding');

      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.5,
        score: 0.2,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess-history',
      });

      const call = resolveService.resolve.mock.calls[0];
      // resolve(agentId, messages, tools, toolChoice, maxTokens, recentTiers, specOverride, recentCategories)
      expect(call[7]).toEqual(['coding', 'coding', 'coding']);
    });

    it('passes signatureLookup that delegates to ThoughtSignatureCache.retrieve', async () => {
      const cache = new ThoughtSignatureCache();
      cache.store('sess-sig', 'tc-42', 'cached-sig-value');

      const svcWithCache = new ProxyService(
        resolveService,
        providerKeyService,
        tierService,
        openaiOauth,
        minimaxOauth,
        momentum,
        limitCheck,
        fallbackService,
        configService,
        cache,
        new ThinkingBlockCache(),
      );

      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      });

      await svcWithCache.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess-sig',
      });

      const callArgs = providerClient.forward.mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      const lookup = callArgs.signatureLookup as (id: string) => string | null;
      expect(lookup('tc-42')).toBe('cached-sig-value');
      expect(lookup('nonexistent')).toBeNull();
    });

    it('ignores invalid MiniMax resource URLs when forwarding subscription requests', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'MiniMax-M2.5',
        provider: 'minimax',
        confidence: 1.0,
        score: 0.5,
        reason: 'scored',
        auth_type: 'subscription',
      });
      const tokenBlob = JSON.stringify({
        t: 'minimax-access',
        r: 'minimax-refresh',
        e: Date.now() + 60000,
        u: 'https://evil.example/anthropic',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue(tokenBlob);
      minimaxOauth.unwrapToken.mockResolvedValue({
        t: 'minimax-access',
        r: 'minimax-refresh',
        e: Date.now() + 60000,
        u: 'https://evil.example/anthropic',
      });
      providerClient.forward.mockResolvedValue({
        response: new Response('ok', { status: 200 }),
        isGoogle: false,
        isAnthropic: true,
        isChatGpt: false,
      });

      await service.proxyRequest({
        agentId: 'agent-1',
        userId: 'user-1',
        body,
        sessionKey: 'sess',
      });

      expect(providerClient.forward).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'minimax',
          apiKey: 'minimax-access',
          model: 'MiniMax-M2.5',
          body: expect.any(Object),
          stream: false,
          authType: 'subscription',
        }),
      );
    });
  });
});
