import { HttpException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { AgentProviderAccessController } from './agent-provider-access.controller';
import type { AgentProviderAccess } from '../entities/agent-provider-access.entity';
import type { Agent } from '../entities/agent.entity';
import type { Tenant } from '../entities/tenant.entity';
import type { UserProvider } from '../entities/user-provider.entity';
import type { TierAssignment } from '../entities/tier-assignment.entity';
import type { AuthUser } from '../auth/auth.instance';

const USER = { id: 'user-1' } as AuthUser;

describe('AgentProviderAccessController', () => {
  let accessRepo: {
    find: jest.Mock;
    count: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let agentRepo: { findOne: jest.Mock };
  let tenantRepo: { findOne: jest.Mock };
  let userProviderRepo: { findOne: jest.Mock; find: jest.Mock };
  let tierRepo: { find: jest.Mock; save: jest.Mock };
  let insertBuilder: {
    insert: jest.Mock;
    into: jest.Mock;
    values: jest.Mock;
    orIgnore: jest.Mock;
    execute: jest.Mock;
  };
  let ctrl: AgentProviderAccessController;

  beforeEach(() => {
    insertBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    accessRepo = {
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      delete: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(insertBuilder),
    };
    agentRepo = { findOne: jest.fn().mockResolvedValue({ id: 'agent-1' }) };
    tenantRepo = { findOne: jest.fn().mockResolvedValue({ id: 'tenant-1' }) };
    userProviderRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };
    tierRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue(undefined),
    };

    ctrl = new AgentProviderAccessController(
      accessRepo as unknown as Repository<AgentProviderAccess>,
      agentRepo as unknown as Repository<Agent>,
      tenantRepo as unknown as Repository<Tenant>,
      userProviderRepo as unknown as Repository<UserProvider>,
      tierRepo as unknown as Repository<TierAssignment>,
    );
  });

  describe('resolveAgent (via listEnabled)', () => {
    it('returns empty/not-explicit when the tenant is missing', async () => {
      tenantRepo.findOne.mockResolvedValue(null);
      expect(await ctrl.listEnabled(USER, 'agent')).toEqual({ enabled: [], explicit: false });
      expect(agentRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns empty/not-explicit when the agent is missing', async () => {
      agentRepo.findOne.mockResolvedValue(null);
      expect(await ctrl.listEnabled(USER, 'agent')).toEqual({ enabled: [], explicit: false });
    });

    it('decodes the agent name and scopes the agent lookup to the tenant', async () => {
      await ctrl.listEnabled(USER, 'my%20agent');
      expect(agentRepo.findOne).toHaveBeenCalledWith({
        where: { name: 'my agent', tenant_id: 'tenant-1' },
      });
    });
  });

  describe('listEnabled', () => {
    it('returns the enabled provider ids with explicit=true when rows exist', async () => {
      accessRepo.find.mockResolvedValue([{ user_provider_id: 'p1' }, { user_provider_id: 'p2' }]);
      expect(await ctrl.listEnabled(USER, 'agent')).toEqual({
        enabled: ['p1', 'p2'],
        explicit: true,
      });
    });
  });

  describe('getDisableImpact', () => {
    it('throws 404 when the agent is missing', async () => {
      agentRepo.findOne.mockResolvedValue(null);
      await expect(ctrl.getDisableImpact(USER, 'agent', 'p1')).rejects.toBeInstanceOf(
        HttpException,
      );
    });

    it('returns no affected tiers when the provider is not the caller’s', async () => {
      userProviderRepo.findOne.mockResolvedValue(null);
      expect(await ctrl.getDisableImpact(USER, 'agent', 'p1')).toEqual({ affected_tiers: [] });
    });

    it('returns no affected tiers when the provider has no cached models', async () => {
      userProviderRepo.findOne.mockResolvedValue({ id: 'p1', cached_models: [] });
      expect(await ctrl.getDisableImpact(USER, 'agent', 'p1')).toEqual({ affected_tiers: [] });
    });

    it('reports override and fallback routes that use the provider’s models', async () => {
      userProviderRepo.findOne.mockResolvedValue({
        id: 'p1',
        cached_models: [{ id: 'm1' }, { id: 'm2' }],
      });
      tierRepo.find.mockResolvedValue([
        {
          tier: 'default',
          override_route: { model: 'm1' },
          fallback_routes: [{ model: 'm2' }, { model: 'other' }],
        },
      ]);
      expect(await ctrl.getDisableImpact(USER, 'agent', 'p1')).toEqual({
        affected_tiers: [
          { tier: 'default', model: 'm1', position: 'primary' },
          { tier: 'default', model: 'm2', position: 'fallback 1' },
        ],
      });
    });

    it('handles a non-array cached_models and missing fallback_routes', async () => {
      userProviderRepo.findOne.mockResolvedValue({ id: 'p1', cached_models: null });
      expect(await ctrl.getDisableImpact(USER, 'agent', 'p1')).toEqual({ affected_tiers: [] });
    });

    it('ignores tiers with no override and null fallback_routes', async () => {
      userProviderRepo.findOne.mockResolvedValue({ id: 'p1', cached_models: [{ id: 'm1' }] });
      tierRepo.find.mockResolvedValue([
        { tier: 'default', override_route: null, fallback_routes: null },
      ]);
      expect(await ctrl.getDisableImpact(USER, 'agent', 'p1')).toEqual({ affected_tiers: [] });
    });
  });

  describe('enable', () => {
    it('throws 404 when the agent is missing', async () => {
      agentRepo.findOne.mockResolvedValue(null);
      await expect(ctrl.enable(USER, 'agent', 'p1')).rejects.toBeInstanceOf(HttpException);
    });

    // IDOR guard: the provider must belong to the caller, otherwise a user
    // could grant their agent access to another user's provider.
    it('throws 404 when the provider does not belong to the caller', async () => {
      userProviderRepo.findOne.mockResolvedValue(null);
      await expect(ctrl.enable(USER, 'agent', 'foreign-provider')).rejects.toBeInstanceOf(
        HttpException,
      );
      expect(userProviderRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'foreign-provider', user_id: 'user-1' },
      });
      expect(accessRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('inserts the access row when the provider belongs to the caller', async () => {
      userProviderRepo.findOne.mockResolvedValue({ id: 'p1', user_id: 'user-1' });
      expect(await ctrl.enable(USER, 'agent', 'p1')).toEqual({ ok: true });
      expect(insertBuilder.values).toHaveBeenCalledWith({
        agent_id: 'agent-1',
        user_provider_id: 'p1',
      });
      expect(insertBuilder.execute).toHaveBeenCalled();
    });
  });

  describe('disable', () => {
    it('throws 404 when the agent is missing', async () => {
      agentRepo.findOne.mockResolvedValue(null);
      await expect(ctrl.disable(USER, 'agent', 'p1')).rejects.toBeInstanceOf(HttpException);
    });

    it('clears override/auto/fallback routes that use the provider’s models', async () => {
      userProviderRepo.findOne.mockResolvedValue({ id: 'p1', cached_models: [{ id: 'm1' }] });
      const tier = {
        override_route: { model: 'm1' },
        auto_assigned_route: { model: 'm1' },
        fallback_routes: [{ model: 'm1' }, { model: 'keep' }],
      };
      tierRepo.find.mockResolvedValue([tier]);
      await ctrl.disable(USER, 'agent', 'p1');
      expect(tier.override_route).toBeNull();
      expect(tier.auto_assigned_route).toBeNull();
      expect(tier.fallback_routes).toEqual([{ model: 'keep' }]);
      expect(tierRepo.save).toHaveBeenCalledWith(tier);
    });

    it('nulls fallback_routes when filtering removes every entry', async () => {
      userProviderRepo.findOne.mockResolvedValue({ id: 'p1', cached_models: [{ id: 'm1' }] });
      const tier = {
        override_route: null,
        auto_assigned_route: null,
        fallback_routes: [{ model: 'm1' }],
      };
      tierRepo.find.mockResolvedValue([tier]);
      await ctrl.disable(USER, 'agent', 'p1');
      expect(tier.fallback_routes).toBeNull();
    });

    it('does not save a tier that is unaffected', async () => {
      userProviderRepo.findOne.mockResolvedValue({ id: 'p1', cached_models: [{ id: 'm1' }] });
      tierRepo.find.mockResolvedValue([
        { override_route: { model: 'other' }, fallback_routes: null },
      ]);
      await ctrl.disable(USER, 'agent', 'p1');
      expect(tierRepo.save).not.toHaveBeenCalled();
    });

    it('seeds all providers on the first disable, then removes the target', async () => {
      userProviderRepo.findOne.mockResolvedValue({ id: 'p1', cached_models: [] });
      accessRepo.count.mockResolvedValue(0);
      userProviderRepo.find.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
      await ctrl.disable(USER, 'agent', 'p1');
      expect(insertBuilder.values).toHaveBeenCalledWith([
        { agent_id: 'agent-1', user_provider_id: 'p1' },
        { agent_id: 'agent-1', user_provider_id: 'p2' },
      ]);
      expect(accessRepo.delete).toHaveBeenCalledWith({
        agent_id: 'agent-1',
        user_provider_id: 'p1',
      });
    });

    it('skips seeding when explicit rows already exist or the user has no providers', async () => {
      userProviderRepo.findOne.mockResolvedValue(null);
      accessRepo.count.mockResolvedValue(2);
      await ctrl.disable(USER, 'agent', 'p1');
      expect(accessRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(accessRepo.delete).toHaveBeenCalled();
    });

    it('does not seed when there are no providers on first disable', async () => {
      userProviderRepo.findOne.mockResolvedValue(null);
      accessRepo.count.mockResolvedValue(0);
      userProviderRepo.find.mockResolvedValue([]);
      await ctrl.disable(USER, 'agent', 'p1');
      expect(accessRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('treats a non-array cached_models as no models and skips tier cleanup', async () => {
      userProviderRepo.findOne.mockResolvedValue({ id: 'p1', cached_models: null });
      accessRepo.count.mockResolvedValue(2);
      await ctrl.disable(USER, 'agent', 'p1');
      expect(tierRepo.find).not.toHaveBeenCalled();
      expect(accessRepo.delete).toHaveBeenCalled();
    });
  });
});
