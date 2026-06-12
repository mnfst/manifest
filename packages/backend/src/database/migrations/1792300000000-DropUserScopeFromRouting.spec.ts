import { QueryRunner } from 'typeorm';
import { DropUserScopeFromRouting1792300000000 } from './1792300000000-DropUserScopeFromRouting';

describe('DropUserScopeFromRouting1792300000000', () => {
  let migration: DropUserScopeFromRouting1792300000000;
  const queries: string[] = [];
  let queryRunner: QueryRunner;

  beforeEach(() => {
    migration = new DropUserScopeFromRouting1792300000000();
    queries.length = 0;
    queryRunner = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
      }),
    } as unknown as QueryRunner;
  });

  describe('up', () => {
    it('drops user_id outright from the agent-scoped routing tables', async () => {
      await migration.up(queryRunner);
      for (const table of ['agent_model_params', 'tier_assignments', 'specificity_assignments']) {
        expect(
          queries.some(
            (q) =>
              q.includes(`ALTER TABLE "${table}"`) && q.includes('DROP COLUMN IF EXISTS "user_id"'),
          ),
        ).toBe(true);
      }
    });

    it('backfills header_tiers.tenant_id from the owning agent, deletes orphans, then makes it NOT NULL', async () => {
      await migration.up(queryRunner);

      const backfill = queries.find(
        (q) => q.includes('UPDATE "header_tiers" h') && q.includes('a."tenant_id"'),
      );
      expect(backfill).toBeDefined();
      expect(backfill).toContain('FROM "agents" a');
      expect(backfill).toContain('h."tenant_id" IS NULL');

      const deleteIdx = queries.findIndex((q) =>
        /DELETE\s+FROM\s+"header_tiers"\s+WHERE\s+"tenant_id"\s+IS\s+NULL/i.test(q),
      );
      const notNullIdx = queries.findIndex(
        (q) => q.includes('"header_tiers"') && q.includes('ALTER COLUMN "tenant_id" SET NOT NULL'),
      );
      const dropUserIdx = queries.findIndex(
        (q) => q.includes('"header_tiers"') && q.includes('DROP COLUMN IF EXISTS "user_id"'),
      );
      expect(deleteIdx).toBeGreaterThan(-1);
      expect(notNullIdx).toBeGreaterThan(deleteIdx);
      expect(dropUserIdx).toBeGreaterThan(notNullIdx);
    });

    it('drops the user-scoped notification_rules index and column', async () => {
      await migration.up(queryRunner);
      expect(
        queries.some((q) => q.includes('DROP INDEX IF EXISTS "IDX_notification_rules_user_agent"')),
      ).toBe(true);
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER TABLE "notification_rules"') &&
            q.includes('DROP COLUMN IF EXISTS "user_id"'),
        ),
      ).toBe(true);
    });

    it('renames oauth_pending_flows.user_id to tenant_id and re-keys its index', async () => {
      await migration.up(queryRunner);
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER TABLE "oauth_pending_flows"') &&
            q.includes('RENAME COLUMN "user_id" TO "tenant_id"'),
        ),
      ).toBe(true);
      expect(
        queries.some((q) =>
          q.includes('DROP INDEX IF EXISTS "IDX_oauth_pending_flows_agent_user"'),
        ),
      ).toBe(true);
      const newIndex = queries.find((q) => q.includes('"IDX_oauth_pending_flows_agent_tenant"'));
      expect(newIndex).toBeDefined();
      expect(newIndex).toContain('("provider", "agent_id", "tenant_id", "created_at" DESC)');
    });

    it('renames playground_runs.user_id to created_by_user_id and re-keys history by tenant', async () => {
      await migration.up(queryRunner);
      expect(
        queries.some((q) =>
          q.includes('DROP INDEX IF EXISTS "IDX_playground_runs_user_agent_created"'),
        ),
      ).toBe(true);
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER TABLE "playground_runs"') &&
            q.includes('RENAME COLUMN "user_id" TO "created_by_user_id"'),
        ),
      ).toBe(true);
      expect(
        queries.some((q) => q.includes('ALTER COLUMN "created_by_user_id" DROP NOT NULL')),
      ).toBe(true);
      const newIndex = queries.find((q) =>
        q.includes('"IDX_playground_runs_tenant_agent_created"'),
      );
      expect(newIndex).toBeDefined();
      expect(newIndex).toContain('("tenant_id", "agent_id", "created_at" DESC)');
    });
  });

  describe('down', () => {
    it('reverses the oauth_pending_flows rename and index', async () => {
      await migration.down(queryRunner);
      expect(
        queries.some((q) =>
          q.includes('DROP INDEX IF EXISTS "IDX_oauth_pending_flows_agent_tenant"'),
        ),
      ).toBe(true);
      expect(queries.some((q) => q.includes('RENAME COLUMN "tenant_id" TO "user_id"'))).toBe(true);
      expect(queries.some((q) => q.includes('"IDX_oauth_pending_flows_agent_user"'))).toBe(true);
    });

    it('re-adds notification_rules.user_id and backfills from the tenant owner', async () => {
      await migration.down(queryRunner);
      expect(
        queries.some(
          (q) =>
            q.includes('ALTER TABLE "notification_rules"') &&
            q.includes('ADD COLUMN IF NOT EXISTS "user_id"'),
        ),
      ).toBe(true);
      const backfill = queries.find(
        (q) => q.includes('UPDATE "notification_rules" r') && q.includes('t."owner_user_id"'),
      );
      expect(backfill).toBeDefined();
      expect(backfill).toContain('FROM "tenants" t');
    });

    it('re-adds user_id and backfills it for header_tiers and the agent-scoped routing tables', async () => {
      await migration.down(queryRunner);

      expect(
        queries.some(
          (q) =>
            q.includes('ALTER TABLE "header_tiers"') &&
            q.includes('ADD COLUMN IF NOT EXISTS "user_id"'),
        ),
      ).toBe(true);
      expect(
        queries.some(
          (q) =>
            q.includes('"header_tiers"') && q.includes('ALTER COLUMN "tenant_id" DROP NOT NULL'),
        ),
      ).toBe(true);

      for (const table of ['specificity_assignments', 'tier_assignments', 'agent_model_params']) {
        expect(
          queries.some(
            (q) =>
              q.includes(`ALTER TABLE "${table}"`) &&
              q.includes('ADD COLUMN IF NOT EXISTS "user_id"'),
          ),
        ).toBe(true);
        expect(
          queries.some((q) => q.includes(`UPDATE "${table}" x`) && q.includes('t."owner_user_id"')),
        ).toBe(true);
      }
    });

    it('restores the playground_runs user-scoped history index', async () => {
      await migration.down(queryRunner);
      expect(
        queries.some((q) =>
          q.includes('DROP INDEX IF EXISTS "IDX_playground_runs_tenant_agent_created"'),
        ),
      ).toBe(true);
      const idx = queries.find((q) => q.includes('"IDX_playground_runs_user_agent_created"'));
      expect(idx).toBeDefined();
      expect(idx).toContain('("user_id", "agent_id", "created_at" DESC)');
    });
  });
});
