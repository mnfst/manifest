import { QueryRunner } from 'typeorm';
import { BackfillLocalCustomProviders1777300000000 } from './1777300000000-BackfillLocalCustomProviders';

describe('BackfillLocalCustomProviders1777300000000', () => {
  let migration: BackfillLocalCustomProviders1777300000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new BackfillLocalCustomProviders1777300000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('exposes a stable migration name', () => {
    expect(migration.name).toBe('BackfillLocalCustomProviders1777300000000');
  });

  describe('up', () => {
    it('dedupes colliding api_key rows and re-tags custom:<uuid> rows whose name matches a canonical local runner', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sqls = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqls).toHaveLength(2);

      // Dedupe first
      expect(sqls[0]).toContain('DELETE FROM "user_providers"');
      expect(sqls[0]).toContain(`u."provider" LIKE 'custom:%'`);
      expect(sqls[0]).toContain(`u."auth_type" = 'api_key'`);
      expect(sqls[0]).toContain(`v."auth_type" = 'local'`);

      // Re-tag joins custom_providers on the provider key and normalizes
      // the display name before matching.
      expect(sqls[1]).toContain('UPDATE "user_providers"');
      expect(sqls[1]).toContain(`SET "auth_type" = 'local'`);
      expect(sqls[1]).toContain(`u."provider" LIKE 'custom:%'`);
      expect(sqls[1]).toContain('custom_providers');
      expect(sqls[1]).toContain(`REGEXP_REPLACE`);
      expect(sqls[1]).toContain(`'ollama'`);
      expect(sqls[1]).toContain(`'lmstudio'`);
    });
  });

  describe('down', () => {
    it('dedupes colliding api_key rows first, then reverses the re-tag', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      const sqls = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqls).toHaveLength(2);

      expect(sqls[0]).toContain('DELETE FROM "user_providers"');
      expect(sqls[0]).toContain(`u."auth_type" = 'local'`);
      expect(sqls[0]).toContain(`v."auth_type" = 'api_key'`);

      expect(sqls[1]).toContain('UPDATE "user_providers"');
      expect(sqls[1]).toContain(`SET "auth_type" = 'api_key'`);
      expect(sqls[1]).toContain(`u."auth_type" = 'local'`);
    });
  });
});
