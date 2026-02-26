import { BadRequestException } from '@nestjs/common';
import { ProxyService } from '../proxy.service';
import { ResolveService } from '../../resolve.service';
import { RoutingService } from '../../routing.service';
import { ProviderClient } from '../provider-client';

describe('ProxyService', () => {
  let service: ProxyService;
  let resolveService: jest.Mocked<ResolveService>;
  let routingService: jest.Mocked<RoutingService>;
  let providerClient: jest.Mocked<ProviderClient>;

  beforeEach(() => {
    resolveService = {
      resolveForTier: jest.fn(),
    } as unknown as jest.Mocked<ResolveService>;

    routingService = {
      getProviderApiKey: jest.fn(),
    } as unknown as jest.Mocked<RoutingService>;

    providerClient = {
      forward: jest.fn(),
    } as unknown as jest.Mocked<ProviderClient>;

    service = new ProxyService(
      resolveService,
      routingService,
      providerClient,
    );
  });

  const body = {
    messages: [{ role: 'user', content: 'Hello' }],
    stream: false,
  };

  it('resolves tier via resolveForTier and forwards', async () => {
    resolveService.resolveForTier.mockResolvedValue({
      tier: 'standard',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 1,
      score: 0,
      reason: 'heartbeat',
    });
    routingService.getProviderApiKey.mockResolvedValue('sk-test');

    const mockResponse = new Response('{}', { status: 200 });
    providerClient.forward.mockResolvedValue({ response: mockResponse });

    const result = await service.proxyRequest('user-1', body, 'standard');

    expect(resolveService.resolveForTier).toHaveBeenCalledWith('user-1', 'standard');
    expect(result.meta).toEqual({
      tier: 'standard',
      model: 'gpt-4o',
      provider: 'OpenAI',
    });
    expect(providerClient.forward).toHaveBeenCalledWith(
      'OpenAI',
      'sk-test',
      'gpt-4o',
      body,
      false,
    );
  });

  it('uses the explicit tier passed to proxyRequest', async () => {
    resolveService.resolveForTier.mockResolvedValue({
      tier: 'complex',
      model: 'claude-sonnet-4',
      provider: 'Anthropic',
      confidence: 1,
      score: 0,
      reason: 'heartbeat',
    });
    routingService.getProviderApiKey.mockResolvedValue('sk-ant');
    providerClient.forward.mockResolvedValue({
      response: new Response('{}', { status: 200 }),
    });

    const result = await service.proxyRequest('user-1', body, 'complex');

    expect(resolveService.resolveForTier).toHaveBeenCalledWith('user-1', 'complex');
    expect(result.meta.tier).toBe('complex');
  });

  it('throws when no model is resolved for tier', async () => {
    resolveService.resolveForTier.mockResolvedValue({
      tier: 'simple',
      model: null,
      provider: null,
      confidence: 1,
      score: 0,
      reason: 'heartbeat',
    });

    await expect(
      service.proxyRequest('user-1', body, 'simple'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when no API key found for provider', async () => {
    resolveService.resolveForTier.mockResolvedValue({
      tier: 'standard',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 1,
      score: 0,
      reason: 'heartbeat',
    });
    routingService.getProviderApiKey.mockResolvedValue(null);

    await expect(
      service.proxyRequest('user-1', body, 'standard'),
    ).rejects.toThrow('No API key found');
  });

  it('forwards the full unmodified body to the provider', async () => {
    resolveService.resolveForTier.mockResolvedValue({
      tier: 'standard',
      model: 'gpt-4o',
      provider: 'OpenAI',
      confidence: 1,
      score: 0,
      reason: 'heartbeat',
    });
    routingService.getProviderApiKey.mockResolvedValue('sk-test');
    providerClient.forward.mockResolvedValue({
      response: new Response('{}', { status: 200 }),
    });

    const bodyWithTools = {
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [{ type: 'function', function: { name: 'get_weather' } }],
      stream: false,
    };

    await service.proxyRequest('user-1', bodyWithTools, 'standard');

    expect(providerClient.forward).toHaveBeenCalledWith(
      'OpenAI',
      'sk-test',
      'gpt-4o',
      bodyWithTools,
      false,
    );
  });

  it('passes stream=true when body.stream is true', async () => {
    resolveService.resolveForTier.mockResolvedValue({
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
    });

    await service.proxyRequest('user-1', { ...body, stream: true }, 'simple');

    expect(providerClient.forward).toHaveBeenCalledWith(
      'OpenAI',
      'sk-test',
      'gpt-4o-mini',
      expect.objectContaining({ stream: true }),
      true,
    );
  });
});
