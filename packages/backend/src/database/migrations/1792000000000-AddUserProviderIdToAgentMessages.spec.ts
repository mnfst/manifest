import { QueryRunner } from 'typeorm';

import { AddUserProviderIdToAgentMessages1792000000000 } from './1792000000000-AddUserProviderIdToAgentMessages';

describe('AddUserProviderIdToAgentMessages1792000000000', () => {
  const migration = new AddUserProviderIdToAgentMessages1792000000000();
  let queries: string[];
  let queryRunner: QueryRunner;

  beforeEach(() => {
    queries = [];
    queryRunner = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
      }),
    } as unknown as QueryRunner;
  });

  describe('up', () => {
    it('adds the nullable column first, with IF NOT EXISTS', async () => {
      await migration.up(queryRunner);

      expect(queries[0]).toContain(
        'ALTER TABLE "agent_messages" ADD COLUMN IF NOT EXISTS "user_provider_id" varchar',
      );
    });

    it('adds the FK with ON DELETE SET NULL (validated — trivial against an all-NULL column)', async () => {
      await migration.up(queryRunner);

      const fk = queries.find((q) =>
        q.includes('ADD CONSTRAINT "FK_agent_messages_user_provider"'),
      );
      expect(fk).toBeDefined();
      expect(fk).toContain('FOREIGN KEY ("user_provider_id") REFERENCES "user_providers"("id")');
      expect(fk).toContain('ON DELETE SET NULL ON UPDATE NO ACTION');
      // Validated, not NOT VALID — the column is empty so there is nothing to scan.
      expect(fk).not.toContain('NOT VALID');
    });

    it('builds the covering index in the migration (TenantProviders later renames it)', async () => {
      await migration.up(queryRunner);

      const idx = queries.find((q) =>
        q.includes('CREATE INDEX "IDX_agent_messages_user_provider"'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('"user_provider_id", "tenant_id", "timestamp" DESC');
    });

    it('does no inline historical backfill — that runs post-deploy', async () => {
      await migration.up(queryRunner);

      expect(queries.some((q) => q.includes('UPDATE "agent_messages"'))).toBe(false);
      // add column, add FK, create index — nothing else.
      expect(queries).toHaveLength(3);
    });
  });

  describe('down', () => {
    it('drops the index, then the FK, then the column', async () => {
      await migration.down(queryRunner);

      expect(queries[0]).toContain('DROP INDEX IF EXISTS "IDX_agent_messages_user_provider"');
      expect(queries[1]).toContain('DROP CONSTRAINT IF EXISTS "FK_agent_messages_user_provider"');
      expect(queries[2]).toContain('DROP COLUMN IF EXISTS "user_provider_id"');
    });
  });
});
