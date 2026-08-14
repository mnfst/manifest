import { QueryRunner } from 'typeorm';
import { DropUnusedIndexes1772960000000 } from './1772960000000-DropUnusedIndexes';

describe('DropUnusedIndexes1772960000000', () => {
  let migration: DropUnusedIndexes1772960000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new DropUnusedIndexes1772960000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('should drop all 4 unused indexes', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(4);
    });

    it('should use DROP INDEX IF EXISTS', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      for (const call of queryRunner.query.mock.calls) {
        expect(call[0]).toMatch(/^DROP INDEX IF EXISTS/);
      }
    });

    it('should drop tool_executions composite index', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_4d007c4a559001d501d06fb6f4'),
      );
    });

    it('should drop token_usage_snapshots composite index', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_3af795abffe699032a63ff5c22'),
      );
    });

    it('should drop cost_snapshots composite index', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_cost_snapshots_tenant_agent_time'),
      );
    });

    it('should drop agent_logs composite index', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_e9678de7cf6f122f3286bb4075'),
      );
    });
  });

  describe('down', () => {
    it('should recreate all 4 indexes', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(4);
    });

    it('should use CREATE INDEX', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      for (const call of queryRunner.query.mock.calls) {
        expect(call[0]).toMatch(/^CREATE INDEX/);
      }
    });
  });
});
