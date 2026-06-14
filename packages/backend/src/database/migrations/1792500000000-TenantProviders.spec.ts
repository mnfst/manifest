import { QueryRunner } from 'typeorm';
import { TenantProviders1792500000000 } from './1792500000000-TenantProviders';

/**
 * Drives the migration against a mocked queryRunner. The orphan-count probe
 * (`SELECT COUNT(*) ... WHERE "tenant_id" IS NULL`) is the only query whose
 * return value steers control flow, so the mock returns `orphanCount` for it
 * and records every SQL string for assertion.
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

describe('TenantProviders1792500000000', () => {
  let migration: TenantProviders1792500000000;
  const originalForce = process.env.MANIFEST_MIGRATION_FORCE;

  beforeEach(() => {
    migration = new TenantProviders1792500000000();
    delete process.env.MANIFEST_MIGRATION_FORCE;
  });

  afterEach(() => {
    if (originalForce === undefined) delete process.env.MANIFEST_MIGRATION_FORCE;
    else process.env.MANIFEST_MIGRATION_FORCE = originalForce;
  });

  describe('up — no orphans', () => {
    it('adds tenant_id and backfills it through tenants.owner_user_id', async () => {
      const { runner, queries } = makeRunner(0);
      await migration.up(runner);

      expect(
        queries.some(
          (q) =>
            q.includes('ALTER TABLE "user_providers"') &&
            q.includes('ADD COLUMN IF NOT EXISTS "tenant_id"'),
        ),
      ).toBe(true);
      const backfill = queries.find((q) => q.includes('UPDATE "user_providers" up'));
      expect(backfill).toBeDefined();
      expect(backfill).toContain('t."owner_user_id" = up."user_id"');
      expect(backfill).toContain('up."tenant_id" IS NULL');
    });

    it('makes tenant_id NOT NULL and demotes user_id to a nullable audit column', async () => {
      const { runner, queries } = makeRunner(0);
      await migration.up(runner);

      expect(queries.some((q) => q.includes('ALTER COLUMN "tenant_id" SET NOT NULL'))).toBe(true);
      expect(
        queries.some((q) => q.includes('RENAME COLUMN "user_id" TO "created_by_user_id"')),
      ).toBe(true);
      expect(
        queries.some((q) => q.includes('ALTER COLUMN "created_by_user_id" DROP NOT NULL')),
      ).toBe(true);
    });

    it('moves the uniqueness key from the user to the tenant', async () => {
      const { runner, queries } = makeRunner(0);
      await migration.up(runner);

      expect(
        queries.some((q) =>
          q.includes('DROP INDEX IF EXISTS "IDX_user_providers_user_provider_auth_label"'),
        ),
      ).toBe(true);
      const newIndex = queries.find((q) =>
        q.includes('"IDX_tenant_providers_tenant_provider_auth_label"'),
      );
      expect(newIndex).toBeDefined();
      expect(newIndex).toContain('("tenant_id", "provider", "auth_type", LOWER("label"))');
    });

    it('renames the table and the junction column and index', async () => {
      const { runner, queries } = makeRunner(0);
      await migration.up(runner);

      expect(
        queries.some((q) =>
          q.includes('ALTER TABLE "user_providers" RENAME TO "tenant_providers"'),
        ),
      ).toBe(true);
      expect(
        queries.some((q) => q.includes('RENAME COLUMN "user_provider_id" TO "tenant_provider_id"')),
      ).toBe(true);
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER INDEX "IDX_agent_enabled_providers_provider"') &&
            q.includes('RENAME TO "IDX_agent_enabled_providers_tenant_provider"'),
        ),
      ).toBe(true);
    });

    it('renames the agent_messages connection column, FK and index to the tenant scope', async () => {
      const { runner, queries } = makeRunner(0);
      await migration.up(runner);

      expect(
        queries.some((q) =>
          q.includes(
            'ALTER TABLE "agent_messages" RENAME COLUMN "user_provider_id" TO "tenant_provider_id"',
          ),
        ),
      ).toBe(true);
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER TABLE "agent_messages" RENAME CONSTRAINT') &&
            q.includes('"FK_agent_messages_user_provider"') &&
            q.includes('"FK_agent_messages_tenant_provider"'),
        ),
      ).toBe(true);
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER INDEX "IDX_agent_messages_user_provider"') &&
            q.includes('RENAME TO "IDX_agent_messages_tenant_provider"'),
        ),
      ).toBe(true);
      // The custom-provider FK on the renamed table follows suit.
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER TABLE "tenant_providers" RENAME CONSTRAINT') &&
            q.includes('"FK_user_providers_custom_provider"') &&
            q.includes('"FK_tenant_providers_custom_provider"'),
        ),
      ).toBe(true);
    });

    it('does not delete any rows when there are no orphans', async () => {
      const { runner, queries } = makeRunner(0);
      await migration.up(runner);
      expect(queries.some((q) => /DELETE\s+FROM\s+"user_providers"/i.test(q))).toBe(false);
    });
  });

  describe('up — orphan rows', () => {
    it('throws (without force) so the operator can inspect the orphans', async () => {
      const { runner, queries } = makeRunner(3);
      await expect(migration.up(runner)).rejects.toThrow(/3 user_providers row\(s\)/);
      // It aborts before the NOT NULL / rename steps.
      expect(queries.some((q) => q.includes('ALTER COLUMN "tenant_id" SET NOT NULL'))).toBe(false);
      expect(queries.some((q) => /DELETE\s+FROM\s+"user_providers"/i.test(q))).toBe(false);
    });

    it('deletes the orphans and continues when MANIFEST_MIGRATION_FORCE=1', async () => {
      process.env.MANIFEST_MIGRATION_FORCE = '1';
      const { runner, queries } = makeRunner(2);
      await migration.up(runner);

      expect(
        queries.some((q) =>
          /DELETE\s+FROM\s+"user_providers"\s+WHERE\s+"tenant_id"\s+IS\s+NULL/i.test(q),
        ),
      ).toBe(true);
      // Having cleared the orphans it proceeds to lock in the NOT NULL constraint.
      expect(queries.some((q) => q.includes('ALTER COLUMN "tenant_id" SET NOT NULL'))).toBe(true);
    });
  });

  describe('down', () => {
    it('reverses the renames and restores the user-scoped index', async () => {
      const { runner, queries } = makeRunner(0);
      await migration.down(runner);

      expect(
        queries.some((q) => q.includes('RENAME COLUMN "tenant_provider_id" TO "user_provider_id"')),
      ).toBe(true);
      expect(
        queries.some((q) =>
          q.includes('ALTER TABLE "tenant_providers" RENAME TO "user_providers"'),
        ),
      ).toBe(true);
      expect(
        queries.some((q) => q.includes('RENAME COLUMN "created_by_user_id" TO "user_id"')),
      ).toBe(true);
      expect(queries.some((q) => q.includes('"IDX_user_providers_user_provider_auth_label"'))).toBe(
        true,
      );
      expect(queries.some((q) => q.includes('DROP COLUMN IF EXISTS "tenant_id"'))).toBe(true);
    });

    it('reverses the agent_messages connection column, FK and index renames', async () => {
      const { runner, queries } = makeRunner(0);
      await migration.down(runner);

      expect(
        queries.some((q) =>
          q.includes(
            'ALTER TABLE "agent_messages" RENAME COLUMN "tenant_provider_id" TO "user_provider_id"',
          ),
        ),
      ).toBe(true);
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER TABLE "agent_messages" RENAME CONSTRAINT') &&
            q.includes('"FK_agent_messages_tenant_provider"') &&
            q.includes('"FK_agent_messages_user_provider"'),
        ),
      ).toBe(true);
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER INDEX "IDX_agent_messages_tenant_provider"') &&
            q.includes('RENAME TO "IDX_agent_messages_user_provider"'),
        ),
      ).toBe(true);
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER TABLE "tenant_providers" RENAME CONSTRAINT') &&
            q.includes('"FK_tenant_providers_custom_provider"') &&
            q.includes('"FK_user_providers_custom_provider"'),
        ),
      ).toBe(true);
    });
  });
});
