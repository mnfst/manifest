import type { DataSource, EntityManager, Repository } from 'typeorm';
import { PlaygroundAgentService } from './playground-agent.service';
import type { Agent } from '../entities/agent.entity';
import type { Tenant } from '../entities/tenant.entity';
import type { TenantCacheService } from '../common/services/tenant-cache.service';
import { PLAYGROUND_AGENT_NAME } from '../common/constants/playground.constants';

const TENANT_ID = 'tenant-abc';
const USER_ID = 'user-xyz';
const AGENT_ID = 'agent-sys-1';

/** A minimal Agent-shaped object that satisfies the service's return type. */
function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: AGENT_ID,
    name: PLAYGROUND_AGENT_NAME,
    display_name: PLAYGROUND_AGENT_NAME,
    is_playground: true,
    is_active: true,
    tenant_id: TENANT_ID,
    ...overrides,
  } as Agent;
}

/** A minimal Tenant-shaped object. */
function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: TENANT_ID,
    name: USER_ID,
    is_active: true,
    ...overrides,
  } as Tenant;
}

interface TenantRepo {
  findOne: jest.Mock;
  insert: jest.Mock;
}

interface Mocks {
  agentRepo: {
    findOne: jest.Mock;
  };
  tenantCache: {
    resolve: jest.Mock;
    invalidate: jest.Mock;
  };
  dataSource: {
    transaction: jest.Mock;
    getRepository: jest.Mock;
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

/**
 * Build a mock tenant repository for dataSource.getRepository(Tenant).
 * findOne and insert can be configured per-test.
 */
function makeTenantRepo(overrides: Partial<TenantRepo> = {}): TenantRepo {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildService(mocks: Partial<Mocks> = {}): {
  service: PlaygroundAgentService;
  mocks: Mocks;
} {
  const tenantRepo = makeTenantRepo();

  const full: Mocks = {
    agentRepo: {
      findOne: jest.fn().mockResolvedValue(null),
    },
    tenantCache: {
      resolve: jest.fn().mockResolvedValue(TENANT_ID),
      invalidate: jest.fn(),
    },
    dataSource: {
      // Default: runs the transaction callback with a stock manager (insert + query succeed).
      transaction: jest.fn().mockImplementation(async (cb: (m: EntityManager) => Promise<void>) => {
        await cb(makeManager());
      }),
      // Default: returns a tenant repo stub (used by ensureTenant).
      getRepository: jest.fn().mockReturnValue(tenantRepo),
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
  describe('(a) tenantCache hit — no tenant bootstrap', () => {
    it('does not call dataSource.getRepository when tenantCache resolves a tenantId', async () => {
      const existing = makeAgent();
      const { service, mocks } = buildService({
        agentRepo: { findOne: jest.fn().mockResolvedValue(existing) },
        // tenantCache already resolves TENANT_ID by default
      });

      await service.resolve(USER_ID);

      expect(mocks.dataSource.getRepository).not.toHaveBeenCalled();
    });

    it('returns the existing agent when tenantCache hits and agent exists', async () => {
      const existing = makeAgent();
      const { service } = buildService({
        agentRepo: { findOne: jest.fn().mockResolvedValue(existing) },
      });

      const result = await service.resolve(USER_ID);
      expect(result).toBe(existing);
    });

    it('does NOT call tenantCache.invalidate when tenantCache already resolved an id', async () => {
      const existing = makeAgent();
      const { service, mocks } = buildService({
        agentRepo: { findOne: jest.fn().mockResolvedValue(existing) },
        // tenantCache.resolve returns TENANT_ID (non-null) by default
      });

      await service.resolve(USER_ID);

      expect(mocks.tenantCache.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('(a1) tenantCache miss → ensureTenant → cache invalidated', () => {
    it('calls tenantCache.invalidate(userId) after ensureTenant bootstraps the tenant', async () => {
      const tenantRepo = makeTenantRepo({
        findOne: jest.fn().mockResolvedValue(makeTenant()),
      });

      const invalidateFn = jest.fn();
      const { service } = buildService({
        tenantCache: { resolve: jest.fn().mockResolvedValue(null), invalidate: invalidateFn },
        dataSource: {
          transaction: jest
            .fn()
            .mockImplementation(async (cb: (m: EntityManager) => Promise<void>) => {
              await cb(makeManager());
            }),
          getRepository: jest.fn().mockReturnValue(tenantRepo),
        },
      });

      await service.resolve(USER_ID);

      // invalidate must be called with the userId so subsequent resolves see the
      // real tenantId instead of the cached null.
      expect(invalidateFn).toHaveBeenCalledTimes(1);
      expect(invalidateFn).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe('(a2) ensureTenant — tenant already exists in DB (findOne returns row)', () => {
    it('uses the existing tenant id and proceeds to create the agent', async () => {
      const tenant = makeTenant();
      const tenantRepo = makeTenantRepo({
        findOne: jest.fn().mockResolvedValue(tenant),
      });

      const insertFn = jest.fn().mockResolvedValue(undefined);
      const queryFn = jest.fn().mockResolvedValue(undefined);
      const manager = makeManager(insertFn, queryFn);

      const { service, mocks } = buildService({
        tenantCache: { resolve: jest.fn().mockResolvedValue(null), invalidate: jest.fn() },
        dataSource: {
          transaction: jest
            .fn()
            .mockImplementation(async (cb: (m: EntityManager) => Promise<void>) => {
              await cb(manager);
            }),
          getRepository: jest.fn().mockReturnValue(tenantRepo),
        },
      });

      const result = await service.resolve(USER_ID);

      // getRepository(Tenant) was called to look up the tenant.
      expect(mocks.dataSource.getRepository).toHaveBeenCalled();
      // insert was NOT called because findOne found the tenant.
      expect(tenantRepo.insert).not.toHaveBeenCalled();
      // The agent was created under the found tenant id.
      expect(result.tenant_id).toBe(TENANT_ID);
    });
  });

  describe('(a3) ensureTenant — tenant missing → insert succeeds', () => {
    it('inserts a new tenant and returns the new id', async () => {
      const newTenantId = 'new-tenant-uuid';
      const tenantRepo = makeTenantRepo({
        // findOne returns null — tenant does not exist
        findOne: jest.fn().mockResolvedValue(null),
        insert: jest.fn().mockResolvedValue(undefined),
      });

      const { service, mocks } = buildService({
        tenantCache: { resolve: jest.fn().mockResolvedValue(null), invalidate: jest.fn() },
        dataSource: {
          transaction: jest
            .fn()
            .mockImplementation(async (cb: (m: EntityManager) => Promise<void>) => {
              await cb(makeManager());
            }),
          getRepository: jest.fn().mockReturnValue(tenantRepo),
        },
      });

      const result = await service.resolve(USER_ID);

      expect(tenantRepo.insert).toHaveBeenCalledTimes(1);
      const insertArg = tenantRepo.insert.mock.calls[0][0] as {
        id: string;
        name: string;
        is_active: boolean;
      };
      expect(typeof insertArg.id).toBe('string');
      expect(insertArg.name).toBe(USER_ID);
      expect(insertArg.is_active).toBe(true);
      // The agent should be created under the new tenant's id.
      expect(typeof result.tenant_id).toBe('string');
      // getRepository was used for ensureTenant.
      expect(mocks.dataSource.getRepository).toHaveBeenCalled();
      void newTenantId; // suppress unused warning
    });
  });

  describe('(a4) ensureTenant — insert throws, re-find returns row', () => {
    it('returns the race-winner tenant id without re-throwing', async () => {
      const racingTenant = makeTenant({ id: 'race-winner-tenant' });
      const tenantRepo = makeTenantRepo({
        findOne: jest
          .fn()
          .mockResolvedValueOnce(null) // first call: not found → trigger insert
          .mockResolvedValueOnce(racingTenant), // second call: race winner found
        insert: jest.fn().mockRejectedValue(new Error('duplicate key')),
      });

      const { service } = buildService({
        tenantCache: { resolve: jest.fn().mockResolvedValue(null), invalidate: jest.fn() },
        dataSource: {
          transaction: jest
            .fn()
            .mockImplementation(async (cb: (m: EntityManager) => Promise<void>) => {
              await cb(makeManager());
            }),
          getRepository: jest.fn().mockReturnValue(tenantRepo),
        },
      });

      const result = await service.resolve(USER_ID);

      expect(tenantRepo.findOne).toHaveBeenCalledTimes(2);
      expect(tenantRepo.insert).toHaveBeenCalledTimes(1);
      // Agent should be created under the race-winner's tenant id.
      expect(result.tenant_id).toBe('race-winner-tenant');
    });
  });

  describe('(a5) ensureTenant — insert throws, re-find returns null', () => {
    it('re-throws the original DB error (does not mask it as not-found)', async () => {
      const dbError = new Error('connection reset');
      const tenantRepo = makeTenantRepo({
        findOne: jest.fn().mockResolvedValue(null), // both calls return null
        insert: jest.fn().mockRejectedValue(dbError),
      });

      const { service } = buildService({
        tenantCache: { resolve: jest.fn().mockResolvedValue(null), invalidate: jest.fn() },
        dataSource: {
          transaction: jest.fn().mockResolvedValue(undefined),
          getRepository: jest.fn().mockReturnValue(tenantRepo),
        },
      });

      await expect(service.resolve(USER_ID)).rejects.toThrow('connection reset');
    });
  });

  describe('(b) existing playground agent returned', () => {
    it('returns the existing agent without starting a transaction', async () => {
      const existing = makeAgent();
      const { service, mocks } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(existing),
        },
      });

      const result = await service.resolve(USER_ID);

      expect(result).toBe(existing);
      expect(mocks.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('queries agentRepo with the correct tenant_id, is_playground and deleted_at filters', async () => {
      const existing = makeAgent();
      const { service, mocks } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(existing),
        },
      });

      await service.resolve(USER_ID);

      expect(mocks.agentRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID, is_playground: true }),
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
          getRepository: jest.fn().mockReturnValue(makeTenantRepo()),
        },
      });

      const result = await service.resolve(USER_ID);

      expect(mocks.dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(insertFn).toHaveBeenCalledTimes(1);

      // The enable query must receive [agentId, userId].
      expect(queryFn).toHaveBeenCalledTimes(1);
      const [_sql, params] = queryFn.mock.calls[0] as [string, [string, string]];
      expect(params[0]).toBe(result.id);
      expect(params[1]).toBe(USER_ID);
    });

    it('returns a new agent with the correct fields (no DB re-fetch on success)', async () => {
      const { service, mocks } = buildService();

      const result = await service.resolve(USER_ID);

      expect(result.name).toBe(PLAYGROUND_AGENT_NAME);
      expect(result.display_name).toBe(PLAYGROUND_AGENT_NAME);
      expect(result.is_playground).toBe(true);
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
          getRepository: jest.fn().mockReturnValue(makeTenantRepo()),
        },
      });

      const result = await service.resolve(USER_ID);

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
          getRepository: jest.fn().mockReturnValue(makeTenantRepo()),
        },
      });

      await expect(service.resolve(USER_ID)).resolves.toBe(raceWinner);
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
          getRepository: jest.fn().mockReturnValue(makeTenantRepo()),
        },
      });

      await expect(service.resolve(USER_ID)).rejects.toThrow('deadlock detected');
    });

    it('does not attempt a second transaction when the race re-find also returns null', async () => {
      const transactionFn = jest.fn().mockRejectedValue(new Error('duplicate key'));
      const { service } = buildService({
        agentRepo: {
          findOne: jest.fn().mockResolvedValue(null),
        },
        dataSource: {
          transaction: transactionFn,
          getRepository: jest.fn().mockReturnValue(makeTenantRepo()),
        },
      });

      await expect(service.resolve(USER_ID)).rejects.toThrow('duplicate key');
      expect(transactionFn).toHaveBeenCalledTimes(1);
    });
  });
});
