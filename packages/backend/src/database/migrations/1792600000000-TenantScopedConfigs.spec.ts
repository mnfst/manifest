import { QueryRunner } from 'typeorm';
import { TenantScopedConfigs1792600000000 } from './1792600000000-TenantScopedConfigs';

/**
 * The migration re-scopes three tables (email_provider_configs, api_keys,
 * custom_providers) via a shared `rescopeTable` helper. Each table runs an
 * orphan-count probe whose return value steers control flow; the mock returns
 * `orphanCount` for every COUNT probe and records all SQL for assertion.
 */
function makeRunner(orphanCount: number): { runner: QueryRunner; queries: string[] } {
  const queries: string[] = [];
  const runner = {
    query: jest.fn(async (sql: string) => {
      queries.push(sql);
      if (sql.includes('SELECT COUNT(*)') && sql.includes('"tenant_id" IS NULL')) {
        return [{ count: String(orphanCount) }];
      }
      return undefined;
    }),
  } as unknown as QueryRunner;
  return { runner, queries };
}

describe('TenantScopedConfigs1792600000000', () => {
  let migration: TenantScopedConfigs1792600000000;
  const originalForce = process.env.MANIFEST_MIGRATION_FORCE;

  beforeEach(() => {
    migration = new TenantScopedConfigs1792600000000();
    delete process.env.MANIFEST_MIGRATION_FORCE;
  });

  afterEach(() => {
    if (originalForce === undefined) delete process.env.MANIFEST_MIGRATION_FORCE;
    else process.env.MANIFEST_MIGRATION_FORCE = originalForce;
  });

  describe('up — no orphans', () => {
    it('re-scopes all three config tables to the tenant', async () => {
      const { runner, queries } = makeRunner(0);
      await migration.up(runner);

      for (const table of ['email_provider_configs', 'api_keys', 'custom_providers']) {
        expect(
          queries.some(
            (q) =>
              q.includes(`ALTER TABLE "${table}"`) &&
              q.includes('ADD COLUMN IF NOT EXISTS "tenant_id"'),
          ),
        ).toBe(true);
        expect(
          queries.some(
            (q) =>
              q.includes(`UPDATE "${table}" c`) && q.includes('t."owner_user_id" = c."user_id"'),
          ),
        ).toBe(true);
        expect(
          queries.some(
            (q) =>
              q.includes(`ALTER TABLE "${table}"`) &&
              q.includes('ALTER COLUMN "tenant_id" SET NOT NULL'),
          ),
        ).toBe(true);
        expect(
          queries.some(
            (q) =>
              q.includes(`ALTER TABLE "${table}"`) &&
              q.includes('RENAME COLUMN "user_id" TO "created_by_user_id"'),
          ),
        ).toBe(true);
      }
    });

    it('moves email_provider_configs uniqueness to the tenant', async () => {
      const { runner, queries } = makeRunner(0);
      await migration.up(runner);
      expect(
        queries.some((q) =>
          q.includes('DROP INDEX IF EXISTS "IDX_email_provider_configs_user_id"'),
        ),
      ).toBe(true);
      const idx = queries.find((q) => q.includes('"uq_email_provider_configs_tenant"'));
      expect(idx).toBeDefined();
      expect(idx).toContain('ON "email_provider_configs" ("tenant_id")');
    });

    it('adds a tenant index on api_keys', async () => {
      const { runner, queries } = makeRunner(0);
      await migration.up(runner);
      expect(
        queries.some(
          (q) => q.includes('"idx_api_keys_tenant"') && q.includes('ON "api_keys" ("tenant_id")'),
        ),
      ).toBe(true);
    });

    it('moves custom_providers uniqueness to (tenant_id, LOWER(name))', async () => {
      const { runner, queries } = makeRunner(0);
      await migration.up(runner);
      expect(
        queries.some((q) => q.includes('DROP INDEX IF EXISTS "IDX_custom_providers_user_name"')),
      ).toBe(true);
      const idx = queries.find((q) => q.includes('"IDX_custom_providers_tenant_name"'));
      expect(idx).toBeDefined();
      expect(idx).toContain('("tenant_id", LOWER("name"))');
    });
  });

  describe('up — orphan rows', () => {
    it('throws on the first table with orphans (no force) and names the table', async () => {
      const { runner } = makeRunner(5);
      await expect(migration.up(runner)).rejects.toThrow(/email_provider_configs row\(s\)/);
    });

    it('deletes orphans across every table when MANIFEST_MIGRATION_FORCE=1', async () => {
      process.env.MANIFEST_MIGRATION_FORCE = '1';
      const { runner, queries } = makeRunner(1);
      await migration.up(runner);

      for (const table of ['email_provider_configs', 'api_keys', 'custom_providers']) {
        expect(
          queries.some((q) =>
            new RegExp(
              `DELETE\\s+FROM\\s+"${table}"\\s+WHERE\\s+"tenant_id"\\s+IS\\s+NULL`,
              'i',
            ).test(q),
          ),
        ).toBe(true);
      }
    });
  });

  describe('down', () => {
    it('restores user-scoped columns and indexes for all three tables', async () => {
      const { runner, queries } = makeRunner(0);
      await migration.down(runner);

      expect(
        queries.some((q) => q.includes('DROP INDEX IF EXISTS "IDX_custom_providers_tenant_name"')),
      ).toBe(true);
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER TABLE "custom_providers"') &&
            q.includes('RENAME COLUMN "created_by_user_id" TO "user_id"'),
        ),
      ).toBe(true);
      expect(queries.some((q) => q.includes('"IDX_custom_providers_user_name"'))).toBe(true);
      expect(queries.some((q) => q.includes('DROP INDEX IF EXISTS "idx_api_keys_tenant"'))).toBe(
        true,
      );
      expect(
        queries.some((q) => q.includes('DROP INDEX IF EXISTS "uq_email_provider_configs_tenant"')),
      ).toBe(true);
      expect(queries.some((q) => q.includes('"IDX_email_provider_configs_user_id"'))).toBe(true);
      for (const table of ['custom_providers', 'api_keys', 'email_provider_configs']) {
        expect(
          queries.some(
            (q) =>
              q.includes(`ALTER TABLE "${table}"`) &&
              q.includes('DROP COLUMN IF EXISTS "tenant_id"'),
          ),
        ).toBe(true);
      }
    });
  });
});
