import { Logger } from '@nestjs/common';
import { getSeedConnections, seedAgentMessages, seedConnectionId } from './seed-messages';

/**
 * Gate + insertion behavior of seedAgentMessages. The generated data itself
 * (chain coherence, taxonomy, determinism) is covered by
 * seed-request-chains.spec.ts / seed-messages.determinism.spec.ts.
 */

interface MockRepo {
  count: jest.Mock;
  insert: jest.Mock;
  delete: jest.Mock;
}

/**
 * count() is called with a seed-id Like filter first, then with a tenant
 * filter (the demo-tenant "real traffic" guard).
 */
function makeMockRepo(seedCount = 0, tenantCount = 0): MockRepo {
  return {
    count: jest.fn().mockImplementation((opts?: { where?: Record<string, unknown> }) => {
      if (opts?.where && 'tenant_id' in opts.where) return Promise.resolve(tenantCount);
      return Promise.resolve(seedCount);
    }),
    insert: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  };
}

function makeMockLogger(): Logger & { log: jest.Mock } {
  return { log: jest.fn() } as unknown as Logger & { log: jest.Mock };
}

function collectInserted(repo: MockRepo): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  for (const call of repo.insert.mock.calls) {
    rows.push(...(call[0] as Array<Record<string, unknown>>));
  }
  return rows;
}

describe('seedAgentMessages', () => {
  let logger: Logger & { log: jest.Mock };

  beforeEach(() => {
    logger = makeMockLogger();
    jest.clearAllMocks();
  });

  describe('seed gate', () => {
    it('no-ops when a coherent seed (attempts AND requests) is already present', async () => {
      const messageRepo = makeMockRepo(500, 500);
      const requestRepo = makeMockRepo(400, 400);

      await seedAgentMessages(messageRepo as never, requestRepo as never, 'user-1', logger);

      expect(messageRepo.insert).not.toHaveBeenCalled();
      expect(requestRepo.insert).not.toHaveBeenCalled();
      expect(messageRepo.delete).not.toHaveBeenCalled();
    });

    it('seeds even when the demo tenant already holds real (non-seed) traffic', async () => {
      // SEED_DATA=true is the explicit opt-in; real traffic never collides
      // with the seed-* id prefixes, so coexistence is safe and the demo data
      // must be guaranteed on every boot.
      const messageRepo = makeMockRepo(0, 250);
      const requestRepo = makeMockRepo(0, 0);

      await seedAgentMessages(messageRepo as never, requestRepo as never, 'user-1', logger);

      expect(requestRepo.insert).toHaveBeenCalled();
      expect(messageRepo.insert).toHaveBeenCalled();
    });

    it('seeds an empty DB', async () => {
      const messageRepo = makeMockRepo(0, 0);
      const requestRepo = makeMockRepo(0, 0);

      await seedAgentMessages(messageRepo as never, requestRepo as never, 'user-1', logger);

      expect(requestRepo.insert).toHaveBeenCalled();
      expect(messageRepo.insert).toHaveBeenCalled();
    });

    it('upgrades a legacy flat seed: wipes seed rows, then re-seeds request-shaped data', async () => {
      // Legacy state: seed attempts exist, but no seed requests.
      const messageRepo = makeMockRepo(700, 700);
      const requestRepo = makeMockRepo(0, 0);

      await seedAgentMessages(messageRepo as never, requestRepo as never, 'user-1', logger);

      expect(messageRepo.delete).toHaveBeenCalled();
      expect(requestRepo.delete).toHaveBeenCalled();
      expect(requestRepo.insert).toHaveBeenCalled();
      expect(messageRepo.insert).toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Replacing legacy flat seed'),
      );
    });
  });

  describe('insertion', () => {
    it('inserts requests before attempts (FK direction) in batches of ≤100', async () => {
      const messageRepo = makeMockRepo(0, 0);
      const requestRepo = makeMockRepo(0, 0);

      await seedAgentMessages(messageRepo as never, requestRepo as never, 'user-1', logger);

      const firstRequestInsert = requestRepo.insert.mock.invocationCallOrder[0];
      const firstAttemptInsert = messageRepo.insert.mock.invocationCallOrder[0];
      expect(firstRequestInsert).toBeLessThan(firstAttemptInsert);

      for (const repo of [requestRepo, messageRepo]) {
        for (const call of repo.insert.mock.calls) {
          expect((call[0] as unknown[]).length).toBeLessThanOrEqual(100);
        }
      }
    });

    it('stamps the context and user on every inserted row', async () => {
      const messageRepo = makeMockRepo(0, 0);
      const requestRepo = makeMockRepo(0, 0);

      await seedAgentMessages(messageRepo as never, requestRepo as never, 'user-42', logger);

      for (const row of [...collectInserted(requestRepo), ...collectInserted(messageRepo)]) {
        expect(row.tenant_id).toBe('seed-tenant-001');
        expect(row.agent_id).toBe('seed-agent-001');
        expect(row.agent_name).toBe('demo-agent');
        expect(row.user_id).toBe('user-42');
      }
    });

    it('honours a custom context', async () => {
      const messageRepo = makeMockRepo(0, 0);
      const requestRepo = makeMockRepo(0, 0);

      await seedAgentMessages(messageRepo as never, requestRepo as never, 'user-2', logger, {
        tenantId: 'custom-tenant',
        agentId: 'custom-agent-id',
        agentName: 'my-agent',
      });

      const rows = collectInserted(messageRepo);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.tenant_id).toBe('custom-tenant');
        expect(row.agent_id).toBe('custom-agent-id');
        expect(row.agent_name).toBe('my-agent');
      }
    });

    it('logs the seeded request/attempt totals', async () => {
      const messageRepo = makeMockRepo(0, 0);
      const requestRepo = makeMockRepo(0, 0);

      await seedAgentMessages(messageRepo as never, requestRepo as never, 'user-1', logger);

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringMatching(/^Seeded \d+ requests \(\d+ attempts\)$/),
      );
    });
  });

  describe('getSeedConnections', () => {
    it('yields one connection per distinct (provider, auth_type) pair, ids stable', () => {
      const connections = getSeedConnections();
      expect(connections.length).toBeGreaterThan(0);
      const keys = new Set(connections.map((c) => `${c.provider}:${c.auth_type}`));
      expect(keys.size).toBe(connections.length);
      for (const c of connections) {
        expect(c.id).toBe(seedConnectionId(c.provider, c.auth_type));
      }
    });

    it('covers the fallback primary model (anthropic subscription)', () => {
      const connections = getSeedConnections();
      expect(
        connections.some((c) => c.provider === 'anthropic' && c.auth_type === 'subscription'),
      ).toBe(true);
    });
  });
});
