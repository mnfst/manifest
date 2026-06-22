import { QueryRunner } from 'typeorm';
import { AddCustomProviderFkToUserProviders1792100000000 } from './1792100000000-AddCustomProviderFkToUserProviders';

function makeQueryRunner() {
  const calls: string[] = [];
  const query = jest.fn(async (sql: string) => {
    calls.push(sql.replace(/\s+/g, ' ').trim());
    return undefined;
  });
  return { query, calls };
}

describe('AddCustomProviderFkToUserProviders1792100000000', () => {
  let migration: AddCustomProviderFkToUserProviders1792100000000;

  beforeEach(() => {
    migration = new AddCustomProviderFkToUserProviders1792100000000();
  });

  describe('up', () => {
    it('cleans orphans before adding the column, FK, and index — in that order', async () => {
      const { query, calls } = makeQueryRunner();
      await migration.up({ query } as unknown as QueryRunner);

      expect(calls).toHaveLength(4);
      expect(calls[0]).toMatch(/^DELETE FROM "user_providers"/);
      expect(calls[1]).toMatch(/ADD COLUMN "custom_provider_id"/);
      expect(calls[2]).toMatch(/ADD CONSTRAINT "FK_user_providers_custom_provider"/);
      expect(calls[3]).toMatch(/CREATE INDEX "IDX_user_providers_custom_provider_id"/);
    });

    it('only deletes companion rows whose custom provider no longer exists', async () => {
      const { query, calls } = makeQueryRunner();
      await migration.up({ query } as unknown as QueryRunner);

      // Scoped to custom:% rows AND guarded by a NOT EXISTS against
      // custom_providers — plain provider rows (anthropic, openai, ...) and
      // resolvable custom rows must never match.
      expect(calls[0]).toContain(`"provider" LIKE 'custom:%'`);
      expect(calls[0]).toContain('NOT EXISTS');
      expect(calls[0]).toContain(`cp."id" = substring("user_providers"."provider" FROM 8)`);
    });

    it('derives the column with GENERATED ALWAYS ... STORED and cascades deletes', async () => {
      const { query, calls } = makeQueryRunner();
      await migration.up({ query } as unknown as QueryRunner);

      expect(calls[1]).toContain('GENERATED ALWAYS AS');
      expect(calls[1]).toContain(`CASE WHEN "provider" LIKE 'custom:%'`);
      expect(calls[1]).toContain('STORED');
      expect(calls[2]).toContain(`REFERENCES "custom_providers"("id")`);
      expect(calls[2]).toContain('ON DELETE CASCADE');
      // Partial index: only custom rows carry a non-NULL id, so don't index
      // the (vastly more numerous) plain provider rows.
      expect(calls[3]).toContain('WHERE "custom_provider_id" IS NOT NULL');
    });
  });

  describe('down', () => {
    it('drops index, FK, and column — and never re-inserts the deleted orphans', async () => {
      const { query, calls } = makeQueryRunner();
      await migration.down({ query } as unknown as QueryRunner);

      expect(calls).toHaveLength(3);
      expect(calls[0]).toContain('DROP INDEX IF EXISTS "IDX_user_providers_custom_provider_id"');
      expect(calls[1]).toContain('DROP CONSTRAINT IF EXISTS "FK_user_providers_custom_provider"');
      expect(calls[2]).toContain('DROP COLUMN IF EXISTS "custom_provider_id"');
      expect(calls.some((sql) => /INSERT/i.test(sql))).toBe(false);
    });
  });
});
