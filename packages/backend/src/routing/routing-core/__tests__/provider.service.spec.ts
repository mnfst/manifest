import type { ModelRoute } from 'manifest-shared';
import { ProviderService } from '../provider.service';
import { UserProvider } from '../../../entities/user-provider.entity';
import { TierAssignment } from '../../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../../entities/specificity-assignment.entity';
import { Agent } from '../../../entities/agent.entity';
import { HeaderTier } from '../../../entities/header-tier.entity';
import type { Repository } from 'typeorm';
import type { TierAutoAssignService } from '../tier-auto-assign.service';
import type { RoutingCacheService } from '../routing-cache.service';
import type { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';
import { encrypt, getEncryptionSecret } from '../../../common/utils/crypto.util';

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
  remove: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  manager: { transaction: jest.fn() },
});

describe('ProviderService — route-only cleanup paths', () => {
  let providerRepo: ReturnType<typeof makeRepo>;
  let tierRepo: ReturnType<typeof makeRepo>;
  let specRepo: ReturnType<typeof makeRepo>;
  let agentRepo: { createQueryBuilder: jest.Mock };
  let agentQb: { getRawMany: jest.Mock };
  let headerTierRepo: ReturnType<typeof makeRepo>;
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
    agentQb = { getRawMany: jest.fn().mockResolvedValue([]) };
    const chain = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawMany: (...args: unknown[]) => agentQb.getRawMany(...args),
    };
    agentRepo = { createQueryBuilder: jest.fn().mockReturnValue(chain) };
    headerTierRepo = makeRepo();
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
      agentRepo as unknown as Repository<Agent>,
      headerTierRepo as unknown as Repository<HeaderTier>,
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
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }]);
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

    it('preserves a route when the model prefix matches but the route explicitly names a different provider', async () => {
      // Regression guard for the provider-removal data-loss bug: a route with
      // provider="other" and model="custom-x/some" must NOT be cleared when
      // removing provider "custom-x" — the route explicitly names a different
      // provider, so model-name inference must be skipped.
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'custom-x',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }]);
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
          override_route: { provider: 'other', authType: 'api_key', model: 'custom-x/some' },
          auto_assigned_route: null,
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);

      const result = await svc.removeProvider('agent-1', 'user-1', 'custom-x');
      // The route explicitly uses a different provider — it must be preserved.
      expect(tierRepo.save).not.toHaveBeenCalled();
      expect(result.notifications).toHaveLength(0);
    });

    it('uses pricing cache provider attribution only when the route has no explicit provider set', async () => {
      // A route that has no provider field (empty string) should still be
      // matchable via pricing-cache attribution. This verifies the fallback
      // path is still exercised for model-only references.
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }]);
      pricingCache.getByModel.mockReturnValue({ provider: 'openai' } as never);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          // No explicit provider field — pricing cache attribution applies.
          override_route: { provider: '', authType: 'api_key', model: 'opaque-id' },
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

    it('does NOT clear a route via openrouter when anthropic is removed and model belongs to anthropic in pricing cache', async () => {
      // Core regression: removing provider "anthropic" must not clear a tier
      // route whose provider is "openrouter" — even if the model
      // (claude-3-5-sonnet) is attributed to anthropic by the pricing cache.
      // The route is still valid because openrouter is a separate provider.
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'anthropic',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }]);
      pricingCache.getByModel.mockReturnValue({ provider: 'anthropic' } as never);
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: {
            provider: 'openrouter',
            authType: 'api_key',
            model: 'claude-3-5-sonnet',
          },
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      // Re-read tiers for notification map — route still present (not cleared).
      tierRepo.find.mockResolvedValueOnce([
        {
          tier: 'standard',
          override_route: {
            provider: 'openrouter',
            authType: 'api_key',
            model: 'claude-3-5-sonnet',
          },
          auto_assigned_route: null,
        } as unknown as TierAssignment,
      ]);
      specRepo.find.mockResolvedValue([]);

      const result = await svc.removeProvider('agent-1', 'user-1', 'anthropic');
      // The openrouter route must be preserved — do not save any tier changes.
      expect(tierRepo.save).not.toHaveBeenCalled();
      expect(result.notifications).toHaveLength(0);
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
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }]);
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
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }]);
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
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }]);
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
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }]);
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

    it('fans out tier cleanup to ALL owned agents when a standard (non-null) agentId provider is removed', async () => {
      // The request comes in for agent-1, but the user also owns agent-2.
      // Removing a user-global provider must clean stale routes on agent-2 too.
      providerRepo.find
        // active rows to deactivate
        .mockResolvedValueOnce([
          { id: 'r1', provider: 'openai', auth_type: 'api_key', is_active: true },
        ])
        // otherActive after deactivation → none usable
        .mockResolvedValueOnce([]);
      // listOwnedAgentIds returns both agents
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }, { id: 'agent-2' }]);

      // agent-1 has an override_route pointing at openai
      // agent-2 has a fallback_route pointing at openai (the sibling stale route)
      tierRepo.find
        // cleanupProviderReferences for agent-1
        .mockResolvedValueOnce([
          {
            tier: 'standard',
            override_route: route('openai', 'gpt-4o'),
            fallback_routes: null,
          } as unknown as TierAssignment,
        ])
        // re-read tiers for notification map (agent-1)
        .mockResolvedValueOnce([
          { tier: 'standard', override_route: null, auto_assigned_route: null } as TierAssignment,
        ])
        // cleanupProviderReferences for agent-2 — stale fallback pointing at openai
        .mockResolvedValueOnce([
          {
            tier: 'standard',
            override_route: null,
            fallback_routes: [route('openai', 'gpt-4o-mini'), route('anthropic', 'claude')],
          } as unknown as TierAssignment,
        ])
        // re-read tiers for notification map (agent-2)
        .mockResolvedValueOnce([
          { tier: 'standard', override_route: null, auto_assigned_route: null } as TierAssignment,
        ]);
      specRepo.find.mockResolvedValue([]);

      const result = await svc.removeProvider('agent-1', 'user-1', 'openai');

      // autoAssign.recalculate must be called for BOTH agents, not just agent-1
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1', 'user-1');
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-2', 'user-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-2');

      // tierRepo.save should have been called twice: once per agent that had stale routes
      // (agent-1 override cleared, agent-2 fallback filtered)
      const allSaveCalls = tierRepo.save.mock.calls;
      // agent-1: override_route cleared
      const agent1Save = allSaveCalls[0][0];
      expect(agent1Save[0].override_route).toBeNull();
      // agent-2: openai fallback filtered out, anthropic route preserved
      const agent2Save = allSaveCalls[1][0];
      expect(agent2Save[0].fallback_routes).toEqual([route('anthropic', 'claude')]);

      expect(routingCache.invalidateUser).toHaveBeenCalledWith('user-1');
      expect(result.notifications.length).toBeGreaterThan(0);
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
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }]);
      tierRepo.find.mockResolvedValueOnce([]);
      tierRepo.find.mockResolvedValueOnce([]);
      specRepo.find.mockResolvedValue([]);

      const result = await svc.removeProvider('agent-1', 'user-1', 'openai');
      expect(result.notifications).toEqual([]);
    });
  });

  describe('removeProvider — removeKeyByLabel', () => {
    it('throws NotFoundException when no keys match the (provider, auth_type)', async () => {
      providerRepo.find.mockResolvedValue([]);
      await expect(
        svc.removeProvider('agent-1', 'user-1', 'openai', 'api_key', 'default'),
      ).rejects.toThrow('Provider not found');
    });

    it('throws NotFoundException when no key carries the requested label', async () => {
      providerRepo.find.mockResolvedValue([
        {
          id: 'p1',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'api_key',
          label: 'primary',
          is_active: true,
        } as unknown as UserProvider,
      ]);
      await expect(
        svc.removeProvider('agent-1', 'user-1', 'openai', 'api_key', 'secondary'),
      ).rejects.toThrow('Provider key not found');
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
      expect(headerTierRepo.update).toHaveBeenCalledWith(
        { agent_id: 'agent-1' },
        expect.objectContaining({ override_route: null, fallback_routes: null }),
      );
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1', 'user-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('header-tier cleanup on disconnect / rename', () => {
    const headerPin = (keyLabel: string | null) => ({
      provider: 'openai',
      authType: 'subscription' as const,
      model: 'openai/gpt-5',
      keyLabel,
    });

    it('relabels header-tier key pins to null when one of several keys is disconnected', async () => {
      providerRepo.find.mockResolvedValue([
        {
          id: 'target',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'subscription',
          label: 'Key 2',
          is_active: true,
        },
        {
          id: 'other',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'subscription',
          label: 'Default',
          is_active: true,
        },
      ]);
      tierRepo.find.mockResolvedValue([]);
      specRepo.find.mockResolvedValue([]);
      headerTierRepo.find.mockResolvedValue([
        {
          id: 'h1',
          override_route: headerPin('Key 2'),
          fallback_routes: [headerPin('Key 2'), headerPin('Default')],
        } as unknown as HeaderTier,
        // Non-matching tier (different pinned label) must be left untouched.
        {
          id: 'h2',
          override_route: headerPin('Default'),
          fallback_routes: null,
        } as unknown as HeaderTier,
      ]);

      await svc.removeProvider('agent-1', 'user-1', 'openai', 'subscription', 'Key 2');

      expect(headerTierRepo.save).toHaveBeenCalledTimes(1);
      const saved = headerTierRepo.save.mock.calls[0][0] as HeaderTier[];
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('h1');
      expect(saved[0].override_route?.keyLabel).toBeNull();
      expect(saved[0].fallback_routes?.[0].keyLabel).toBeNull();
      expect(saved[0].fallback_routes?.[1].keyLabel).toBe('Default');
    });

    it('rewrites header-tier key pins to the new label on rename', async () => {
      providerRepo.find.mockResolvedValue([
        {
          id: 'target',
          agent_id: 'agent-1',
          provider: 'openai',
          auth_type: 'subscription',
          label: 'Key 2',
          is_active: true,
        },
      ]);
      tierRepo.find.mockResolvedValue([]);
      specRepo.find.mockResolvedValue([]);
      headerTierRepo.find.mockResolvedValue([
        {
          id: 'h1',
          override_route: headerPin('Key 2'),
          fallback_routes: null,
        } as unknown as HeaderTier,
      ]);

      await svc.renameKey('agent-1', 'user-1', 'openai', 'subscription', 'Key 2', 'Renamed');

      const saved = headerTierRepo.save.mock.calls[0][0] as HeaderTier[];
      expect(saved[0].override_route?.keyLabel).toBe('Renamed');
    });

    it('clears header-tier routes belonging to a fully disconnected provider', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
      });
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValue([]);
      specRepo.find.mockResolvedValue([]);
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }]);
      headerTierRepo.find.mockResolvedValue([
        {
          id: 'h1',
          override_route: route('OpenAI', 'gpt-4o'),
          fallback_routes: [route('openai', 'gpt-4o-mini'), route('anthropic', 'claude')],
        } as unknown as HeaderTier,
        // Belongs to another provider — must survive.
        {
          id: 'h2',
          override_route: route('anthropic', 'claude'),
          fallback_routes: null,
        } as unknown as HeaderTier,
      ]);

      await svc.removeProvider('agent-1', 'user-1', 'openai');

      expect(headerTierRepo.save).toHaveBeenCalledTimes(1);
      const saved = headerTierRepo.save.mock.calls[0][0] as HeaderTier[];
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('h1');
      expect(saved[0].override_route).toBeNull();
      expect(saved[0].fallback_routes).toEqual([route('anthropic', 'claude')]);
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

  describe('upsertProvider — Z.ai subscription region', () => {
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

    it('persists region=global on a new Z.ai subscription row', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await svc.upsertProvider('agent-1', 'user-1', 'zai', 'zai-sub-key', 'subscription', 'global');

      expect(providerRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'zai',
          auth_type: 'subscription',
          region: 'global',
        }),
      );
    });

    it('updates region on an existing Z.ai subscription row', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'zai',
        auth_type: 'subscription',
        label: 'Default',
        region: 'cn',
        is_active: true,
      });

      await svc.upsertProvider('agent-1', 'user-1', 'zai', 'zai-new-key', 'subscription', 'global');

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'global',
        }),
      );
    });

    it('preserves existing Z.ai subscription region when caller omits it', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'zai',
        auth_type: 'subscription',
        label: 'Default',
        region: 'cn',
        is_active: true,
      });

      await svc.upsertProvider('agent-1', 'user-1', 'zai', 'zai-rotated', 'subscription');

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'cn',
        }),
      );
    });

    it('preserves existing dotted Z.ai alias subscription region when caller omits it', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'z.ai',
        auth_type: 'subscription',
        label: 'Default',
        region: 'cn',
        is_active: true,
      });

      await svc.upsertProvider('agent-1', 'user-1', 'z.ai', 'zai-rotated', 'subscription');

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'z.ai',
          region: 'cn',
        }),
      );
    });

    it('rejects unsupported Z.ai subscription region', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(
        svc.upsertProvider('agent-1', 'user-1', 'zai', 'zai-sub-key', 'subscription', 'eu'),
      ).rejects.toThrow('Z.ai subscription region must be one of: global, cn');
    });
  });

  describe('upsertProvider — Xiaomi MiMo Token Plan region', () => {
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

    it('persists region=ams on a new Xiaomi subscription row', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await svc.upsertProvider(
        'agent-1',
        'user-1',
        'xiaomi',
        'tp-mimo-token',
        'subscription',
        'ams',
      );

      expect(providerRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'xiaomi',
          auth_type: 'subscription',
          region: 'ams',
        }),
      );
    });

    it('updates region on an existing Xiaomi subscription row', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'xiaomi',
        auth_type: 'subscription',
        label: 'Default',
        region: 'cn',
        is_active: true,
      });

      await svc.upsertProvider(
        'agent-1',
        'user-1',
        'xiaomi',
        'tp-mimo-new-token',
        'subscription',
        'sgp',
      );

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'sgp',
        }),
      );
    });

    it('preserves existing Xiaomi subscription region when caller omits it', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'xiaomi',
        auth_type: 'subscription',
        label: 'Default',
        region: 'ams',
        is_active: true,
      });

      await svc.upsertProvider('agent-1', 'user-1', 'xiaomi', 'tp-mimo-rotated', 'subscription');

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'ams',
        }),
      );
    });

    it('preserves existing Xiaomi alias subscription region when caller omits it', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        agent_id: 'agent-1',
        provider: 'mimo',
        auth_type: 'subscription',
        label: 'Default',
        region: 'ams',
        is_active: true,
      });

      await svc.upsertProvider('agent-1', 'user-1', 'mimo', 'tp-mimo-rotated', 'subscription');

      expect(providerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'mimo',
          region: 'ams',
        }),
      );
    });

    it('rejects unsupported Xiaomi subscription region', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(
        svc.upsertProvider('agent-1', 'user-1', 'xiaomi', 'tp-mimo-token', 'subscription', 'eu'),
      ).rejects.toThrow('Xiaomi MiMo Token Plan region must be one of: cn, sgp, ams');
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

  describe('recalculateTiersForUser', () => {
    it('recalculates and invalidates every agent the user owns', async () => {
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }, { id: 'agent-2' }]);
      await svc.recalculateTiersForUser('user-1');
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1', 'user-1');
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-2', 'user-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-2');
    });

    it('is a no-op when the user owns no agents', async () => {
      agentQb.getRawMany.mockResolvedValue([]);
      await svc.recalculateTiersForUser('user-1');
      expect(autoAssign.recalculate).not.toHaveBeenCalled();
    });
  });

  describe('user-global changes (null agentId)', () => {
    it('upsertProvider with a null agentId recalculates every owned agent', async () => {
      // No existing row → insert path, then afterProviderChange(null) fans out.
      providerRepo.findOne.mockResolvedValue(null);
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }, { id: 'agent-2' }]);

      const { isNew } = await svc.upsertProvider(
        null,
        'user-1',
        'custom:cp1',
        undefined,
        'api_key',
      );

      expect(isNew).toBe(true);
      expect(providerRepo.insert).toHaveBeenCalledTimes(1);
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1', 'user-1');
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-2', 'user-1');
      expect(routingCache.invalidateUser).toHaveBeenCalledWith('user-1');
    });

    it('retagAuthType with a null agentId flips the row without touching agent caches', async () => {
      const target = {
        id: 'r1',
        provider: 'custom:cp1',
        auth_type: 'local',
        label: 'Default',
        is_active: true,
      };
      providerRepo.manager.transaction.mockImplementation(async (cb: (m: unknown) => unknown) => {
        const txRepo = {
          find: jest.fn().mockResolvedValue([target]),
          remove: jest.fn(),
          save: jest.fn(),
        };
        return cb({ getRepository: () => txRepo });
      });

      await svc.retagAuthType(null, 'user-1', 'custom:cp1', 'api_key');

      expect(routingCache.invalidateAgent).not.toHaveBeenCalled();
      expect(routingCache.invalidateUser).toHaveBeenCalledWith('user-1');
    });

    it('removeProvider with a null agentId cleans references across every owned agent', async () => {
      providerRepo.find
        // active rows to deactivate
        .mockResolvedValueOnce([
          { id: 'r1', provider: 'custom:cp1', auth_type: 'api_key', is_active: true },
        ])
        // otherActive after deactivation → none usable
        .mockResolvedValueOnce([]);
      agentQb.getRawMany.mockResolvedValue([{ id: 'agent-1' }, { id: 'agent-2' }]);
      // cleanupProviderReferences reads tiers/specificity per agent — return empty.
      tierRepo.find.mockResolvedValue([]);
      specRepo.find.mockResolvedValue([]);

      const result = await svc.removeProvider(null, 'user-1', 'custom:cp1');

      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1', 'user-1');
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-2', 'user-1');
      expect(routingCache.invalidateUser).toHaveBeenCalledWith('user-1');
      expect(result.notifications).toEqual([]);
    });

    it('removeProvider with a null agentId and a still-usable provider skips agent-cache invalidation', async () => {
      providerRepo.find
        .mockResolvedValueOnce([
          { id: 'r1', provider: 'custom:cp1', auth_type: 'api_key', is_active: true },
        ])
        // otherActive still has a usable key → early return, no agent invalidation.
        .mockResolvedValueOnce([
          {
            id: 'r2',
            provider: 'custom:cp1',
            auth_type: 'api_key',
            is_active: true,
            api_key_encrypted: 'enc',
          },
        ]);

      const result = await svc.removeProvider(null, 'user-1', 'custom:cp1');

      expect(routingCache.invalidateAgent).not.toHaveBeenCalled();
      expect(routingCache.invalidateUser).toHaveBeenCalledWith('user-1');
      expect(result.notifications).toEqual([]);
    });
  });
});

