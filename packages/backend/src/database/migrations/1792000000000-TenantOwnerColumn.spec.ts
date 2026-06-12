import { QueryRunner } from 'typeorm';
import { TenantOwnerColumn1792000000000 } from './1792000000000-TenantOwnerColumn';

describe('TenantOwnerColumn1792000000000', () => {
  let migration: TenantOwnerColumn1792000000000;
  const queries: string[] = [];
  let queryRunner: QueryRunner;

  beforeEach(() => {
    migration = new TenantOwnerColumn1792000000000();
    queries.length = 0;
    queryRunner = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
      }),
    } as unknown as QueryRunner;
  });

  describe('up', () => {
    it('adds the nullable owner_user_id column to tenants', async () => {
      await migration.up(queryRunner);
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER TABLE "tenants"') &&
            q.includes('ADD COLUMN IF NOT EXISTS "owner_user_id"'),
        ),
      ).toBe(true);
    });

    it('backfills owner_user_id by copying name where it is still null', async () => {
      await migration.up(queryRunner);
      const backfill = queries.find((q) => q.includes('UPDATE "tenants"'));
      expect(backfill).toBeDefined();
      expect(backfill).toContain('SET "owner_user_id" = "name"');
      expect(backfill).toContain('WHERE "owner_user_id" IS NULL');
    });

    it('creates a partial unique index only where owner_user_id is set', async () => {
      await migration.up(queryRunner);
      const index = queries.find((q) => q.includes('"uq_tenants_owner_user"'));
      expect(index).toBeDefined();
      expect(index).toContain('CREATE UNIQUE INDEX IF NOT EXISTS');
      expect(index).toContain('ON "tenants" ("owner_user_id")');
      expect(index).toContain('WHERE "owner_user_id" IS NOT NULL');
    });

    it('adds the column before backfilling it', async () => {
      await migration.up(queryRunner);
      const addIdx = queries.findIndex((q) =>
        q.includes('ADD COLUMN IF NOT EXISTS "owner_user_id"'),
      );
      const backfillIdx = queries.findIndex((q) => q.includes('SET "owner_user_id" = "name"'));
      expect(addIdx).toBeGreaterThan(-1);
      expect(backfillIdx).toBeGreaterThan(addIdx);
    });
  });

  describe('down', () => {
    it('drops the index and the owner_user_id column', async () => {
      await migration.down(queryRunner);
      expect(queries.some((q) => q.includes('DROP INDEX IF EXISTS "uq_tenants_owner_user"'))).toBe(
        true,
      );
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER TABLE "tenants"') &&
            q.includes('DROP COLUMN IF EXISTS "owner_user_id"'),
        ),
      ).toBe(true);
    });

    it('drops the index before the column it depends on', async () => {
      await migration.down(queryRunner);
      const dropIndexIdx = queries.findIndex((q) =>
        q.includes('DROP INDEX IF EXISTS "uq_tenants_owner_user"'),
      );
      const dropColIdx = queries.findIndex((q) =>
        q.includes('DROP COLUMN IF EXISTS "owner_user_id"'),
      );
      expect(dropIndexIdx).toBeGreaterThan(-1);
      expect(dropColIdx).toBeGreaterThan(dropIndexIdx);
    });
  });
});
