import { HttpException } from '@nestjs/common';
import { AgentProviderAccessController } from './agent-provider-access.controller';
import type { AgentProviderAccess } from '../entities/agent-provider-access.entity';
import type { UserProvider } from '../entities/user-provider.entity';
import type { TierAssignment } from '../entities/tier-assignment.entity';
import type { SpecificityAssignment } from '../entities/specificity-assignment.entity';
import type { HeaderTier } from '../entities/header-tier.entity';

const AGENT_ID = 'agent-uuid-1';
const USER_ID = 'user-1';
const TENANT_ID = 'tenant-abc';
const PROVIDER_ID = 'prov-uuid-1';

function makeController(overrides: Record<string, unknown> = {}) {
  const tenant = { id: TENANT_ID };
  const agent = { id: AGENT_ID, name: 'my-agent', tenant_id: TENANT_ID };

  const accessRepo = {
    find: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    }),
    ...((overrides.accessRepo as object) ?? {}),
  };

  const agentRepo = {
    findOne: jest.fn().mockResolvedValue(agent),
    ...((overrides.agentRepo as object) ?? {}),
  };

  const tenantRepo = {
    findOne: jest.fn().mockResolvedValue(tenant),
    ...((overrides.tenantRepo as object) ?? {}),
  };

  const userProviderRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    ...((overrides.userProviderRepo as object) ?? {}),
  };

  const tierRepo = {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue(undefined),
    ...((overrides.tierRepo as object) ?? {}),
  };
  const specificityRepo = {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue(undefined),
    ...((overrides.specificityRepo as object) ?? {}),
  };
  const headerTierRepo = {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue(undefined),
    ...((overrides.headerTierRepo as object) ?? {}),
  };

  const providerService = {
    recalculateTiers: jest.fn().mockResolvedValue(undefined),
    ...((overrides.providerService as object) ?? {}),
  };

  return {
    controller: new AgentProviderAccessController(
      accessRepo as never,
      agentRepo as never,
      tenantRepo as never,
      userProviderRepo as never,
      tierRepo as never,
      specificityRepo as never,
      headerTierRepo as never,
      providerService as never,
    ),
    accessRepo,
    agentRepo,
    tenantRepo,
    userProviderRepo,
    tierRepo,
    specificityRepo,
    headerTierRepo,
    providerService,
    agent,
    tenant,
  };
}

