import { QueryRunner } from 'typeorm';
import { AddSpecificityAssignments1775200000000 } from './1775200000000-AddSpecificityAssignments';

describe('AddSpecificityAssignments1775200000000', () => {
  let migration: AddSpecificityAssignments1775200000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddSpecificityAssignments1775200000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('should create the specificity_assignments table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(2);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE "specificity_assignments"'),
      );
    });

    it('should create unique index on agent_id and category', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('IDX_specificity_assignments_agent_category'),
      );
    });
  });

  describe('down', () => {
    it('should drop the specificity_assignments table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP TABLE IF EXISTS "specificity_assignments"'),
      );
    });
  });
});
