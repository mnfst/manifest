import { DataSource } from 'typeorm';

import {
  PASS_1_SQL,
  PASS_2_SQL,
  PASS_3_SQL,
  TypeOrmBackfillGateway,
  WINDOW_END_SQL,
} from './backfill-message-providers.gateway';

function mockQueryRunner() {
  return {
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    query: jest.fn(),
  };
}

describe('backfill SQL constants', () => {
  it('target the post-rename schema and apply identical matching logic, scoped to a keyset window', () => {
    for (const sql of [PASS_1_SQL, PASS_2_SQL, PASS_3_SQL]) {
      expect(sql).toContain('SET "tenant_provider_id" = m.tp_id'); // renamed target column
      expect(sql).toContain('JOIN "tenant_providers" tp'); // renamed source table
      expect(sql).toContain('am2.id > $1 AND am2.id <= $2'); // keyset window
      expect(sql).toContain('am2.tenant_provider_id IS NULL');
      expect(sql).toContain('GROUP BY am2.id');
      expect(sql).toContain('HAVING COUNT(*) = 1');
      expect(sql).toContain('MIN(tp.id) AS tp_id');
    }
    // pass 1 matches the exact label; pass 2 ignores it; pass 3 joins via tenants
    // using the renamed created_by_user_id (== original user_id).
    expect(PASS_1_SQL).toContain("LOWER(COALESCE(am2.provider_key_label, 'Default'))");
    expect(PASS_2_SQL).not.toContain('provider_key_label');
    expect(PASS_3_SQL).toContain('JOIN "tenants" t ON t.id = am2.tenant_id');
    expect(PASS_3_SQL).toContain('tp.created_by_user_id = t.name');
    expect(WINDOW_END_SQL).toContain('ORDER BY id LIMIT $2');
  });
});

describe('TypeOrmBackfillGateway', () => {
  describe('analyze', () => {
    it('refreshes statistics on the stamped table and its join target', async () => {
      const query = jest.fn(async () => undefined);
      await new TypeOrmBackfillGateway({ query } as unknown as DataSource).analyze();
      expect(query).toHaveBeenCalledWith('ANALYZE "agent_messages"');
      expect(query).toHaveBeenCalledWith('ANALYZE "tenant_providers"');
    });
  });

  describe('nextWindowEnd', () => {
    it('returns the window end id', async () => {
      const query = jest.fn(async () => [{ end_id: 'id-9' }]);
      const gw = new TypeOrmBackfillGateway({ query } as unknown as DataSource);
      expect(await gw.nextWindowEnd('id-0', 100)).toBe('id-9');
      expect(query).toHaveBeenCalledWith(WINDOW_END_SQL, ['id-0', 100]);
    });

    it('returns null when the window is empty or end_id is null', async () => {
      const nullEnd = new TypeOrmBackfillGateway({
        query: jest.fn(async () => [{ end_id: null }]),
      } as unknown as DataSource);
      expect(await nullEnd.nextWindowEnd('z', 100)).toBeNull();

      const emptyRows = new TypeOrmBackfillGateway({
        query: jest.fn(async () => []),
      } as unknown as DataSource);
      expect(await emptyRows.nextWindowEnd('z', 100)).toBeNull();
    });
  });

  describe('stampWindow', () => {
    it('runs the three passes in one timeout-guarded transaction and totals the stamped rows', async () => {
      const qr = mockQueryRunner();
      qr.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ n: 3 }])
        .mockResolvedValueOnce([{ n: 2 }])
        .mockResolvedValueOnce([{ n: 1 }]);
      const ds = { createQueryRunner: jest.fn(() => qr) } as unknown as DataSource;

      const stamped = await new TypeOrmBackfillGateway(ds).stampWindow('a', 'b', {
        lockTimeoutMs: 5000,
        statementTimeoutMs: 60000,
      });

      expect(stamped).toBe(6);
      expect(qr.connect).toHaveBeenCalled();
      expect(qr.startTransaction).toHaveBeenCalled();
      expect(qr.query).toHaveBeenCalledWith("SET LOCAL lock_timeout = '5000ms'");
      expect(qr.query).toHaveBeenCalledWith("SET LOCAL statement_timeout = '60000ms'");
      expect(qr.query).toHaveBeenCalledWith(PASS_1_SQL, ['a', 'b']);
      expect(qr.query).toHaveBeenCalledWith(PASS_2_SQL, ['a', 'b']);
      expect(qr.query).toHaveBeenCalledWith(PASS_3_SQL, ['a', 'b']);
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.rollbackTransaction).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('rolls back, releases, and rethrows on failure', async () => {
      const qr = mockQueryRunner();
      const boom = new Error('deadlock detected');
      qr.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(boom);
      const ds = { createQueryRunner: jest.fn(() => qr) } as unknown as DataSource;

      await expect(
        new TypeOrmBackfillGateway(ds).stampWindow('a', 'b', {
          lockTimeoutMs: 1,
          statementTimeoutMs: 1,
        }),
      ).rejects.toThrow('deadlock detected');
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });
  });
});