describe('AgentProviderAccessController', () => {
  describe('resolveAgent — is_system: false filter', () => {
    it('passes is_system: false in the agentRepo.findOne where-clause', async () => {
      const { controller, agentRepo } = makeController();
      await controller.listEnabled({ id: USER_ID } as never, 'my-agent');
      expect(agentRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_system: false }),
        }),
      );
    });

    it('returns empty enabled list for a system agent (agentRepo.findOne returns null because is_system: false filters it out)', async () => {
      // Simulate the DB returning null because the agent has is_system: true
      // and the query filters on is_system: false.
      const { controller } = makeController({
        agentRepo: { findOne: jest.fn().mockResolvedValue(null) },
      });
      const result = await controller.listEnabled({ id: USER_ID } as never, 'Playground');
      expect(result).toEqual({ enabled: [] });
    });

    it('throws 404 on enable when agentRepo.findOne returns null for a system agent', async () => {
      const { controller } = makeController({
        agentRepo: { findOne: jest.fn().mockResolvedValue(null) },
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({ id: PROVIDER_ID, user_id: USER_ID }),
        },
      });
      await expect(
        controller.enable({ id: USER_ID } as never, 'Playground', PROVIDER_ID),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('throws 404 on disable when agentRepo.findOne returns null for a system agent', async () => {
      const { controller } = makeController({
        agentRepo: { findOne: jest.fn().mockResolvedValue(null) },
      });
      await expect(
        controller.disable({ id: USER_ID } as never, 'Playground', PROVIDER_ID),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('listEnabled', () => {
    it('returns empty enabled list when agent not found', async () => {
      const { controller } = makeController({
        tenantRepo: { findOne: jest.fn().mockResolvedValue(null) },
      });
      const result = await controller.listEnabled({ id: USER_ID } as never, 'missing-agent');
      expect(result).toEqual({ enabled: [] });
    });

    it('returns enabled user_provider_ids for agent', async () => {
      const rows: Partial<AgentProviderAccess>[] = [
        { agent_id: AGENT_ID, user_provider_id: 'prov-1' },
        { agent_id: AGENT_ID, user_provider_id: 'prov-2' },
      ];
      const { controller } = makeController({
        accessRepo: { find: jest.fn().mockResolvedValue(rows) },
      });
      const result = await controller.listEnabled({ id: USER_ID } as never, 'my-agent');
      expect(result).toEqual({ enabled: ['prov-1', 'prov-2'] });
    });
  });

  describe('getDisableImpact', () => {
    it('throws 404 when agent not found', async () => {
      const { controller } = makeController({
        agentRepo: { findOne: jest.fn().mockResolvedValue(null) },
      });
      await expect(
        controller.getDisableImpact({ id: USER_ID } as never, 'missing', PROVIDER_ID),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('returns empty affected_tiers when provider not found', async () => {
      const { controller } = makeController();
      const result = await controller.getDisableImpact(
        { id: USER_ID } as never,
        'my-agent',
        PROVIDER_ID,
      );
      expect(result).toEqual({ affected_tiers: [] });
    });

    it('returns empty affected_tiers when provider has no cached models and no tiers route to it', async () => {
      const { controller } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            cached_models: [],
          } as Partial<UserProvider>),
        },
      });
      const result = await controller.getDisableImpact(
        { id: USER_ID } as never,
        'my-agent',
        PROVIDER_ID,
      );
      expect(result).toEqual({ affected_tiers: [] });
    });

    it('handles non-array cached_models gracefully (treats as empty, no crash)', async () => {
      // Covers the Array.isArray(...) ? ... : [] else branch on line 64.
      const { controller } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            cached_models: null,
          } as Partial<UserProvider>),
        },
      });
      const result = await controller.getDisableImpact(
        { id: USER_ID } as never,
        'my-agent',
        PROVIDER_ID,
      );
      expect(result).toEqual({ affected_tiers: [] });
    });

    it('ignores historical auto_assigned_route rows when previewing disable impact', async () => {
      // auto_assigned_route is legacy system-authored state, not a user-authored
      // assignment. The impact preview only reports routes the user still controls.
      const tiers: Partial<TierAssignment>[] = [
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
          fallback_routes: null,
        },
      ];
      const { controller } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            label: 'Default',
            cached_models: [{ id: 'gpt-4o' }],
          } as Partial<UserProvider>),
        },
        tierRepo: {
          find: jest.fn().mockResolvedValue(tiers),
          save: jest.fn().mockResolvedValue(undefined),
        },
      });
      const result = await controller.getDisableImpact(
        { id: USER_ID } as never,
        'my-agent',
        PROVIDER_ID,
      );
      expect(result.affected_tiers).toEqual([]);
    });

    it('matches a fallback route only by cached model id (no route.provider)', async () => {
      // Covers the providerModels.has(route.model) branch of the predicate for a
      // route that carries no provider field.
      const tiers: Partial<TierAssignment>[] = [
        {
          tier: 'complex',
          override_route: null,
          auto_assigned_route: null,
          fallback_routes: [{ provider: '', authType: 'api_key', model: 'gpt-4o' }],
        },
      ];
      const { controller } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            label: 'Default',
            cached_models: [{ id: 'gpt-4o' }],
          } as Partial<UserProvider>),
        },
        tierRepo: {
          find: jest.fn().mockResolvedValue(tiers),
          save: jest.fn().mockResolvedValue(undefined),
        },
      });
      const result = await controller.getDisableImpact(
        { id: USER_ID } as never,
        'my-agent',
        PROVIDER_ID,
      );
      expect(result.affected_tiers).toEqual([
        { tier: 'complex', model: 'gpt-4o', position: 'fallback 1' },
      ]);
    });

    it('skips a route whose authType or keyLabel does not match the disabled provider', async () => {
      // Covers the authType-mismatch and keyLabel-mismatch early returns in the
      // predicate (route.provider matches name but a finer field diverges).
      const tiers: Partial<TierAssignment>[] = [
        {
          tier: 'simple',
          override_route: { provider: 'openai', authType: 'subscription', model: 'gpt-4o' },
          auto_assigned_route: null,
          fallback_routes: [
            { provider: 'openai', authType: 'api_key', model: 'gpt-4o', keyLabel: 'Other' },
          ],
        },
      ];
      const { controller } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            label: 'Default',
            cached_models: [{ id: 'gpt-4o' }],
          } as Partial<UserProvider>),
        },
        tierRepo: {
          find: jest.fn().mockResolvedValue(tiers),
          save: jest.fn().mockResolvedValue(undefined),
        },
      });
      const result = await controller.getDisableImpact(
        { id: USER_ID } as never,
        'my-agent',
        PROVIDER_ID,
      );
      expect(result.affected_tiers).toEqual([]);
    });

    it('returns affected_tiers for override_route models', async () => {
      const tiers: Partial<TierAssignment>[] = [
        {
          tier: 'standard',
          override_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
          auto_assigned_route: null,
          fallback_routes: null,
        },
      ];
      const { controller } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            label: 'Default',
            cached_models: [{ id: 'gpt-4o' }],
          } as Partial<UserProvider>),
        },
        tierRepo: {
          find: jest.fn().mockResolvedValue(tiers),
          save: jest.fn().mockResolvedValue(undefined),
        },
      });
      const result = await controller.getDisableImpact(
        { id: USER_ID } as never,
        'my-agent',
        PROVIDER_ID,
      );
      expect(result.affected_tiers).toHaveLength(1);
      expect(result.affected_tiers[0]).toEqual({
        tier: 'standard',
        model: 'gpt-4o',
        position: 'primary',
      });
    });

    it('returns affected_tiers for fallback route models', async () => {
      const tiers: Partial<TierAssignment>[] = [
        {
          tier: 'complex',
          override_route: null,
          auto_assigned_route: null,
          fallback_routes: [
            { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
            { provider: 'anthropic', authType: 'api_key', model: 'claude-3-5-sonnet' },
          ],
        },
      ];
      const { controller } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            label: 'Default',
            cached_models: [{ id: 'gpt-4o' }],
          } as Partial<UserProvider>),
        },
        tierRepo: {
          find: jest.fn().mockResolvedValue(tiers),
          save: jest.fn().mockResolvedValue(undefined),
        },
      });
      const result = await controller.getDisableImpact(
        { id: USER_ID } as never,
        'my-agent',
        PROVIDER_ID,
      );
      expect(result.affected_tiers).toHaveLength(1);
      expect(result.affected_tiers[0]).toEqual({
        tier: 'complex',
        model: 'gpt-4o',
        position: 'fallback 1',
      });
    });
  });

  describe('enable (PUT)', () => {
    it('throws 404 when agent not found', async () => {
      const { controller } = makeController({
        agentRepo: { findOne: jest.fn().mockResolvedValue(null) },
      });
      await expect(
        controller.enable({ id: USER_ID } as never, 'missing', PROVIDER_ID),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('throws 404 when provider not found', async () => {
      const { controller } = makeController();
      await expect(
        controller.enable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('inserts grant and invalidates routing cache on success', async () => {
      const qb = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      const { controller, accessRepo, providerService } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
          } as Partial<UserProvider>),
        },
        accessRepo: {
          createQueryBuilder: jest.fn().mockReturnValue(qb),
        },
      });

      const result = await controller.enable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID);

      expect(result).toEqual({ ok: true });
      expect(accessRepo.createQueryBuilder).toHaveBeenCalled();
      expect(qb.orIgnore).toHaveBeenCalled();
      expect(qb.execute).toHaveBeenCalled();
      expect(providerService.recalculateTiers).toHaveBeenCalledWith(AGENT_ID, USER_ID);
    });
  });

  describe('disable (DELETE)', () => {
    it('throws 404 when agent not found', async () => {
      const { controller } = makeController({
        agentRepo: { findOne: jest.fn().mockResolvedValue(null) },
      });
      await expect(
        controller.disable({ id: USER_ID } as never, 'missing', PROVIDER_ID),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('deletes access row and invalidates routing cache when provider not found', async () => {
      const { controller, accessRepo, providerService } = makeController();

      const result = await controller.disable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID);

      expect(result).toEqual({ ok: true });
      expect(accessRepo.delete).toHaveBeenCalledWith({
        agent_id: AGENT_ID,
        user_provider_id: PROVIDER_ID,
      });
      expect(providerService.recalculateTiers).toHaveBeenCalledWith(AGENT_ID, USER_ID);
    });

    it('throws conflict and leaves access enabled when a tier route uses the provider', async () => {
      const tier: Partial<TierAssignment> = {
        tier: 'standard',
        override_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
        auto_assigned_route: null,
        fallback_routes: null,
      };
      const { controller, accessRepo, providerService } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            label: 'Default',
            cached_models: [{ id: 'gpt-4o' }],
          } as Partial<UserProvider>),
        },
        tierRepo: {
          find: jest.fn().mockResolvedValue([tier]),
        },
      });

      await expect(
        controller.disable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID),
      ).rejects.toThrow(/assigned to this harness/);

      expect(accessRepo.delete).not.toHaveBeenCalled();
      expect(providerService.recalculateTiers).not.toHaveBeenCalled();
      expect(tier.override_route).not.toBeNull();
    });

    it('deletes access row when no routes match the provider', async () => {
      const tier: Partial<TierAssignment> = {
        tier: 'standard',
        override_route: { provider: 'anthropic', authType: 'api_key', model: 'claude-3-5-sonnet' },
        auto_assigned_route: null,
        fallback_routes: null,
      };
      const { controller, accessRepo, providerService } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            label: 'Default',
            cached_models: [{ id: 'gpt-4o' }],
          } as Partial<UserProvider>),
        },
        tierRepo: {
          find: jest.fn().mockResolvedValue([tier]),
        },
      });

      const result = await controller.disable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID);

      expect(result).toEqual({ ok: true });
      expect(accessRepo.delete).toHaveBeenCalledWith({
        agent_id: AGENT_ID,
        user_provider_id: PROVIDER_ID,
      });
      expect(providerService.recalculateTiers).toHaveBeenCalledWith(AGENT_ID, USER_ID);
      expect(tier.override_route).not.toBeNull();
    });

    it('handles non-array cached_models gracefully while still matching explicit provider routes', async () => {
      const tier: Partial<TierAssignment> = {
        tier: 'standard',
        override_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
        auto_assigned_route: null,
        fallback_routes: null,
      };
      const { controller, accessRepo } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            label: 'Default',
            cached_models: null,
          } as Partial<UserProvider>),
        },
        tierRepo: {
          find: jest.fn().mockResolvedValue([tier]),
        },
      });

      await expect(
        controller.disable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID),
      ).rejects.toThrow(/assigned to this harness/);

      expect(accessRepo.delete).not.toHaveBeenCalled();
      expect(tier.override_route).not.toBeNull();
    });

    it('skips route whose authType does not match the disabled provider', async () => {
      const tier: Partial<TierAssignment> = {
        tier: 'simple',
        override_route: { provider: 'openai', authType: 'subscription', model: 'gpt-4o' },
        auto_assigned_route: null,
        fallback_routes: null,
      };
      const { controller, accessRepo } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            label: 'Default',
            cached_models: [],
          } as Partial<UserProvider>),
        },
        tierRepo: {
          find: jest.fn().mockResolvedValue([tier]),
        },
      });

      await controller.disable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID);

      expect(accessRepo.delete).toHaveBeenCalled();
      expect(tier.override_route).not.toBeNull();
    });

    it('ignores matching auto_assigned_route when disabling provider access', async () => {
      const tier: Partial<TierAssignment> = {
        tier: 'standard',
        override_route: null,
        auto_assigned_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
        fallback_routes: null,
      };
      const { controller, accessRepo } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            label: 'Default',
            cached_models: [],
          } as Partial<UserProvider>),
        },
        tierRepo: {
          find: jest.fn().mockResolvedValue([tier]),
        },
      });

      await controller.disable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID);

      expect(accessRepo.delete).toHaveBeenCalled();
      expect(tier.auto_assigned_route).not.toBeNull();
    });

    it('throws conflict when a fallback route uses the provider', async () => {
      const tier: Partial<TierAssignment> = {
        tier: 'complex',
        override_route: null,
        auto_assigned_route: null,
        fallback_routes: [{ provider: 'openai', authType: 'api_key', model: 'gpt-4o' }],
      };
      const { controller, accessRepo } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            label: 'Default',
            cached_models: [],
          } as Partial<UserProvider>),
        },
        tierRepo: {
          find: jest.fn().mockResolvedValue([tier]),
        },
      });

      await expect(
        controller.disable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID),
      ).rejects.toThrow(/assigned to this harness/);

      expect(accessRepo.delete).not.toHaveBeenCalled();
      expect(tier.fallback_routes).toHaveLength(1);
    });

    it('skips route whose keyLabel does not match the disabled provider', async () => {
      const tier: Partial<TierAssignment> = {
        tier: 'simple',
        override_route: {
          provider: 'openai',
          authType: 'api_key',
          model: 'gpt-4o',
          keyLabel: 'Other',
        },
        auto_assigned_route: null,
        fallback_routes: null,
      };
      const { controller, accessRepo } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            label: 'Default',
            cached_models: [],
          } as Partial<UserProvider>),
        },
        tierRepo: {
          find: jest.fn().mockResolvedValue([tier]),
        },
      });

      await controller.disable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID);

      expect(accessRepo.delete).toHaveBeenCalled();
      expect(tier.override_route).not.toBeNull();
    });

    it('throws conflict for a fallback route matched by cached model id', async () => {
      const tier: Partial<TierAssignment> = {
        tier: 'complex',
        override_route: null,
        auto_assigned_route: null,
        fallback_routes: [
          { provider: '', authType: 'api_key', model: 'gpt-4o' },
          { provider: 'anthropic', authType: 'api_key', model: 'claude-3-5-sonnet' },
        ],
      };
      const { controller, accessRepo } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
            user_id: USER_ID,
            provider: 'openai',
            auth_type: 'api_key',
            label: 'Default',
            cached_models: [{ id: 'gpt-4o' }],
          } as Partial<UserProvider>),
        },
        tierRepo: {
          find: jest.fn().mockResolvedValue([tier]),
        },
      });

      await expect(
        controller.disable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID),
      ).rejects.toThrow(/assigned to this harness/);

      expect(accessRepo.delete).not.toHaveBeenCalled();
      expect(tier.fallback_routes).toHaveLength(2);
    });
  });
});
