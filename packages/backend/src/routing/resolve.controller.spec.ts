import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ResolveController,
  RegisterSubscriptionsDto,
  SubscriptionProviderItem,
} from './resolve.controller';
import { ResolveService } from './resolve.service';
import { RoutingService } from './routing.service';
import { ResolveResponse } from './dto/resolve-response';
import * as telemetry from '../common/utils/product-telemetry';

jest.mock('../common/utils/product-telemetry', () => ({
  trackCloudEvent: jest.fn(),
}));

describe('ResolveController', () => {
  let controller: ResolveController;
  let mockResolveService: { resolve: jest.Mock };
  let mockRoutingService: { registerSubscriptionProvider: jest.Mock };

  const mockResponse: ResolveResponse = {
    tier: 'simple',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
    confidence: 0.9,
    score: -0.3,
    reason: 'short_message',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveService = {
      resolve: jest.fn().mockResolvedValue(mockResponse),
    };
    mockRoutingService = {
      registerSubscriptionProvider: jest.fn().mockResolvedValue({ isNew: true }),
    };
    controller = new ResolveController(
      mockResolveService as unknown as ResolveService,
      mockRoutingService as unknown as RoutingService,
    );
  });

  it('should pass agentId from ingestionContext to service', async () => {
    const req = {
      ingestionContext: {
        userId: 'user-42',
        tenantId: 't1',
        agentId: 'a1',
        agentName: 'test',
      },
    } as never;

    await controller.resolve({ messages: [{ role: 'user', content: 'hi' }] } as never, req);

    expect(mockResolveService.resolve).toHaveBeenCalledWith(
      'a1',
      [{ role: 'user', content: 'hi' }],
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('should pass all optional fields to service', async () => {
    const req = {
      ingestionContext: { userId: 'user-1', tenantId: 't', agentId: 'a', agentName: 'n' },
    } as never;
    const body = {
      messages: [{ role: 'user', content: 'test' }],
      tools: [{ name: 'search' }],
      tool_choice: 'auto',
      max_tokens: 1000,
      recentTiers: ['simple', 'standard'] as const,
    };

    await controller.resolve(body as never, req);

    expect(mockResolveService.resolve).toHaveBeenCalledWith(
      'a',
      body.messages,
      body.tools,
      'auto',
      1000,
      ['simple', 'standard'],
    );
  });

  it('should return the resolve response directly', async () => {
    const req = {
      ingestionContext: { userId: 'u', tenantId: 't', agentId: 'a', agentName: 'n' },
    } as never;

    const result = await controller.resolve(
      { messages: [{ role: 'user', content: 'hi' }] } as never,
      req,
    );

    expect(result).toBe(mockResponse);
  });

  describe('RegisterSubscriptionsDto', () => {
    it('should transform plain providers array into SubscriptionProviderItem instances', () => {
      const plain = { providers: [{ provider: 'anthropic' }, { provider: 'openai' }] };
      const dto = plainToInstance(RegisterSubscriptionsDto, plain);

      expect(dto.providers).toHaveLength(2);
      expect(dto.providers[0]).toBeInstanceOf(SubscriptionProviderItem);
      expect(dto.providers[0].provider).toBe('anthropic');
      expect(dto.providers[1]).toBeInstanceOf(SubscriptionProviderItem);
      expect(dto.providers[1].provider).toBe('openai');
    });

    it('should fail validation when providers contain empty provider string', async () => {
      const plain = { providers: [{ provider: '' }] };
      const dto = plainToInstance(RegisterSubscriptionsDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('registerSubscriptions', () => {
    it('should register subscription providers and return count', async () => {
      const req = {
        ingestionContext: { userId: 'u1', tenantId: 't1', agentId: 'a1', agentName: 'n1' },
      } as never;

      const result = await controller.registerSubscriptions(
        { providers: [{ provider: 'anthropic' }, { provider: 'openai' }] },
        req,
      );

      expect(result).toEqual({ registered: 2 });
      expect(mockRoutingService.registerSubscriptionProvider).toHaveBeenCalledTimes(2);
      expect(mockRoutingService.registerSubscriptionProvider).toHaveBeenCalledWith(
        'a1',
        'u1',
        'anthropic',
      );
      expect(mockRoutingService.registerSubscriptionProvider).toHaveBeenCalledWith(
        'a1',
        'u1',
        'openai',
      );
    });

    it('should fire routing_provider_connected with (Subscription) suffix for new providers', async () => {
      const req = {
        ingestionContext: { userId: 'u1', tenantId: 't1', agentId: 'a1', agentName: 'n1' },
      } as never;

      await controller.registerSubscriptions({ providers: [{ provider: 'anthropic' }] }, req);

      expect(telemetry.trackCloudEvent).toHaveBeenCalledWith('routing_provider_connected', 'u1', {
        provider: 'anthropic (Subscription)',
      });
    });

    it('should not fire event when subscription provider already exists', async () => {
      mockRoutingService.registerSubscriptionProvider.mockResolvedValue({ isNew: false });
      const req = {
        ingestionContext: { userId: 'u1', tenantId: 't1', agentId: 'a1', agentName: 'n1' },
      } as never;

      await controller.registerSubscriptions({ providers: [{ provider: 'anthropic' }] }, req);

      expect(telemetry.trackCloudEvent).not.toHaveBeenCalled();
    });

    it('should only count newly created providers', async () => {
      mockRoutingService.registerSubscriptionProvider
        .mockResolvedValueOnce({ isNew: true })
        .mockResolvedValueOnce({ isNew: false });

      const req = {
        ingestionContext: { userId: 'u1', tenantId: 't1', agentId: 'a1', agentName: 'n1' },
      } as never;

      const result = await controller.registerSubscriptions(
        { providers: [{ provider: 'anthropic' }, { provider: 'openai' }] },
        req,
      );

      expect(result).toEqual({ registered: 1 });
    });
  });
});
