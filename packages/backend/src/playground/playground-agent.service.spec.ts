import type { DataSource, EntityManager, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { PlaygroundAgentService } from './playground-agent.service';
import type { Agent } from '../entities/agent.entity';
import type { TenantCacheService } from '../common/services/tenant-cache.service';
import type { TenantContext } from '../common/decorators/tenant-context.decorator';
import { PLAYGROUND_AGENT_NAME } from '../common/constants/playground.constants';

const TENANT_ID = 'tenant-abc';
const USER_ID = 'user-xyz';
const AGENT_ID = 'agent-sys-1';

/** A request context that already carries a resolved tenant. */
function ctxWithTenant(): TenantContext {
  return { tenantId: TENANT_ID, userId: USER_ID };
}

/** A request context for a fresh account: no tenant yet, only an authenticated user. */
function ctxNoTenant(): TenantContext {
  return { tenantId: null, userId: USER_ID };
}

/** A minimal Agent-shaped object that satisfies the service's return type. */
function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: AGENT_ID,
    name: PLAYGROUND_AGENT_NAME,
    display_name: PLAYGROUND_AGENT_NAME,
    is_system: true,
    is_active: true,
    tenant_id: TENANT_ID,
    ...overrides,
  } as Agent;
}

interface Mocks {
  agentRepo: {
    findOne: jest.Mock;
  };
  tenantCache: {
    ensureForUser: jest.Mock;
    resolve: jest.Mock;
    invalidate: jest.Mock;
  };
  dataSource: {
    transaction: jest.Mock;
  };
}

/**
 * Build a mock EntityManager whose getRepository(Agent).insert and .query
 * can be configured per-test.
 */
function makeManager(
  insertFn: jest.Mock = jest.fn().mockResolvedValue(undefined),
  queryFn: jest.Mock = jest.fn().mockResolvedValue(undefined),
): EntityManager {
  return {
    getRepository: () => ({ insert: insertFn }),
    query: queryFn,
  } as unknown as EntityManager;
}

function buildService(mocks: Partial<Mocks> = {}): {
  service: PlaygroundAgentService;
  mocks: Mocks;
} {
  const full: Mocks = {
    agentRepo: {
      findOne: jest.fn().mockResolvedValue(null),
    },
    tenantCache: {
      ensureForUser: jest.fn().mockResolvedValue(TENANT_ID),
      resolve: jest.fn().mockResolvedValue(TENANT_ID),
      invalidate: jest.fn(),
    },
    dataSource: {
      // Default: runs the transaction callback with a stock manager (insert + query succeed).
      transaction: jest.fn().mockImplementation(async (cb: (m: EntityManager) => Promise<void>) => {
        await cb(makeManager());
      }),
    },
    ...mocks,
  };

  const service = new PlaygroundAgentService(
    full.agentRepo as unknown as Repository<Agent>,
    full.tenantCache as unknown as TenantCacheService,
    full.dataSource as unknown as DataSource,
  );

  return { service, mocks: full };
}

