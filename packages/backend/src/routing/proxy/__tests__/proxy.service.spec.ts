import { BadRequestException, HttpException } from '@nestjs/common';
import { ProxyService } from '../proxy.service';
import { ResolveService } from '../../resolve.service';
import { RoutingService } from '../../routing.service';
import { ProviderClient } from '../provider-client';
import { SessionMomentumService } from '../session-momentum.service';
import { LimitCheckService } from '../../../notifications/services/limit-check.service';

describe('ProxyService', () => {
  let service: ProxyService;
  let resolveService: jest.Mocked<ResolveService>;
  let routingService: jest.Mocked<RoutingService>;
  let providerClient: jest.Mocked<ProviderClient>;
  let momentum: SessionMomentumService;
  let limitCheck: jest.Mocked<LimitCheckService>;

  beforeEach(() => {
    resolveService = {
      resolve: jest.fn(),
    } as unknown as jest.Mocked<ResolveService>;

    routingService = {
      getProviderApiKey: jest.fn(),
    } as unknown as jest.Mocked<RoutingService>;

    providerClient = {
      forward: jest.fn(),
    } as unknown as jest.Mocked<ProviderClient>;

    momentum = new SessionMomentumService();

    limitCheck = {
      checkLimits: jest.fn().mockResolvedValue(null),
      invalidateCache: jest.fn(),
    } as unknown as jest.Mocked<LimitCheckService>;

    service = new ProxyService(
      resolveService,
      routingService,
      providerClient,
      momentum,
      limitCheck,
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
      service.proxyRequest('user-1', {}, 'default'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when messages array is empty', async () => {
    await expect(
      service.proxyRequest('user-1', { messages: [] }, 'default'),
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

    await expect(
      service.proxyRequest('user-1', body, 'default'),
    ).rejects.toThrow('No model available');
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

    await expect(
      service.proxyRequest('user-1', body, 'default'),
    ).rejects.toThrow('No API key found');
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
    });

    const result = await service.proxyRequest('user-1', body, 'sess-1');

    expect(result.meta).toEqual({
      tier: 'standard',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 0.8,
      reason: 'scored',
    });

    // Check momentum was recorded
    expect(momentum.getRecentTiers('sess-1')).toEqual(['standard']);

    // Verify forward was called correctly
    expect(providerClient.forward).toHaveBeenCalledWith(
      'OpenAI',
      'sk-test',
      'gpt-4o',
      body,
      false,
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
    });

    await service.proxyRequest('user-1', body, 'sess-1');

    expect(resolveService.resolve).toHaveBeenCalledWith(
      'user-1',
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
    });

    const bodyWithTools = {
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [{ type: 'function', function: { name: 'get_weather' } }],
      tool_choice: 'auto',
      stream: false,
    };

    await service.proxyRequest('user-1', bodyWithTools, 'default');

    // Resolver should receive undefined for tools and tool_choice
    expect(resolveService.resolve).toHaveBeenCalledWith(
      'user-1',
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
    );
  });

  describe('heartbeat detection', () => {
    const heartbeatBody = {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        {
          role: 'user',
          content:
            'Check tasks and reply HEARTBEAT_OK if nothing needs attention.',
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
      });

      const result = await service.proxyRequest('user-1', heartbeatBody, 'sess-1');

      expect(resolveService.resolveForTier).toHaveBeenCalledWith('user-1', 'simple');
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
      });

      await service.proxyRequest('user-1', heartbeatBody, 'sess-1');

      expect(providerClient.forward).toHaveBeenCalledWith(
        'OpenAI',
        'sk-test',
        'gpt-4o-mini',
        heartbeatBody,
        false,
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
      });

      const result = await service.proxyRequest('user-1', buriedHeartbeatBody, 'sess-1');

      expect(resolveService.resolveForTier).toHaveBeenCalledWith('user-1', 'simple');
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
              { type: 'text', text: 'Check tasks and reply HEARTBEAT_OK if nothing needs attention.' },
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
      });

      const result = await service.proxyRequest('user-1', arrayContentBody, 'sess-1');

      expect(resolveService.resolveForTier).toHaveBeenCalledWith('user-1', 'simple');
      expect(result.meta.tier).toBe('simple');
      expect(result.meta.reason).toBe('heartbeat');
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
      });

      await service.proxyRequest('user-1', body, 'default');

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

      await service.proxyRequest('user-1', bodyWithSystem, 'default');

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

      await service.proxyRequest('user-1', bodyWithSystem, 'default');

      // Provider should get the FULL body including system messages
      expect(providerClient.forward).toHaveBeenCalledWith(
        'OpenAI',
        'sk-test',
        'gpt-4o-mini',
        bodyWithSystem,
        false,
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

      await service.proxyRequest('user-1', { messages, stream: false }, 'default');

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
        service.proxyRequest('user-1', body, 'default', 'tenant-1', 'my-agent'),
      ).rejects.toThrow(HttpException);

      try {
        await service.proxyRequest('user-1', body, 'default', 'tenant-1', 'my-agent');
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

      await service.proxyRequest('user-1', body, 'default');

      expect(limitCheck.checkLimits).not.toHaveBeenCalled();
    });

    it('throws 429 with dollar formatting when cost limit is exceeded', async () => {
      limitCheck.checkLimits.mockResolvedValue({
        ruleId: 'r2',
        metricType: 'cost',
        threshold: 10,
        actual: 12.5,
        period: 'month',
      });

      try {
        await service.proxyRequest('user-1', body, 'default', 'tenant-1', 'my-agent');
        fail('Expected HttpException');
      } catch (err) {
        expect((err as HttpException).getStatus()).toBe(429);
        const response = (err as HttpException).getResponse() as Record<string, unknown>;
        const error = response.error as Record<string, unknown>;
        expect(error.message).toContain('$12.50');
        expect(error.message).toContain('$10.00');
        expect(error.message).toContain('per month');
      }
    });

    it('proceeds normally when no limit is exceeded', async () => {
      setupSuccessMocks();
      limitCheck.checkLimits.mockResolvedValue(null);

      const result = await service.proxyRequest('user-1', body, 'default', 'tenant-1', 'my-agent');

      expect(limitCheck.checkLimits).toHaveBeenCalledWith('tenant-1', 'my-agent');
      expect(result.meta.model).toBe('gpt-4o');
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
      });

      const result = await service.proxyRequest('user-1', body, 'default');

      expect(result.meta.provider).toBe('Ollama');
      expect(providerClient.forward).toHaveBeenCalledWith(
        'Ollama',
        '',
        'llama3',
        body,
        false,
      );
    });
  });
});

