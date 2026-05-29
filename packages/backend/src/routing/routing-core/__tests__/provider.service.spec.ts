import type { ModelRoute } from 'manifest-shared';
import { ProviderService } from '../provider.service';
import { UserProvider } from '../../../entities/user-provider.entity';
import { TierAssignment } from '../../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../../entities/specificity-assignment.entity';
import type { Repository } from 'typeorm';
import type { TierAutoAssignService } from '../tier-auto-assign.service';
import type { RoutingCacheService } from '../routing-cache.service';
import type { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';

const route = (
  provider: string,
  model: string,
  authType: ModelRoute['authType'] = 'api_key',
): ModelRoute => ({
  provider,
  authType,
  model,
});

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  insert: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockImplementation(async (rows) => rows),
  delete: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  manager: { transaction: jest.fn() },
});

describe('ProviderService — route-only cleanup paths', () => {
  let providerRepo: ReturnType<typeof makeRepo>;
  let tierRepo: ReturnType<typeof makeRepo>;
  let specRepo: ReturnType<typeof makeRepo>;
  let autoAssign: jest.Mocked<Pick<TierAutoAssignService, 'recalculate'>>;
  let pricingCache: jest.Mocked<Pick<ModelPricingCacheService, 'getByModel'>>;
  let routingCache: {
    getProviders: jest.Mock;
    setProviders: jest.Mock;
    invalidateAgent: jest.Mock;
    invalidateUser: jest.Mock;
  };
  let svc: ProviderService;

  beforeEach(() => {
    providerRepo = makeRepo();
    tierRepo = makeRepo();
    specRepo = makeRepo();
    autoAssign = { recalculate: jest.fn().mockResolvedValue(undefined) };
    pricingCache = { getByModel: jest.fn().mockReturnValue(undefined) };
    routingCache = {
      getProviders: jest.fn().mockReturnValue(null),
      setProviders: jest.fn(),
      invalidateAgent: jest.fn(),
      invalidateUser: jest.fn(),
    };

    svc = new ProviderService(
      providerRepo as unknown as Repository<UserProvider>,
      tierRepo as unknown as Repository<TierAssignment>,
      specRepo as unknown as Repository<SpecificityAssignment>,
      autoAssign as unknown as TierAutoAssignService,
      pricingCache as unknown as ModelPricingCacheService,
      routingCache as unknown as RoutingCacheService,
    );
  });

  describe('removeProvider — cleanupProviderReferences', () => {
    it('clears tier override_route when its provider matches removed provider (case-insensitive)', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      // After save, no other active records.
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: route('OpenAI', 'gpt-4o'),
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      // Re-read tiers for notification map.
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: route('anthropic', 'claude'),
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);

      const result = await svc.removeProvider('agent-1', 'user-1', 'openai');
      expect(tierRepo.save).toHaveBeenCalledTimes(1);
      const savedTiers = tierRepo.save.mock.calls[0][0];
      expect(savedTiers[0].override_route).toBeNull();
      expect(result.notifications[0]).toMatch(/gpt-4o is no longer available/);
      expect(result.notifications[0]).toMatch(/automatic mode \(claude\)/);
    });

    it('uses model-prefix matching for routes whose provider does not equal the removed key', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'custom-x',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: { provider: 'other', authType: 'api_key', model: 'custom-x/some' },
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: null,
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);

      const result = await svc.removeProvider('agent-1', 'user-1', 'custom-x');
      const saved = tierRepo.save.mock.calls[0][0];
      expect(saved[0].override_route).toBeNull();
      // Notification for the removed model.
      expect(result.notifications).toHaveLength(1);
    });

    it('uses pricing cache provider attribution for opaque model names', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      pricingCache.getByModel.mockReturnValue({ provider: 'openai' } as never);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          // provider in route doesn't match — only pricing cache attribution does.
          override_route: { provider: 'mystery', authType: 'api_key', model: 'opaque-id' },
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      tierRepo.find.mockResolvedValueOnce([
        { tier: 'standard', override_route: null, auto_assigned_route: null } as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);

      await svc.removeProvider('agent-1', 'user-1', 'openai');
      expect(tierRepo.save).toHaveBeenCalled();
    });

    it('filters fallback_routes and nulls when emptied', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: null,
          fallback_routes: [route('openai', 'gpt-4o')],
        } as unknown as TierAssignment,
      ]);
      tierRepo.find.mockResolvedValueOnce([{ tier: 'standard' } as TierAssignment]);
      specRepo.find.mockResolvedValue([]);

      await svc.removeProvider('agent-1', 'user-1', 'openai');
      const saved = tierRepo.save.mock.calls[0][0];
      expect(saved[0].fallback_routes).toBeNull();
    });

    it('preserves remaining fallback_routes when only some entries match', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: null,
          fallback_routes: [route('openai', 'gpt-4o'), route('anthropic', 'claude')],
        } as unknown as TierAssignment,
      ]);
      tierRepo.find.mockResolvedValueOnce([{ tier: 'standard' } as TierAssignment]);
      specRepo.find.mockResolvedValue([]);

      await svc.removeProvider('agent-1', 'user-1', 'openai');
      const saved = tierRepo.save.mock.calls[0][0];
      expect(saved[0].fallback_routes).toEqual([route('anthropic', 'claude')]);
    });

    it('cleans specificity rows independently from tier rows', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValueOnce([]);
      tierRepo.find.mockResolvedValueOnce([]);
      specRepo.find.mockResolvedValue([
        {
          category: 'coding',
          override_route: route('openai', 'gpt-4o'),
          fallback_routes: [route('openai', 'gpt-4o-mini')],
        } as unknown as SpecificityAssignment,
      ]);

      await svc.removeProvider('agent-1', 'user-1', 'openai');
      expect(specRepo.save).toHaveBeenCalled();
      const savedSpec = specRepo.save.mock.calls[0][0];
      expect(savedSpec[0].override_route).toBeNull();
      expect(savedSpec[0].fallback_routes).toBeNull();
    });

    it('skips override clearing when another auth-type record is still active for the provider', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      // Sibling subscription record remains active.
      providerRepo.find.mockResolvedValue([
        {
          id: 'p2',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'subscription',
          is_active: true,
        },
      ]);

      const result = await svc.removeProvider('agent-1', 'user-1', 'openai');
      expect(tierRepo.find).not.toHaveBeenCalled();
      expect(result.notifications).toEqual([]);
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('clears only disconnected auth-type routes when another auth type stays active', async () => {
      const subscriptionRow = {
        id: 'p-sub',
        agent_id: 'agent-1',
        provider: 'anthropic',
        auth_type: 'subscription',
        is_active: true,
      };
      providerRepo.find
        // Active rows matching the disconnect target.
        .mockResolvedValueOnce([subscriptionRow])
        // Sibling API-key row remains active for the same provider.
        .mockResolvedValueOnce([
          {
            id: 'p-api',
            agent_id: 'agent-1',
            provider: 'anthropic',
            auth_type: 'api_key',
            is_active: true,
          },
        ]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: route('anthropic', 'claude-sonnet-4-6', 'subscription'),
          fallback_routes: [
            route('anthropic', 'claude-opus-4-6', 'subscription'),
            route('anthropic', 'claude-haiku-4-6', 'api_key'),
          ],
        } as unknown as TierAssignment,
      ]);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: route('anthropic', 'claude-haiku-4-6'),
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([
        {
          category: 'coding',
          override_route: route('anthropic', 'claude-sonnet-4-6', 'subscription'),
          fallback_routes: [
            route('anthropic', 'claude-opus-4-6', 'subscription'),
            route('anthropic', 'claude-haiku-4-6', 'api_key'),
          ],
        } as unknown as SpecificityAssignment,
      ]);

      const result = await svc.removeProvider('agent-1', 'user-1', 'anthropic', 'subscription');

      expect(subscriptionRow.is_active).toBe(false);
      const savedTiers = tierRepo.save.mock.calls[0][0];
      expect(savedTiers[0].override_route).toBeNull();
      expect(savedTiers[0].fallback_routes).toEqual([
        route('anthropic', 'claude-haiku-4-6', 'api_key'),
      ]);
      const savedSpec = specRepo.save.mock.calls[0][0];
      expect(savedSpec[0].override_route).toBeNull();
      expect(savedSpec[0].fallback_routes).toEqual([
        route('anthropic', 'claude-haiku-4-6', 'api_key'),
      ]);
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1', 'user-1');
      expect(result.notifications[0]).toMatch(/claude-sonnet-4-6 is no longer available/);
    });

    it('throws NotFoundException when no provider record exists', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(svc.removeProvider('agent-1', 'user-1', 'missing')).rejects.toThrow();
    });

    it('returns no notifications when no tiers/specs reference the provider', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValueOnce([]);
      tierRepo.find.mockResolvedValueOnce([]);
      specRepo.find.mockResolvedValue([]);

      const result = await svc.removeProvider('agent-1', 'user-1', 'openai');
      expect(result.notifications).toEqual([]);
    });
  });

  describe('deactivateAllProviders', () => {
    it('updates providers and tiers, then recalculates and invalidates cache', async () => {
      await svc.deactivateAllProviders('agent-1', 'user-1');

      expect(providerRepo.update).toHaveBeenCalledWith(
        { user_id: 'user-1' },
        expect.objectContaining({ is_active: false }),
      );
      expect(tierRepo.update).toHaveBeenCalledWith(
        { agent_id: 'agent-1' },
        expect.objectContaining({
          override_route: null,
          auto_assigned_route: null,
          fallback_routes: null,
        }),
      );
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1', 'user-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('cleanupUnsupportedSubscriptionProviders (via getProviders)', () => {
    it('no-ops when no unsupported subscription rows exist', async () => {
      providerRepo.find.mockResolvedValue([
        {
          id: 'p1',
          user_id: 'user-1',
          provider: 'openai',
          auth_type: 'api_key',
          is_active: true,
        },
      ]);
      const result = await svc.getProviders('user-1');
      expect(result).toHaveLength(1);
      expect(providerRepo.save).not.toHaveBeenCalled();
      expect(autoAssign.recalculate).not.toHaveBeenCalled();
    });

    it('deactivates unsupported subscription rows and triggers cleanup when no usable sibling remains', async () => {
      // Pretend 'foobar' is an unsupported subscription provider — neither
      // anthropic nor any usable sibling stays for the same provider.
      providerRepo.find
        .mockResolvedValueOnce([
          {
            id: 'p1',
            agent_id: 'agent-1',
            provider: 'foobar',
            auth_type: 'subscription',
            is_active: true,
          },
        ])
        // After cleanupProviderReferences runs.
        .mockResolvedValueOnce([]);
      tierRepo.find.mockResolvedValue([
        {
          tier: 'standard',
          override_route: route('foobar', 'fb-1'),
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);

      const result = await svc.getProviders('user-1');
      // The unsupported row was deactivated.
      expect(providerRepo.save).toHaveBeenCalled();
      // After filter only usable providers are returned (none in this case).
      expect(result).toEqual([]);
      // Tier cleanup for unsupported subscription providers is now deferred lazily;
      // no direct tier save or recalculate is triggered by getProviders anymore.
    });

    it('reads from cache when present', async () => {
      const cached = [
        { id: 'p1', provider: 'openai', auth_type: 'api_key', is_active: true } as UserProvider,
      ];
      routingCache.getProviders.mockReturnValue(cached);
      const result = await svc.getProviders('user-1');
      expect(result).toBe(cached);
      expect(providerRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('upsertProvider — MiniMax subscription region', () => {
    // upsertProvider encrypts the apiKey, which requires an encryption secret —
    // the rest of this suite mocks repos but never hits the encrypt path, so
    // there's no global setup. Keep the secret scoped to this describe.
    let originalSecret: string | undefined;
    beforeAll(() => {
      originalSecret = process.env.BETTER_AUTH_SECRET;
      process.env.BETTER_AUTH_SECRET = 'a'.repeat(48);
    });
    afterAll(() => {
      if (originalSecret === undefined) {
        delete process.env.BETTER_AUTH_SECRET;
      } else {
        process.env.BETTER_AUTH_SECRET = originalSecret;
      }
    });

    it('persists region=cn on a new MiniMax subscription row', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await svc.upsertProvider(
        'agent-1',
        'user-1',
        'minimax',
        'sk-cp-token-from-cn',
        'subscription',
        'cn',
      );

      expect(providerRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'minimax',
          auth_type: 'subscription',
          region: 'cn',
        }),
      );
    });

    it('updates region on an existing MiniMax subscription row', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'minimax',
        auth_type: 'subscription',
        label: 'Default',
        region: 'global',
        is_active: true,
      });

      await svc.upsertProvider(
        'agent-1',
        'user-1',
        'minimax',
        'sk-cp-new-token',
        'subscription',
        'cn',
      );

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'cn',
        }),
      );
    });

    it('preserves existing MiniMax subscription region when caller omits it', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'minimax',
        auth_type: 'subscription',
        label: 'Default',
        region: 'cn',
        is_active: true,
      });

      await svc.upsertProvider('agent-1', 'user-1', 'minimax', 'sk-cp-rotated', 'subscription');

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'cn',
        }),
      );
    });

    it('rejects unsupported MiniMax subscription region', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(
        svc.upsertProvider('agent-1', 'user-1', 'minimax', 'sk-cp-token', 'subscription', 'eu'),
      ).rejects.toThrow('MiniMax subscription region must be one of: global, cn');
    });
  });

  describe('nextOAuthLabel', () => {
    it('returns undefined when no subscription rows exist', async () => {
      providerRepo.find.mockResolvedValue([]);
      const label = await svc.nextOAuthLabel('agent-1', 'openai');
      expect(label).toBeUndefined();
    });

    it('returns "Key 2" when one subscription row exists', async () => {
      providerRepo.find.mockResolvedValue([{ label: 'Default', is_active: true }]);
      const label = await svc.nextOAuthLabel('agent-1', 'openai');
      expect(label).toBe('Key 2');
    });

    it('skips existing labels', async () => {
      providerRepo.find.mockResolvedValue([
        { label: 'Default', is_active: true },
        { label: 'Key 2', is_active: true },
      ]);
      const label = await svc.nextOAuthLabel('agent-1', 'openai');
      expect(label).toBe('Key 3');
    });

    it('is case-insensitive when checking existing labels', async () => {
      providerRepo.find.mockResolvedValue([
        { label: 'Default', is_active: true },
        { label: 'key 2', is_active: true },
      ]);
      const label = await svc.nextOAuthLabel('agent-1', 'openai');
      expect(label).toBe('Key 3');
    });
  });
});
