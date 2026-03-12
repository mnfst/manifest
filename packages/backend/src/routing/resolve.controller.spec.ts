import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ResolveController,
  RegisterSubscriptionsDto,
  RoutingSummaryResponse,
  SubscriptionProviderItem,
} from './resolve.controller';
import { ResolveService } from './resolve.service';
import { RoutingService } from './routing.service';
import { ResolveResponse } from './dto/resolve-response';

describe('ResolveController', () => {
  let controller: ResolveController;
  let mockResolveService: { resolve: jest.Mock };
  let mockRoutingService: {
    upsertProvider: jest.Mock;
    getProviders: jest.Mock;
    getTiers: jest.Mock;
    getEffectiveModel: jest.Mock;
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
    mockResolveService = {
      resolve: jest.fn().mockResolvedValue(mockResponse),
    };
    mockRoutingService = {
      upsertProvider: jest.fn().mockResolvedValue({ provider: {}, isNew: true }),
      getProviders: jest.fn().mockResolvedValue([]),
      getTiers: jest.fn().mockResolvedValue([]),
      getEffectiveModel: jest.fn().mockResolvedValue(null),
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

  describe('getSummary', () => {
    it('returns active providers and effective tier models for the current agent', async () => {
      const req = {
        ingestionContext: {
          userId: 'user-42',
          tenantId: 't1',
          agentId: 'a1',
          agentName: 'test-agent',
        },
      } as never;

      mockRoutingService.getProviders.mockResolvedValue([
        { provider: 'openai', auth_type: 'api_key', is_active: true },
        { provider: 'anthropic', auth_type: 'subscription', is_active: true },
        { provider: 'deepseek', auth_type: 'api_key', is_active: false },
      ]);
      mockRoutingService.getTiers.mockResolvedValue([
        {
          tier: 'reasoning',
          override_model: 'o3',
          auto_assigned_model: 'o4-mini',
          fallback_models: ['o4-mini'],
        },
        {
          tier: 'simple',
          override_model: null,
          auto_assigned_model: 'gpt-4.1-mini',
          fallback_models: null,
        },
        {
          tier: 'standard',
          override_model: null,
          auto_assigned_model: 'claude-sonnet-4',
          fallback_models: null,
        },
        {
          tier: 'complex',
          override_model: 'gpt-4.1',
          auto_assigned_model: 'claude-opus-4',
          fallback_models: ['claude-opus-4'],
        },
      ]);
      mockRoutingService.getEffectiveModel.mockImplementation(
        async (_agentId: string, assignment: { tier: string }) => {
          switch (assignment.tier) {
            case 'simple':
              return 'gpt-4.1-mini';
            case 'standard':
              return 'claude-sonnet-4';
            case 'complex':
              return 'claude-opus-4';
            case 'reasoning':
              return 'o3';
            default:
              return null;
          }
        },
      );

      const result = await controller.getSummary(req);

      const expected: RoutingSummaryResponse = {
        agentName: 'test-agent',
        providers: [
          { provider: 'anthropic', auth_type: 'subscription' },
          { provider: 'openai', auth_type: 'api_key' },
        ],
        tiers: [
          {
            tier: 'simple',
            model: 'gpt-4.1-mini',
            source: 'auto',
            fallback_models: [],
          },
          {
            tier: 'standard',
            model: 'claude-sonnet-4',
            source: 'auto',
            fallback_models: [],
          },
          {
            tier: 'complex',
            model: 'claude-opus-4',
            source: 'auto',
            fallback_models: ['claude-opus-4'],
          },
          {
            tier: 'reasoning',
            model: 'o3',
            source: 'override',
            fallback_models: ['o4-mini'],
          },
        ],
      };

      expect(result).toEqual(expected);
      expect(mockRoutingService.getProviders).toHaveBeenCalledWith('a1');
      expect(mockRoutingService.getTiers).toHaveBeenCalledWith('a1');
      expect(mockRoutingService.getEffectiveModel).toHaveBeenCalledTimes(4);
    });

    it('fills missing tier assignments with null auto entries', async () => {
      const req = {
        ingestionContext: {
          userId: 'user-42',
          tenantId: 't1',
          agentId: 'a1',
          agentName: 'test-agent',
        },
      } as never;

      mockRoutingService.getProviders.mockResolvedValue([]);
      mockRoutingService.getTiers.mockResolvedValue([
        {
          tier: 'simple',
          override_model: null,
          auto_assigned_model: 'gpt-4.1-mini',
          fallback_models: null,
        },
      ]);
      mockRoutingService.getEffectiveModel.mockResolvedValue('gpt-4.1-mini');

      const result = await controller.getSummary(req);

      expect(result.tiers).toEqual([
        {
          tier: 'simple',
          model: 'gpt-4.1-mini',
          source: 'auto',
          fallback_models: [],
        },
        {
          tier: 'standard',
          model: null,
          source: 'auto',
          fallback_models: [],
        },
        {
          tier: 'complex',
          model: null,
          source: 'auto',
          fallback_models: [],
        },
        {
          tier: 'reasoning',
          model: null,
          source: 'auto',
          fallback_models: [],
        },
      ]);
      expect(mockRoutingService.getEffectiveModel).toHaveBeenCalledTimes(1);
    });

    it('sorts same-provider entries by auth type and defaults missing auth type to api_key', async () => {
      const req = {
        ingestionContext: {
          userId: 'user-42',
          tenantId: 't1',
          agentId: 'a1',
          agentName: 'test-agent',
        },
      } as never;

      mockRoutingService.getProviders.mockResolvedValue([
        { provider: 'openai', auth_type: 'subscription', is_active: true },
        { provider: 'openai', auth_type: 'api_key', is_active: true },
        { provider: 'mistral', is_active: true },
      ]);
      mockRoutingService.getTiers.mockResolvedValue([]);

      const result = await controller.getSummary(req);

      expect(result.providers).toEqual([
        { provider: 'mistral', auth_type: 'api_key' },
        { provider: 'openai', auth_type: 'api_key' },
        { provider: 'openai', auth_type: 'subscription' },
      ]);
    });
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
      expect(mockRoutingService.upsertProvider).toHaveBeenCalledTimes(2);
      expect(mockRoutingService.upsertProvider).toHaveBeenCalledWith(
        'a1',
        'u1',
        'anthropic',
        undefined,
        'subscription',
      );
      expect(mockRoutingService.upsertProvider).toHaveBeenCalledWith(
        'a1',
        'u1',
        'openai',
        undefined,
        'subscription',
      );
    });
  });
});
