import { QueryRunner } from 'typeorm';
import { DropSavingsBaselineColumns1791700000000 } from './1791700000000-DropSavingsBaselineColumns';

describe('DropSavingsBaselineColumns1791700000000', () => {
  let migration: DropSavingsBaselineColumns1791700000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new DropSavingsBaselineColumns1791700000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('drops the savings/baseline columns if they exist', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(3);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN IF EXISTS "savings_baseline_model"'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN IF EXISTS "baseline_cost_usd"'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN IF EXISTS "baseline_model_id"'),
      );
    });
  });

  describe('down', () => {
    it('re-adds the dropped columns', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(3);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('ADD COLUMN IF NOT EXISTS "savings_baseline_model"'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('ADD COLUMN IF NOT EXISTS "baseline_model_id"'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('ADD COLUMN IF NOT EXISTS "baseline_cost_usd"'),
      );
    });
  });
});
