import { QueryRunner } from 'typeorm';
import { AddBaselineCostColumns1782100000000 } from './1782100000000-AddBaselineCostColumns';

describe('AddBaselineCostColumns1782100000000', () => {
  let migration: AddBaselineCostColumns1782100000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddBaselineCostColumns1782100000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('adds baseline_model_id and baseline_cost_usd columns', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(2);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('"baseline_model_id"'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('"baseline_cost_usd"'),
      );
    });
  });

  describe('down', () => {
    it('drops both columns', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(2);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN "baseline_cost_usd"'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN "baseline_model_id"'),
      );
    });
  });
});
