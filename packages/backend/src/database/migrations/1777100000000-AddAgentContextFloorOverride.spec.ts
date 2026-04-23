import { QueryRunner } from 'typeorm';
import { AddAgentContextFloorOverride1777100000000 } from './1777100000000-AddAgentContextFloorOverride';

describe('AddAgentContextFloorOverride1777100000000', () => {
  let migration: AddAgentContextFloorOverride1777100000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddAgentContextFloorOverride1777100000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('adds context_floor_override column to agents', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('"context_floor_override"'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('"agents"'));
    });
  });

  describe('down', () => {
    it('drops context_floor_override column', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN "context_floor_override"'),
      );
    });
  });
});
