import { QueryRunner } from 'typeorm';
import { AddAgentSoftDelete1782200000000 } from './1782200000000-AddAgentSoftDelete';

describe('AddAgentSoftDelete1782200000000', () => {
  let migration: AddAgentSoftDelete1782200000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddAgentSoftDelete1782200000000();
    queryRunner = { query: jest.fn().mockResolvedValue([]) };
  });

  describe('up', () => {
    it('adds deleted_at, drops the legacy unique index, and creates a partial unique index', async () => {
      queryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM pg_indexes')) {
          return [{ indexname: 'IDX_legacy_tenant_name' }];
        }
        return undefined;
      });

      await migration.up(queryRunner as unknown as QueryRunner);

      const sqls = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqls.find((s) => s.includes('ADD COLUMN "deleted_at"'))).toBeDefined();
      expect(sqls.find((s) => s.includes('FROM pg_indexes'))).toBeDefined();
      expect(
        sqls.find((s) => s.includes('DROP INDEX IF EXISTS "IDX_legacy_tenant_name"')),
      ).toBeDefined();
      const partialIdx = sqls.find((s) => s.includes('UQ_agents_tenant_name_live'));
      expect(partialIdx).toBeDefined();
      expect(partialIdx).toContain('WHERE "deleted_at" IS NULL');
    });

    it('skips DROP INDEX when no legacy unique index exists', async () => {
      queryRunner.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM pg_indexes')) return [];
        return undefined;
      });

      await migration.up(queryRunner as unknown as QueryRunner);

      const sqls = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqls.find((s) => s.includes('DROP INDEX IF EXISTS'))).toBeUndefined();
      expect(sqls.find((s) => s.includes('UQ_agents_tenant_name_live'))).toBeDefined();
    });
  });

  describe('down', () => {
    it('drops the partial index, mangles soft-deleted slugs, restores the unique index, and drops the column', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      const sqls = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqls).toEqual([
        expect.stringContaining('DROP INDEX IF EXISTS "UQ_agents_tenant_name_live"'),
        expect.stringMatching(
          /UPDATE "agents"[\s\S]*SET "name" = "name" \|\| '__deleted_' \|\| "id"[\s\S]*WHERE "deleted_at" IS NOT NULL/,
        ),
        expect.stringContaining('CREATE UNIQUE INDEX "IDX_agents_tenant_name"'),
        expect.stringContaining('DROP COLUMN "deleted_at"'),
      ]);
    });
  });
});
