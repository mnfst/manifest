import type { Request } from 'express';
import { ResolveController, RegisterSubscriptionsDto } from '../resolve.controller';
import type { ResolveService } from '../resolve.service';
import type { ProviderService } from '../../routing-core/provider.service';
import type { IngestionContext } from '../../../otlp/interfaces/ingestion-context.interface';
import type { ResolveRequestDto } from '../../dto/resolve-request.dto';
import type { ResolveResponse } from '../../dto/resolve-response';

type ReqWithCtx = Request & { ingestionContext: IngestionContext };

const ingestionContext: IngestionContext = {
  tenantId: 'tenant-1',
  agentId: 'agent-1',
  agentName: 'test-agent',
  userId: 'user-1',
};

function mockReq(overrides: Partial<IngestionContext> = {}): ReqWithCtx {
  return {
    ingestionContext: { ...ingestionContext, ...overrides },
  } as unknown as ReqWithCtx;
}

const baseResponse: ResolveResponse = {
  tier: 'standard',
  confidence: 0.9,
  score: 5,
  reason: 'scored',
  route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
  fallback_routes: null,
};

describe('ResolveController', () => {
  let controller: ResolveController;
  let resolveService: jest.Mocked<Pick<ResolveService, 'resolve'>>;
  let providerService: jest.Mocked<
    Pick<ProviderService, 'upsertProvider' | 'registerSubscriptionProvider'>
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService = {
      resolve: jest.fn().mockResolvedValue(baseResponse),
    };
    providerService = {
      upsertProvider: jest.fn().mockResolvedValue({ provider: {}, isNew: true }),
      registerSubscriptionProvider: jest.fn().mockResolvedValue({ isNew: true }),
    };
    controller = new ResolveController(
      resolveService as unknown as ResolveService,
      providerService as unknown as ProviderService,
    );
  });

  describe('resolve', () => {
    it('delegates to ResolveService and returns the response', async () => {
      const body: ResolveRequestDto = {
        messages: [{ role: 'user', content: 'hello' }],
      };

      const result = await controller.resolve(body, mockReq());

      expect(result).toBe(baseResponse);
      expect(resolveService.resolve).toHaveBeenCalledTimes(1);
    });

    it('passes agentId from ingestionContext and all body params through', async () => {
      const body: ResolveRequestDto = {
        messages: [{ role: 'user', content: 'route me' }],
        tools: [{ type: 'function', function: { name: 'search' } }],
        tool_choice: 'auto',
        max_tokens: 1024,
        recentTiers: ['simple', 'standard'],
        specificity: 'coding',
      };

      await controller.resolve(body, mockReq());

      expect(resolveService.resolve).toHaveBeenCalledWith(
        'agent-1',
        body.messages,
        body.tools,
        body.tool_choice,
        body.max_tokens,
        body.recentTiers,
        body.specificity,
      );
    });

    it('forwards undefined optional fields when omitted', async () => {
      const body: ResolveRequestDto = {
        messages: [{ role: 'user', content: 'minimal' }],
      };

      await controller.resolve(body, mockReq());

      expect(resolveService.resolve).toHaveBeenCalledWith(
        'agent-1',
        body.messages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it('uses the agentId from ingestionContext, not the body', async () => {
      const body: ResolveRequestDto = {
        messages: [{ role: 'user', content: 'cross-tenant attempt' }],
      };
      // Even if body somehow carried an agent reference, only ingestionContext
      // wins — the guard is the only authority on tenancy. This pins that
      // contract so a regression that reads agent from the body fails loudly.
      const req = mockReq({ agentId: 'agent-from-context' });

      await controller.resolve(body, req);

      expect(resolveService.resolve).toHaveBeenCalledWith(
        'agent-from-context',
        body.messages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it('propagates errors thrown by ResolveService', async () => {
      resolveService.resolve.mockRejectedValueOnce(new Error('boom'));
      const body: ResolveRequestDto = {
        messages: [{ role: 'user', content: 'fail' }],
      };
      await expect(controller.resolve(body, mockReq())).rejects.toThrow('boom');
    });
  });

  describe('registerSubscriptions', () => {
    it('returns 0 registered for an empty providers array', async () => {
      const body: RegisterSubscriptionsDto = { providers: [] };

      const result = await controller.registerSubscriptions(body, mockReq());

      expect(result).toEqual({ registered: 0 });
      expect(providerService.upsertProvider).not.toHaveBeenCalled();
      expect(providerService.registerSubscriptionProvider).not.toHaveBeenCalled();
    });

    it('uses upsertProvider when an item carries a token', async () => {
      providerService.upsertProvider.mockResolvedValueOnce({
        provider: {} as never,
        isNew: true,
      });
      const body: RegisterSubscriptionsDto = {
        providers: [{ provider: 'minimax', token: 'sk-token-123' }],
      };

      const result = await controller.registerSubscriptions(body, mockReq());

      expect(providerService.upsertProvider).toHaveBeenCalledTimes(1);
      expect(providerService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'minimax',
        'sk-token-123',
        'subscription',
      );
      expect(providerService.registerSubscriptionProvider).not.toHaveBeenCalled();
      expect(result).toEqual({ registered: 1 });
    });

    it('uses registerSubscriptionProvider when no token is provided', async () => {
      providerService.registerSubscriptionProvider.mockResolvedValueOnce({ isNew: true });
      const body: RegisterSubscriptionsDto = {
        providers: [{ provider: 'anthropic' }],
      };

      const result = await controller.registerSubscriptions(body, mockReq());

      expect(providerService.registerSubscriptionProvider).toHaveBeenCalledTimes(1);
      expect(providerService.registerSubscriptionProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'anthropic',
      );
      expect(providerService.upsertProvider).not.toHaveBeenCalled();
      expect(result).toEqual({ registered: 1 });
    });

    it('only counts items where isNew is true', async () => {
      providerService.upsertProvider.mockResolvedValueOnce({
        provider: {} as never,
        isNew: false,
      });
      providerService.registerSubscriptionProvider
        .mockResolvedValueOnce({ isNew: true })
        .mockResolvedValueOnce({ isNew: false });
      const body: RegisterSubscriptionsDto = {
        providers: [
          { provider: 'minimax', token: 'tok-already-saved' },
          { provider: 'anthropic' },
          { provider: 'openai' },
        ],
      };

      const result = await controller.registerSubscriptions(body, mockReq());

      expect(result).toEqual({ registered: 1 });
    });

    it('treats an empty string token as tokenless and uses subscription registration', async () => {
      // Falsy token (`''`) hits the `else` branch — verifies the truthiness
      // check on item.token, not just an `undefined` check.
      providerService.registerSubscriptionProvider.mockResolvedValueOnce({ isNew: true });
      const body: RegisterSubscriptionsDto = {
        providers: [{ provider: 'anthropic', token: '' }],
      };

      const result = await controller.registerSubscriptions(body, mockReq());

      expect(providerService.upsertProvider).not.toHaveBeenCalled();
      expect(providerService.registerSubscriptionProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'anthropic',
      );
      expect(result).toEqual({ registered: 1 });
    });

    it('uses agentId and userId from the ingestionContext', async () => {
      // Pin tenancy: the controller must use the guard-attached context, not
      // any body field, for both agent and user scope.
      providerService.registerSubscriptionProvider.mockResolvedValueOnce({ isNew: true });
      const body: RegisterSubscriptionsDto = {
        providers: [{ provider: 'anthropic' }],
      };

      await controller.registerSubscriptions(
        body,
        mockReq({ agentId: 'agent-X', userId: 'user-Y' }),
      );

      expect(providerService.registerSubscriptionProvider).toHaveBeenCalledWith(
        'agent-X',
        'user-Y',
        'anthropic',
      );
    });

    it('propagates errors from the provider service (both paths)', async () => {
      providerService.upsertProvider.mockRejectedValueOnce(new Error('upstream fail'));
      await expect(
        controller.registerSubscriptions(
          { providers: [{ provider: 'minimax', token: 'sk-tok' }] },
          mockReq(),
        ),
      ).rejects.toThrow('upstream fail');

      providerService.registerSubscriptionProvider.mockRejectedValueOnce(new Error('reg fail'));
      await expect(
        controller.registerSubscriptions({ providers: [{ provider: 'anthropic' }] }, mockReq()),
      ).rejects.toThrow('reg fail');
    });

    it('processes providers sequentially in submission order', async () => {
      // Order of calls matters when a duplicate label triggers a conflict —
      // pin the dispatch order so a refactor to Promise.all (which would
      // change error semantics) gets caught.
      const order: string[] = [];
      providerService.registerSubscriptionProvider.mockImplementation(async (_a, _u, prov) => {
        order.push(prov);
        return { isNew: true };
      });
      const body: RegisterSubscriptionsDto = {
        providers: [{ provider: 'anthropic' }, { provider: 'minimax' }, { provider: 'gemini' }],
      };

      await controller.registerSubscriptions(body, mockReq());

      expect(order).toEqual(['anthropic', 'minimax', 'gemini']);
    });
  });
});
