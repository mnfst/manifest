import { QueryRunner } from 'typeorm';
import { BackfillLocalAuthType1777200000000 } from './1777200000000-BackfillLocalAuthType';

describe('BackfillLocalAuthType1777200000000', () => {
  let migration: BackfillLocalAuthType1777200000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new BackfillLocalAuthType1777200000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('exposes a stable migration name', () => {
    expect(migration.name).toBe('BackfillLocalAuthType1777200000000');
  });

  describe('up', () => {
    it('dedupes api_key rows that collide with existing local rows, then re-tags remaining api_key rows', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sqls = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqls).toHaveLength(2);

      // Dedupe runs first to protect the unique (agent_id, provider, auth_type) index
      expect(sqls[0]).toContain('DELETE FROM "user_providers"');
      expect(sqls[0]).toContain(`'ollama'`);
      expect(sqls[0]).toContain(`'lmstudio'`);
      expect(sqls[0]).toContain(`u."auth_type" = 'api_key'`);
      expect(sqls[0]).toContain(`v."auth_type" = 'local'`);

      // Then the UPDATE re-tags rows
      expect(sqls[1]).toContain('UPDATE "user_providers"');
      expect(sqls[1]).toContain(`SET "auth_type" = 'local'`);
      expect(sqls[1]).toContain(`"provider" IN ('ollama', 'lmstudio')`);
      expect(sqls[1]).toContain(`"auth_type" = 'api_key'`);
    });
  });

  describe('down', () => {
    it('dedupes colliding local rows first, then reverses the re-tag', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      const sqls = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqls).toHaveLength(2);

      // Dedupe mirrors up() but swaps the auth_type directions
      expect(sqls[0]).toContain('DELETE FROM "user_providers"');
      expect(sqls[0]).toContain(`u."auth_type" = 'local'`);
      expect(sqls[0]).toContain(`v."auth_type" = 'api_key'`);

      expect(sqls[1]).toContain('UPDATE "user_providers"');
      expect(sqls[1]).toContain(`SET "auth_type" = 'api_key'`);
      expect(sqls[1]).toContain(`"provider" IN ('ollama', 'lmstudio')`);
      expect(sqls[1]).toContain(`"auth_type" = 'local'`);
    });
  });
});