describe('ProviderService — getFreshSubscriptionCredential', () => {
  const PREV_KEY = process.env.MANIFEST_ENCRYPTION_KEY;
  let providerRepo: ReturnType<typeof makeRepo>;
  let svc: ProviderService;

  beforeAll(() => {
    process.env.MANIFEST_ENCRYPTION_KEY = 'unit-test-encryption-key-1234567890';
  });
  afterAll(() => {
    if (PREV_KEY === undefined) delete process.env.MANIFEST_ENCRYPTION_KEY;
    else process.env.MANIFEST_ENCRYPTION_KEY = PREV_KEY;
  });

  beforeEach(() => {
    providerRepo = makeRepo();
    svc = new ProviderService(
      providerRepo as unknown as Repository<UserProvider>,
      makeRepo() as unknown as Repository<TierAssignment>,
      makeRepo() as unknown as Repository<SpecificityAssignment>,
      { createQueryBuilder: jest.fn() } as unknown as Repository<Agent>,
      makeRepo() as unknown as Repository<HeaderTier>,
      { recalculate: jest.fn() } as unknown as TierAutoAssignService,
      { getByModel: jest.fn() } as unknown as ModelPricingCacheService,
      {
        getProviders: jest.fn(),
        setProviders: jest.fn(),
        invalidateAgent: jest.fn(),
        invalidateUser: jest.fn(),
      } as unknown as RoutingCacheService,
    );
  });

  it('returns the decrypted raw credential, scanning subscription rows for the user/provider', async () => {
    const raw = JSON.stringify({ t: 'access', r: 'refresh', e: 123 });
    providerRepo.find.mockResolvedValue([
      { label: 'Work', api_key_encrypted: encrypt(raw, getEncryptionSecret()) },
    ]);

    const out = await svc.getFreshSubscriptionCredential('user-1', 'openai', 'Work');

    expect(out).toBe(raw);
    expect(providerRepo.find).toHaveBeenCalledWith({
      where: { user_id: 'user-1', provider: 'openai', auth_type: 'subscription' },
    });
  });

  it('matches the label case-insensitively', async () => {
    const raw = JSON.stringify({ t: 'a', r: 'r', e: 1 });
    providerRepo.find.mockResolvedValue([
      { label: 'Other', api_key_encrypted: encrypt('nope', getEncryptionSecret()) },
      { label: 'work', api_key_encrypted: encrypt(raw, getEncryptionSecret()) },
    ]);

    // Stored row is "work"; the pinned route asks for "WORK".
    const out = await svc.getFreshSubscriptionCredential('user-1', 'openai', 'WORK');

    expect(out).toBe(raw);
  });

  it('defaults the label to Default when none is provided', async () => {
    const raw = JSON.stringify({ t: 'a', r: 'r', e: 1 });
    providerRepo.find.mockResolvedValue([
      { label: 'Default', api_key_encrypted: encrypt(raw, getEncryptionSecret()) },
    ]);

    expect(await svc.getFreshSubscriptionCredential('user-1', 'anthropic')).toBe(raw);
  });

  it('returns null when no row matches the label', async () => {
    providerRepo.find.mockResolvedValue([
      { label: 'Something else', api_key_encrypted: encrypt('x', getEncryptionSecret()) },
    ]);
    expect(await svc.getFreshSubscriptionCredential('user-1', 'openai')).toBeNull();
  });

  it('returns null when there are no subscription rows', async () => {
    providerRepo.find.mockResolvedValue([]);
    expect(await svc.getFreshSubscriptionCredential('user-1', 'openai')).toBeNull();
  });

  it('returns null when the matched row has no stored credential', async () => {
    providerRepo.find.mockResolvedValue([{ label: 'Default', api_key_encrypted: null }]);
    expect(await svc.getFreshSubscriptionCredential('user-1', 'openai')).toBeNull();
  });

  it('returns null when the stored credential cannot be decrypted', async () => {
    providerRepo.find.mockResolvedValue([
      { label: 'Default', api_key_encrypted: 'not-a-valid-ciphertext' },
    ]);
    expect(await svc.getFreshSubscriptionCredential('user-1', 'openai')).toBeNull();
  });
});
