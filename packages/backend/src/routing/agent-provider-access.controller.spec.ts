import { HttpException } from '@nestjs/common';
import { AgentProviderAccessController } from './agent-provider-access.controller';
import type { AgentProviderAccess } from '../entities/agent-provider-access.entity';
import type { UserProvider } from '../entities/user-provider.entity';
import type { TierAssignment } from '../entities/tier-assignment.entity';

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
      providerService as never,
    ),
    accessRepo,
    agentRepo,
    tenantRepo,
    userProviderRepo,
    tierRepo,
    providerService,
    agent,
    tenant,
  };
}

describe('AgentProviderAccessController', () => {
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

    it('returns empty affected_tiers when provider has no cached models', async () => {
      const { controller } = makeController({
        userProviderRepo: {
          findOne: jest.fn().mockResolvedValue({
            id: PROVIDER_ID,
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

    it('inserts grant and recalculates tiers on success', async () => {
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

    it('deletes access row and recalculates tiers when provider not found', async () => {
      const { controller, accessRepo, providerService } = makeController();

      const result = await controller.disable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID);

      expect(result).toEqual({ ok: true });
      expect(accessRepo.delete).toHaveBeenCalledWith({
        agent_id: AGENT_ID,
        user_provider_id: PROVIDER_ID,
      });
      expect(providerService.recalculateTiers).toHaveBeenCalledWith(AGENT_ID, USER_ID);
    });

    it('clears affected tier routes and deletes access row', async () => {
      const tier: Partial<TierAssignment> = {
        tier: 'standard',
        override_route: { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
        auto_assigned_route: null,
        fallback_routes: null,
      };
      const tierSave = jest.fn().mockResolvedValue(undefined);
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
          save: tierSave,
        },
      });

      await controller.disable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID);

      expect(tierSave).toHaveBeenCalled();
      expect(tier.override_route).toBeNull();
      expect(accessRepo.delete).toHaveBeenCalledWith({
        agent_id: AGENT_ID,
        user_provider_id: PROVIDER_ID,
      });
      expect(providerService.recalculateTiers).toHaveBeenCalledWith(AGENT_ID, USER_ID);
    });

    it('does not save tier if no models match', async () => {
      const tier: Partial<TierAssignment> = {
        tier: 'standard',
        override_route: { provider: 'anthropic', authType: 'api_key', model: 'claude-3-5-sonnet' },
        auto_assigned_route: null,
        fallback_routes: null,
      };
      const tierSave = jest.fn().mockResolvedValue(undefined);
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
          find: jest.fn().mockResolvedValue([tier]),
          save: tierSave,
        },
      });

      await controller.disable({ id: USER_ID } as never, 'my-agent', PROVIDER_ID);

      // Tier is unmodified so save should not be called
      expect(tierSave).not.toHaveBeenCalled();
    });
  });
});
