import { QueryRunner } from 'typeorm';
import { AddSavingsBaselineModel1782000000000 } from './1782000000000-AddSavingsBaselineModel';

describe('AddSavingsBaselineModel1782000000000', () => {
  let migration: AddSavingsBaselineModel1782000000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddSavingsBaselineModel1782000000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('adds savings_baseline_model column to agents table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain('ALTER TABLE "agents"');
      expect(sql).toContain('ADD COLUMN "savings_baseline_model"');
      expect(sql).toContain('varchar');
      expect(sql).toContain('DEFAULT NULL');
    });
  });

  describe('down', () => {
    it('drops savings_baseline_model column', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN "savings_baseline_model"'),
      );
    });
  });
});
