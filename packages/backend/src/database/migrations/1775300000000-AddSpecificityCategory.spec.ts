import { QueryRunner } from 'typeorm';
import { AddSpecificityCategory1775300000000 } from './1775300000000-AddSpecificityCategory';

describe('AddSpecificityCategory1775300000000', () => {
  let migration: AddSpecificityCategory1775300000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddSpecificityCategory1775300000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('should add specificity_category column to agent_messages', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('"specificity_category"'),
      );
    });
  });

  describe('down', () => {
    it('should drop specificity_category column', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN "specificity_category"'),
      );
    });
  });
});
