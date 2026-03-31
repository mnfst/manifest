import { QueryRunner } from 'typeorm';
import { AddDetailViewIndexes1775000000000 } from './1775000000000-AddDetailViewIndexes';

describe('AddDetailViewIndexes1775000000000', () => {
  let migration: AddDetailViewIndexes1775000000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddDetailViewIndexes1775000000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('should create all 3 indexes', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(3);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_llm_calls_turn_id'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_tool_executions_llm_call_id'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_agent_logs_trace_id'),
      );
    });

    it('should use CREATE INDEX IF NOT EXISTS', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      for (const call of queryRunner.query.mock.calls) {
        expect(call[0]).toMatch(/^CREATE INDEX IF NOT EXISTS/);
      }
    });
  });

  describe('down', () => {
    it('should drop all 3 indexes', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(3);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_agent_logs_trace_id'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_tool_executions_llm_call_id'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_llm_calls_turn_id'),
      );
    });

    it('should use DROP INDEX IF EXISTS', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      for (const call of queryRunner.query.mock.calls) {
        expect(call[0]).toMatch(/^DROP INDEX IF EXISTS/);
      }
    });
  });
});
