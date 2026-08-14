import { QueryRunner } from 'typeorm';
import { DropProviderRateLimits1791600000000 } from './1791600000000-DropProviderRateLimits';

describe('DropProviderRateLimits1791600000000', () => {
  let migration: DropProviderRateLimits1791600000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new DropProviderRateLimits1791600000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('drops the index before the table, both guarded with IF EXISTS', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(2);
      const [first, second] = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(first).toContain('DROP INDEX IF EXISTS "IDX_rate_limits_connection_latest"');
      expect(second).toContain('DROP TABLE IF EXISTS "provider_rate_limits"');
    });
  });

  describe('down', () => {
    it('is a no-op: the removed feature is not restored', async () => {
      await migration.down();

      expect(queryRunner.query).not.toHaveBeenCalled();
    });
  });
});
