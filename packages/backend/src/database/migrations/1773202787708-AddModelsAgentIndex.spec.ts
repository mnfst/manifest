import { QueryRunner } from 'typeorm';
import { AddModelsAgentIndex1773202787708 } from './1773202787708-AddModelsAgentIndex';

describe('AddModelsAgentIndex1773202787708', () => {
  let migration: AddModelsAgentIndex1773202787708;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddModelsAgentIndex1773202787708();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('should create the composite index', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_agent_messages_tenant_agent_model'),
      );
    });

    it('should use CREATE INDEX IF NOT EXISTS', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query.mock.calls[0][0]).toMatch(/CREATE INDEX IF NOT EXISTS/);
    });

    it('should index tenant_id, agent_name, and model columns', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain('"tenant_id"');
      expect(sql).toContain('"agent_name"');
      expect(sql).toContain('"model"');
    });
  });

  describe('down', () => {
    it('should drop the composite index', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_agent_messages_tenant_agent_model'),
      );
    });

    it('should use DROP INDEX IF EXISTS', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query.mock.calls[0][0]).toMatch(/DROP INDEX IF EXISTS/);
    });
  });
});
