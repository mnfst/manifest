import { BadRequestException, HttpException } from '@nestjs/common';
import { ProxyService } from '../proxy.service';
import { ResolveService } from '../../resolve.service';
import { RoutingService } from '../../routing.service';
import { CustomProviderService } from '../../custom-provider.service';
import { ProviderClient } from '../provider-client';
import { SessionMomentumService } from '../session-momentum.service';
import { LimitCheckService } from '../../../notifications/services/limit-check.service';
import { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';

describe('ProxyService', () => {
  let service: ProxyService;
  let resolveService: jest.Mocked<ResolveService>;
  let routingService: jest.Mocked<RoutingService>;
  let customProviderService: jest.Mocked<CustomProviderService>;
  let providerClient: jest.Mocked<ProviderClient>;
  let momentum: SessionMomentumService;
  let limitCheck: jest.Mocked<LimitCheckService>;
  let pricingCache: jest.Mocked<ModelPricingCacheService>;

  beforeEach(() => {
    resolveService = {
      resolve: jest.fn(),
    } as unknown as jest.Mocked<ResolveService>;

    routingService = {
      getProviderApiKey: jest.fn(),
      getTiers: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<RoutingService>;

    providerClient = {
      forward: jest.fn(),
    } as unknown as jest.Mocked<ProviderClient>;

    momentum = new SessionMomentumService();

    limitCheck = {
      checkLimits: jest.fn().mockResolvedValue(null),
      invalidateCache: jest.fn(),
    } as unknown as jest.Mocked<LimitCheckService>;

    customProviderService = {
      getById: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<CustomProviderService>;

    pricingCache = {
      getByModel: jest.fn().mockReturnValue(null),
      getAll: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<ModelPricingCacheService>;

    service = new ProxyService(
      resolveService,
      routingService,
      customProviderService,
      providerClient,
      momentum,
      limitCheck,
      pricingCache,
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
    await expect(service.proxyRequest('agent-1', 'user-1', {}, 'default')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException when messages array is empty', async () => {
    await expect(
      service.proxyRequest('agent-1', 'user-1', { messages: [] }, 'default'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when no model is resolved', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'simple',
      model: null,
      provider: null,
      confidence: 0.5,
      score: -0.1,
      reason: 'ambiguous',
    });

    await expect(service.proxyRequest('agent-1', 'user-1', body, 'default')).rejects.toThrow(
      'No model available',
    );
  });

  it('throws when no API key found for provider', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'standard',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 0.8,
      score: 0.1,
      reason: 'scored',
    });
    routingService.getProviderApiKey.mockResolvedValue(null);

    await expect(service.proxyRequest('agent-1', 'user-1', body, 'default')).rejects.toThrow(
      'No API key found',
    );
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
    routingService.getProviderApiKey.mockResolvedValue('sk-test');

    const mockResponse = new Response('{}', { status: 200 });
    providerClient.forward.mockResolvedValue({
      response: mockResponse,
      isGoogle: false,
      isAnthropic: false,
    });

    const result = await service.proxyRequest('agent-1', 'user-1', body, 'sess-1');

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
      'OpenAI',
      'sk-test',
      'gpt-4o',
      body,
      false,
      undefined,
      undefined,
      undefined,
    );
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
    routingService.getProviderApiKey.mockResolvedValue('sk-ant');
    providerClient.forward.mockResolvedValue({
      response: new Response('{}', { status: 200 }),
      isGoogle: false,
      isAnthropic: false,
    });

    await service.proxyRequest('agent-1', 'user-1', body, 'sess-1');

    expect(resolveService.resolve).toHaveBeenCalledWith(
      'agent-1',
      body.messages,
      undefined,
      undefined,
      undefined,
      ['complex', 'complex'],
    );
  });

  it('does not pass tools or tool_choice to the resolver', async () => {
    resolveService.resolve.mockResolvedValue({
      tier: 'standard',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 0.8,
      score: 0.1,
      reason: 'scored',
    });
    routingService.getProviderApiKey.mockResolvedValue('sk-test');
    providerClient.forward.mockResolvedValue({
      response: new Response('{}', { status: 200 }),
      isGoogle: false,
      isAnthropic: false,
    });

    const bodyWithTools = {
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [{ type: 'function', function: { name: 'get_weather' } }],
      tool_choice: 'auto',
      stream: false,
    };

    await service.proxyRequest('agent-1', 'user-1', bodyWithTools, 'default');

    // Resolver should receive undefined for tools and tool_choice
    expect(resolveService.resolve).toHaveBeenCalledWith(
      'agent-1',
      expect.any(Array),
      undefined,
      undefined,
      undefined,
      undefined,
    );

    // But the full body (with tools) should be forwarded to the provider
    expect(providerClient.forward).toHaveBeenCalledWith(
      'OpenAI',
      'sk-test',
      'gpt-4o',
      bodyWithTools,
      false,
      undefined,
      undefined,
      undefined,
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
    routingService.getProviderApiKey.mockResolvedValue('sk-test');
    providerClient.forward.mockResolvedValue({
      response: new Response('{}', { status: 200 }),
      isGoogle: false,
      isAnthropic: false,
    });

    const abortController = new AbortController();
    await service.proxyRequest(
      'agent-1',
      'user-1',
      body,
      'default',
      undefined,
      undefined,
      abortController.signal,
    );

    expect(providerClient.forward).toHaveBeenCalledWith(
      'OpenAI',
      'sk-test',
      'gpt-4o',
      body,
      false,
      abortController.signal,
      undefined,
      undefined,
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
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      const result = await service.proxyRequest('agent-1', 'user-1', heartbeatBody, 'sess-1');

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
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      await service.proxyRequest('agent-1', 'user-1', heartbeatBody, 'sess-1');

      expect(providerClient.forward).toHaveBeenCalledWith(
        'OpenAI',
        'sk-test',
        'gpt-4o-mini',
        heartbeatBody,
        false,
        undefined,
        undefined,
        undefined,
      );
    });

    it('detects heartbeat when HEARTBEAT_OK is in an earlier user message', async () => {
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

      resolveService.resolveForTier = jest.fn().mockResolvedValue({
        tier: 'simple',
        model: 'gpt-4o-mini',
        provider: 'OpenAI',
        confidence: 1,
        score: 0,
        reason: 'heartbeat',
      });
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      const result = await service.proxyRequest('agent-1', 'user-1', buriedHeartbeatBody, 'sess-1');

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
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      const result = await service.proxyRequest('agent-1', 'user-1', arrayContentBody, 'sess-1');

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
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      const result = await service.proxyRequest('agent-1', 'user-1', objectContentBody, 'default');

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
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      const bodyWithNullContent = {
        messages: [{ role: 'user', content: null }],
        stream: false,
      };

      await service.proxyRequest('agent-1', 'user-1', bodyWithNullContent, 'default');

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
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      await service.proxyRequest('agent-1', 'user-1', body, 'default');

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
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
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

      await service.proxyRequest('agent-1', 'user-1', bodyWithSystem, 'default');

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

      await service.proxyRequest('agent-1', 'user-1', bodyWithSystem, 'default');

      // Provider should get the FULL body including system messages
      expect(providerClient.forward).toHaveBeenCalledWith(
        'OpenAI',
        'sk-test',
        'gpt-4o-mini',
        bodyWithSystem,
        false,
        undefined,
        undefined,
        undefined,
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

      await service.proxyRequest('agent-1', 'user-1', { messages, stream: false }, 'default');

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
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });
    };

    it('throws 429 when limit is exceeded', async () => {
      limitCheck.checkLimits.mockResolvedValue({
        ruleId: 'r1',
        metricType: 'tokens',
        threshold: 50000,
        actual: 52000,
        period: 'day',
      });

      await expect(
        service.proxyRequest('agent-1', 'user-1', body, 'default', 'tenant-1', 'my-agent'),
      ).rejects.toThrow(HttpException);

      try {
        await service.proxyRequest('agent-1', 'user-1', body, 'default', 'tenant-1', 'my-agent');
      } catch (err) {
        expect((err as HttpException).getStatus()).toBe(429);
        const response = (err as HttpException).getResponse() as Record<string, unknown>;
        const error = response.error as Record<string, unknown>;
        expect(error.code).toBe('limit_exceeded');
        expect(error.type).toBe('rate_limit_exceeded');
      }
    });

    it('does not check limits when tenantId/agentName are not provided', async () => {
      setupSuccessMocks();

      await service.proxyRequest('agent-1', 'user-1', body, 'default');

      expect(limitCheck.checkLimits).not.toHaveBeenCalled();
    });

    it('does not check limits when only tenantId is provided without agentName', async () => {
      setupSuccessMocks();

      await service.proxyRequest('agent-1', 'user-1', body, 'default', 'tenant-1');

      expect(limitCheck.checkLimits).not.toHaveBeenCalled();
    });

    it('does not check limits when only agentName is provided without tenantId', async () => {
      setupSuccessMocks();

      await service.proxyRequest('agent-1', 'user-1', body, 'default', undefined, 'my-agent');

      expect(limitCheck.checkLimits).not.toHaveBeenCalled();
    });

    it('proceeds normally when no limit is exceeded', async () => {
      setupSuccessMocks();
      limitCheck.checkLimits.mockResolvedValue(null);

      const result = await service.proxyRequest(
        'agent-1',
        'user-1',
        body,
        'default',
        'tenant-1',
        'my-agent',
      );

      expect(limitCheck.checkLimits).toHaveBeenCalledWith('tenant-1', 'my-agent');
      expect(result.meta.model).toBe('gpt-4o');
    });

    it('formats cost limit error with dollar sign and 2 decimal places', async () => {
      limitCheck.checkLimits.mockResolvedValue({
        ruleId: 'r2',
        metricType: 'cost',
        threshold: 10.0,
        actual: 12.5,
        period: 'month',
      });

      try {
        await service.proxyRequest('agent-1', 'user-1', body, 'default', 'tenant-1', 'my-agent');
        fail('Expected HttpException');
      } catch (err) {
        const response = (err as HttpException).getResponse() as Record<string, unknown>;
        const error = response.error as Record<string, unknown>;
        expect(error.message).toContain('$12.50');
        expect(error.message).toContain('$10.00');
        expect(error.message).toContain('per month');
      }
    });

    it('formats token limit error with locale string', async () => {
      limitCheck.checkLimits.mockResolvedValue({
        ruleId: 'r3',
        metricType: 'tokens',
        threshold: 100000,
        actual: 105000,
        period: 'day',
      });

      try {
        await service.proxyRequest('agent-1', 'user-1', body, 'default', 'tenant-1', 'my-agent');
        fail('Expected HttpException');
      } catch (err) {
        const response = (err as HttpException).getResponse() as Record<string, unknown>;
        const error = response.error as Record<string, unknown>;
        // toLocaleString formats numbers with commas
        expect(error.message).toContain('105,000');
        expect(error.message).toContain('100,000');
        expect(error.message).toContain('per day');
      }
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
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      const bodyWithMaxTokens = {
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 4096,
        stream: false,
      };

      await service.proxyRequest('agent-1', 'user-1', bodyWithMaxTokens, 'default');

      expect(resolveService.resolve).toHaveBeenCalledWith(
        'agent-1',
        expect.any(Array),
        undefined,
        undefined,
        4096,
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
      routingService.getProviderApiKey.mockResolvedValue('sk-xai-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      await service.proxyRequest('agent-1', 'user-1', body, 'my-session');

      expect(providerClient.forward).toHaveBeenCalledWith(
        'xai',
        'sk-xai-test',
        'grok-2',
        body,
        false,
        undefined,
        { 'x-grok-conv-id': 'my-session' },
        undefined,
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
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      const bodyWithAssistant = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'HEARTBEAT_OK assistant message' },
          { role: 'user', content: 'Continue' },
        ],
        stream: false,
      };

      await service.proxyRequest('agent-1', 'user-1', bodyWithAssistant, 'default');

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
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      const bodyWithOnlySystem = {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'developer', content: 'Internal instructions' },
        ],
        stream: false,
      };

      await service.proxyRequest('agent-1', 'user-1', bodyWithOnlySystem, 'default');

      // Scorer receives empty array after filtering
      const scoredMessages = resolveService.resolve.mock.calls[0][1];
      expect(scoredMessages).toEqual([]);

      // But the full body is forwarded to the provider
      expect(providerClient.forward).toHaveBeenCalledWith(
        'OpenAI',
        'sk-test',
        'gpt-4o-mini',
        bodyWithOnlySystem,
        false,
        undefined,
        undefined,
        undefined,
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
      routingService.getProviderApiKey.mockResolvedValue('gsk_test');
      customProviderService.getById.mockResolvedValue({
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
      });

      const result = await service.proxyRequest('agent-1', 'user-1', body, 'sess-1');

      expect(customProviderService.getById).toHaveBeenCalledWith('cp-uuid');
      // Forward should use the raw model name (without custom prefix)
      expect(providerClient.forward).toHaveBeenCalledWith(
        'custom:cp-uuid',
        'gsk_test',
        'llama-3.1-70b',
        body,
        false,
        undefined,
        undefined,
        expect.objectContaining({
          baseUrl: 'https://api.groq.com/openai',
          format: 'openai',
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
      routingService.getProviderApiKey.mockResolvedValue('key');
      customProviderService.getById.mockResolvedValue(null);
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      await service.proxyRequest('agent-1', 'user-1', body, 'sess-1');

      // No custom endpoint — forward without it
      expect(providerClient.forward).toHaveBeenCalledWith(
        'custom:cp-missing',
        'key',
        'custom:cp-missing/model',
        body,
        false,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('xai extra headers', () => {
    it('adds x-grok-conv-id header for xai provider', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'complex',
        model: 'grok-2',
        provider: 'xai',
        confidence: 0.9,
        score: 0.2,
        reason: 'scored',
      });
      routingService.getProviderApiKey.mockResolvedValue('sk-xai');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      await service.proxyRequest('agent-1', 'user-1', body, 'sess-key-123');

      expect(providerClient.forward).toHaveBeenCalledWith(
        'xai',
        'sk-xai',
        'grok-2',
        body,
        false,
        undefined,
        { 'x-grok-conv-id': 'sess-key-123' },
        undefined,
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
      routingService.getProviderApiKey.mockResolvedValue('');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      const result = await service.proxyRequest('agent-1', 'user-1', body, 'default');

      expect(result.meta.provider).toBe('Ollama');
      expect(providerClient.forward).toHaveBeenCalledWith(
        'Ollama',
        '',
        'llama3',
        body,
        false,
        undefined,
        undefined,
        undefined,
      );
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
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('{}', { status: 200 }),
        isGoogle: false,
        isAnthropic: false,
      });

      const result = await service.proxyRequest('agent-1', 'user-1', body, 'default');

      expect(routingService.getTiers).not.toHaveBeenCalled();
      expect(result.meta.fallbackFromModel).toBeUndefined();
      expect(result.meta.fallbackIndex).toBeUndefined();
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
      routingService.getProviderApiKey
        .mockResolvedValueOnce('sk-test')
        .mockResolvedValueOnce('sk-ant');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('error', { status: 429 }),
          isGoogle: false,
          isAnthropic: false,
        })
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: true,
        });
      routingService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['claude-sonnet-4'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' } as never);

      const result = await service.proxyRequest('agent-1', 'user-1', body, 'default');

      expect(result.meta.fallbackFromModel).toBe('gpt-4o');
      expect(result.meta.fallbackIndex).toBe(0);
      expect(result.meta.primaryErrorStatus).toBe(429);
      expect(result.meta.primaryErrorBody).toBe('error');
      expect(result.meta.model).toBe('claude-sonnet-4');
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
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('error', { status: 500 }),
        isGoogle: false,
        isAnthropic: false,
      });
      routingService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: null },
      ] as never);

      const result = await service.proxyRequest('agent-1', 'user-1', body, 'default');

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
      routingService.getProviderApiKey
        .mockResolvedValueOnce('sk-test')
        .mockResolvedValueOnce('sk-ant');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('error', { status: 502 }),
          isGoogle: false,
          isAnthropic: false,
        })
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: true,
        });
      routingService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['unknown-model', 'claude-sonnet-4'] },
      ] as never);
      pricingCache.getByModel
        .mockReturnValueOnce(null as never)
        .mockReturnValueOnce({ provider: 'Anthropic' } as never);

      const result = await service.proxyRequest('agent-1', 'user-1', body, 'default');

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
      routingService.getProviderApiKey
        .mockResolvedValueOnce('sk-test') // primary
        .mockResolvedValueOnce(null) // first fallback: no API key
        .mockResolvedValueOnce('sk-deepseek'); // second fallback
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('overloaded', { status: 500 }),
          isGoogle: false,
          isAnthropic: false,
        })
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        });
      routingService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['claude-sonnet-4', 'deepseek-chat'] },
      ] as never);
      pricingCache.getByModel
        .mockReturnValueOnce({ provider: 'Anthropic' } as never) // first fallback has pricing
        .mockReturnValueOnce({ provider: 'DeepSeek' } as never); // second fallback has pricing

      const result = await service.proxyRequest('agent-1', 'user-1', body, 'default');

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
      routingService.getProviderApiKey
        .mockResolvedValueOnce('sk-test')
        .mockResolvedValueOnce('sk-a')
        .mockResolvedValueOnce('sk-b');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('overloaded', { status: 500 }),
          isGoogle: false,
          isAnthropic: false,
        })
        .mockResolvedValueOnce({
          response: new Response('rate limited', { status: 429 }),
          isGoogle: false,
          isAnthropic: false,
        })
        .mockResolvedValueOnce({
          response: new Response('{}', { status: 200 }),
          isGoogle: false,
          isAnthropic: false,
        });
      routingService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['model-a', 'model-b'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'ProvA' } as never);

      const result = await service.proxyRequest('agent-1', 'user-1', body, 'default');

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

    it('stops fallback chain on non-retriable error', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      routingService.getProviderApiKey
        .mockResolvedValueOnce('sk-test')
        .mockResolvedValueOnce('sk-a')
        .mockResolvedValueOnce('sk-b');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('overloaded', { status: 500 }),
          isGoogle: false,
          isAnthropic: false,
        })
        .mockResolvedValueOnce({
          response: new Response('bad request', { status: 400 }),
          isGoogle: false,
          isAnthropic: false,
        });
      routingService.getTiers.mockResolvedValue([
        { tier: 'standard', fallback_models: ['model-a', 'model-b'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'ProvA' } as never);

      const result = await service.proxyRequest('agent-1', 'user-1', body, 'default');

      // Chain stopped at model-a's 400, model-b never tried
      expect(result.forward.response.ok).toBe(false);
      expect(providerClient.forward).toHaveBeenCalledTimes(2);
      expect(result.failedFallbacks).toHaveLength(1);
      expect(result.failedFallbacks![0].status).toBe(400);
    });

    it('does not attempt fallbacks when primary returns non-retriable error', async () => {
      resolveService.resolve.mockResolvedValue({
        tier: 'standard',
        model: 'gpt-4o',
        provider: 'OpenAI',
        confidence: 0.8,
        score: 0.1,
        reason: 'scored',
      });
      routingService.getProviderApiKey.mockResolvedValue('sk-test');
      providerClient.forward.mockResolvedValue({
        response: new Response('bad request', { status: 400 }),
        isGoogle: false,
        isAnthropic: false,
      });

      const result = await service.proxyRequest('agent-1', 'user-1', body, 'default');

      expect(routingService.getTiers).not.toHaveBeenCalled();
      expect(result.forward.response.status).toBe(400);
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
      routingService.getProviderApiKey
        .mockResolvedValueOnce('bad-google-key')
        .mockResolvedValueOnce('bad-ds-key');
      providerClient.forward
        .mockResolvedValueOnce({
          response: new Response('server error', { status: 500 }),
          isGoogle: true,
          isAnthropic: false,
        })
        .mockResolvedValueOnce({
          response: new Response('gateway timeout', { status: 504 }),
          isGoogle: false,
          isAnthropic: false,
        });
      routingService.getTiers.mockResolvedValue([
        { tier: 'simple', fallback_models: ['deepseek-chat'] },
      ] as never);
      pricingCache.getByModel.mockReturnValue({ provider: 'DeepSeek' } as never);

      const result = await service.proxyRequest('agent-1', 'user-1', body, 'default');

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
  });
});
