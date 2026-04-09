import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ResolveController,
  RegisterSubscriptionsDto,
  SubscriptionProviderItem,
} from './resolve/resolve.controller';
import { ResolveService } from './resolve/resolve.service';
import { ProviderService } from './routing-core/provider.service';
import { ResolveResponse } from './dto/resolve-response';

describe('ResolveController', () => {
  let controller: ResolveController;
  let mockResolveService: { resolve: jest.Mock };
  let mockProviderService: {
    registerSubscriptionProvider: jest.Mock;
    upsertProvider: jest.Mock;
  };

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
    mockProviderService = {
      registerSubscriptionProvider: jest.fn().mockResolvedValue({ isNew: true }),
      upsertProvider: jest.fn().mockResolvedValue({ provider: {}, isNew: true }),
    };
    controller = new ResolveController(
      mockResolveService as unknown as ResolveService,
      mockProviderService as unknown as ProviderService,
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
      undefined,
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
      expect(mockProviderService.registerSubscriptionProvider).toHaveBeenCalledTimes(2);
      expect(mockProviderService.registerSubscriptionProvider).toHaveBeenCalledWith(
        'a1',
        'u1',
        'anthropic',
      );
      expect(mockProviderService.registerSubscriptionProvider).toHaveBeenCalledWith(
        'a1',
        'u1',
        'openai',
      );
    });

    it('should pass token to upsertProvider when present', async () => {
      const req = {
        ingestionContext: { userId: 'u1', tenantId: 't1', agentId: 'a1', agentName: 'n1' },
      } as never;

      await controller.registerSubscriptions(
        { providers: [{ provider: 'copilot', token: 'ghu_token_123' }] },
        req,
      );

      expect(mockProviderService.upsertProvider).toHaveBeenCalledWith(
        'a1',
        'u1',
        'copilot',
        'ghu_token_123',
        'subscription',
      );
    });

    it('should use registerSubscriptionProvider when no token', async () => {
      const req = {
        ingestionContext: { userId: 'u1', tenantId: 't1', agentId: 'a1', agentName: 'n1' },
      } as never;

      await controller.registerSubscriptions({ providers: [{ provider: 'anthropic' }] }, req);

      expect(mockProviderService.registerSubscriptionProvider).toHaveBeenCalledWith(
        'a1',
        'u1',
        'anthropic',
      );
    });

    it('should only count newly created providers', async () => {
      mockProviderService.registerSubscriptionProvider
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

  describe('SubscriptionProviderItem with token', () => {
    it('should accept optional token field', async () => {
      const plain = { providers: [{ provider: 'copilot', token: 'ghu_abc' }] };
      const dto = plainToInstance(RegisterSubscriptionsDto, plain);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.providers[0].token).toBe('ghu_abc');
    });

    it('should accept provider without token field', async () => {
      const plain = { providers: [{ provider: 'anthropic' }] };
      const dto = plainToInstance(RegisterSubscriptionsDto, plain);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.providers[0].token).toBeUndefined();
    });
  });
});
