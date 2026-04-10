import { QueryRunner } from 'typeorm';
import { AddCallerAttribution1775400000000 } from './1775400000000-AddCallerAttribution';

describe('AddCallerAttribution1775400000000', () => {
  let migration: AddCallerAttribution1775400000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddCallerAttribution1775400000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('adds caller_attribution column to agent_messages', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('"caller_attribution"'),
      );
    });
  });

  describe('down', () => {
    it('drops caller_attribution column', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN "caller_attribution"'),
      );
    });
  });
});
