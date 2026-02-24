import { BadRequestException } from '@nestjs/common';
import { ProxyService } from '../proxy.service';
import { ResolveService } from '../../resolve.service';
import { RoutingService } from '../../routing.service';
import { ProviderClient } from '../provider-client';
import { SessionMomentumService } from '../session-momentum.service';

describe('ProxyService', () => {
  let service: ProxyService;
  let resolveService: jest.Mocked<ResolveService>;
  let routingService: jest.Mocked<RoutingService>;
  let providerClient: jest.Mocked<ProviderClient>;
  let momentum: SessionMomentumService;

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

    service = new ProxyService(
      resolveService,
      routingService,
      providerClient,
      momentum,
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
});

