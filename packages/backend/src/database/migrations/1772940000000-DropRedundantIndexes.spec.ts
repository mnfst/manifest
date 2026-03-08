import { QueryRunner } from 'typeorm';
import { DropRedundantIndexes1772940000000 } from './1772940000000-DropRedundantIndexes';

describe('DropRedundantIndexes1772940000000', () => {
  let migration: DropRedundantIndexes1772940000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new DropRedundantIndexes1772940000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('should drop all 14 redundant indexes', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(14);
    });

    it('should use DROP INDEX IF EXISTS', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      for (const call of queryRunner.query.mock.calls) {
        expect(call[0]).toMatch(/^DROP INDEX IF EXISTS/);
      }
    });

    it('should drop agent_messages single-column indexes', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_519ec0b8e9fc7c2e53d300c69c'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_1d3c0f0f21ffa94c7300a2e996'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_cc0146344144249cd7dde2f8ad'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_agent_messages_timestamp'),
      );
    });

    it('should drop tool_executions single-column indexes', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_7fc8d9c06936a673fd5c404706'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_a24432cde19440451cc7b5d15f'),
      );
    });

    it('should drop llm_calls single-column indexes', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_ff92361a95863b8f0de3a371e5'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_e3e44ae5bdb48ceeb10d7880cf'),
      );
    });

    it('should drop agent_logs single-column indexes', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_e981397068db115bcd95a39396'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_039a398c03e68e46a0fc0bc998'),
      );
    });

    it('should drop snapshot single-column indexes', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_305fe9e3e5efff31a20a90c12e'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_49c9b53af0ef0839174ce670ef'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_468b7d3a69ee28a127cd8287b9'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_3bf823e7c31aa4a5f12fcde527'),
      );
    });
  });

  describe('down', () => {
    it('should recreate all 14 indexes', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(14);
    });

    it('should use CREATE INDEX', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      for (const call of queryRunner.query.mock.calls) {
        expect(call[0]).toMatch(/^CREATE INDEX/);
      }
    });
  });
});