describe('PlaygroundAgentService.resolve', () => {
  describe('(a) tenant already on context — no tenant bootstrap', () => {
    it('does not call tenantCache.ensureForUser when ctx.tenantId is present', async () => {
      const existing = makeAgent();
      const { service, mocks } = buildService({
        agentRepo: { findOne: jest.fn().mockResolvedValue(existing) },
      });

      await service.resolve(ctxWithTenant());

      expect(mocks.tenantCache.ensureForUser).not.toHaveBeenCalled();
    });

    it('returns the existing agent when ctx carries a tenant and the agent exists', async () => {
      const existing = makeAgent();
      const { service } = buildService({
        agentRepo: { findOne: jest.fn().mockResolvedValue(existing) },
      });

      const result = await service.resolve(ctxWithTenant());
      expect(result).toBe(existing);
    });
  });

  describe('(a1) no tenant on context → bootstrap via tenantCache.ensureForUser', () => {
    it('calls tenantCache.ensureForUser(userId) and scopes the agent under the returned tenant', async () => {
      const ensureForUser = jest.fn().mockResolvedValue('bootstrapped-tenant');
      const { service } = buildService({
        tenantCache: { ensureForUser, resolve: jest.fn(), invalidate: jest.fn() },
      });

      const result = await service.resolve(ctxNoTenant());

      expect(ensureForUser).toHaveBeenCalledTimes(1);
      expect(ensureForUser).toHaveBeenCalledWith(USER_ID);
      // The agent should be created under the bootstrapped tenant id.
      expect(result.tenant_id).toBe('bootstrapped-tenant');
    });

    it('looks up the system agent under the bootstrapped tenant id', async () => {
      const ensureForUser = jest.fn().mockResolvedValue('bootstrapped-tenant');
      const { service, mocks } = buildService({
        tenantCache: { ensureForUser, resolve: jest.fn(), invalidate: jest.fn() },
      });

      await service.resolve(ctxNoTenant());

      expect(mocks.agentRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: 'bootstrapped-tenant', is_system: true }),
        }),
      );
    });
  });

  describe('(a2) no tenant and no user on context → not found', () => {
    it('throws NotFoundException without touching tenantCache', async () => {
      const ensureForUser = jest.fn();
      const { service } = buildService({
        tenantCache: { ensureForUser, resolve: jest.fn(), invalidate: jest.fn() },
      });

      await expect(service.resolve({ tenantId: null, userId: null })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(ensureForUser).not.toHaveBeenCalled();
    });
  });

  describe('(b) existing system agent returned', () => {
    it('returns the existing agent without starting a transaction', async () => {
      const existing = makeAgent();
      const { service, mocks } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(existing),
        },
      });

      const result = await service.resolve(ctxWithTenant());

      expect(result).toBe(existing);
      expect(mocks.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('queries agentRepo with the correct tenant_id, is_system and deleted_at filters', async () => {
      const existing = makeAgent();
      const { service, mocks } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(existing),
        },
      });

      await service.resolve(ctxWithTenant());

      expect(mocks.agentRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID, is_system: true }),
        }),
      );
    });
  });

  describe('(c) lazy-create path', () => {
    it('runs a transaction that inserts the agent and calls the provider-pool enable query', async () => {
      const insertFn = jest.fn().mockResolvedValue(undefined);
      const queryFn = jest.fn().mockResolvedValue(undefined);
      const manager = makeManager(insertFn, queryFn);

      const { service, mocks } = buildService({
        dataSource: {
          transaction: jest
            .fn()
            .mockImplementation(async (cb: (m: EntityManager) => Promise<void>) => {
              await cb(manager);
            }),
        },
      });

      const result = await service.resolve(ctxWithTenant());

      expect(mocks.dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(insertFn).toHaveBeenCalledTimes(1);

      // The enable query must receive [agentId, tenantId].
      expect(queryFn).toHaveBeenCalledTimes(1);
      const [_sql, params] = queryFn.mock.calls[0] as [string, [string, string]];
      expect(params[0]).toBe(result.id);
      expect(params[1]).toBe(TENANT_ID);
    });

    it('returns a new agent with the correct fields (no DB re-fetch on success)', async () => {
      const { service, mocks } = buildService();

      const result = await service.resolve(ctxWithTenant());

      expect(result.name).toBe(PLAYGROUND_AGENT_NAME);
      expect(result.display_name).toBe(PLAYGROUND_AGENT_NAME);
      expect(result.is_system).toBe(true);
      expect(result.is_active).toBe(true);
      expect(result.tenant_id).toBe(TENANT_ID);
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);

      // findOne called once (pre-insert check); no second call after success.
      expect(mocks.agentRepo.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('(d) race: transaction throws → re-find returns a row', () => {
    it('returns the race winner row without running a second transaction', async () => {
      const raceWinner = makeAgent({ id: 'agent-winner' });
      const { service, mocks } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(raceWinner),
        },
        dataSource: {
          transaction: jest
            .fn()
            .mockRejectedValue(new Error('duplicate key value violates unique')),
        },
      });

      const result = await service.resolve(ctxWithTenant());

      expect(result).toBe(raceWinner);
      expect(mocks.agentRepo.findOne).toHaveBeenCalledTimes(2);
      // Transaction was attempted once (and threw); no retry.
      expect(mocks.dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('does not re-throw the transaction error when the race winner row is found', async () => {
      const raceWinner = makeAgent({ id: 'agent-winner' });
      const { service } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(raceWinner),
        },
        dataSource: {
          transaction: jest.fn().mockRejectedValue(new Error('unique constraint')),
        },
      });

      await expect(service.resolve(ctxWithTenant())).resolves.toBe(raceWinner);
    });
  });

  describe('(e) transaction throws → re-find returns null', () => {
    it('re-throws the original DB error (not a race → surface the real failure)', async () => {
      const dbError = new Error('deadlock detected');
      const { service } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(null),
        },
        dataSource: {
          transaction: jest.fn().mockRejectedValue(dbError),
        },
      });

      await expect(service.resolve(ctxWithTenant())).rejects.toThrow('deadlock detected');
    });

    it('does not attempt a second transaction when the race re-find also returns null', async () => {
      const transactionFn = jest.fn().mockRejectedValue(new Error('duplicate key'));
      const { service } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(null),
        },
        dataSource: {
          transaction: transactionFn,
        },
      });

      await expect(service.resolve(ctxWithTenant())).rejects.toThrow('duplicate key');
      expect(transactionFn).toHaveBeenCalledTimes(1);
    });
  });
});
