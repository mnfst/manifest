import { QueryRunner } from 'typeorm';
import { AddComplexityRoutingFlag1777100000000 } from './1777100000000-AddComplexityRoutingFlag';

describe('AddComplexityRoutingFlag1777100000000', () => {
  let migration: AddComplexityRoutingFlag1777100000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddComplexityRoutingFlag1777100000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('exposes a stable migration name', () => {
    expect(migration.name).toBe('AddComplexityRoutingFlag1777100000000');
  });

  describe('up', () => {
    it('adds the column with default false, then backfills existing rows to true', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sqls = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqls[0]).toContain('ALTER TABLE "agents"');
      expect(sqls[0]).toContain('"complexity_routing_enabled" boolean NOT NULL DEFAULT false');
      expect(sqls[1]).toContain('UPDATE "agents" SET "complexity_routing_enabled" = true');

      const seed = sqls[2];
      expect(seed).toContain('INSERT INTO "tier_assignments"');
      expect(seed).toContain(`'default'`);
      expect(seed).toContain(`ta."tier" = 'standard'`);
      expect(seed).toContain('NOT EXISTS');
    });
  });

  describe('down', () => {
    it('removes seeded default rows then drops the column', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      const sqls = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqls[0]).toContain(`DELETE FROM "tier_assignments" WHERE "tier" = 'default'`);
      expect(sqls[1]).toContain('ALTER TABLE "agents" DROP COLUMN "complexity_routing_enabled"');
    });
  });
});
