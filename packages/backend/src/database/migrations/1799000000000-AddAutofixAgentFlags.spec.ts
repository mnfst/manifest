import { QueryRunner } from 'typeorm';
import { AddAutofixAgentFlags1799000000000 } from './1799000000000-AddAutofixAgentFlags';

describe('AddAutofixAgentFlags1799000000000', () => {
  let migration: AddAutofixAgentFlags1799000000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddAutofixAgentFlags1799000000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('adds the autofix_enabled and autofix_max_attempts columns to agents', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('ADD COLUMN "autofix_enabled"'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('ADD COLUMN "autofix_max_attempts"'),
      );
    });
  });

  describe('down', () => {
    it('drops both autofix columns', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN "autofix_max_attempts"'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN "autofix_enabled"'),
      );
    });
  });

  it('exposes a stable migration name', () => {
    expect(migration.name).toBe('AddAutofixAgentFlags1799000000000');
  });
});
