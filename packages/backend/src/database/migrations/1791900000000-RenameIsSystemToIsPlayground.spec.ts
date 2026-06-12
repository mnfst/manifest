import { QueryRunner } from 'typeorm';
import { RenameIsSystemToIsPlayground1791900000000 } from './1791900000000-RenameIsSystemToIsPlayground';

describe('RenameIsSystemToIsPlayground1791900000000', () => {
  let migration: RenameIsSystemToIsPlayground1791900000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new RenameIsSystemToIsPlayground1791900000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('renames is_system to is_playground when the old column exists', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain(`column_name = 'is_system'`);
      expect(sql).toContain('RENAME COLUMN "is_system" TO "is_playground"');
    });
  });

  describe('down', () => {
    it('renames is_playground back to is_system when the new column exists', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain(`column_name = 'is_playground'`);
      expect(sql).toContain('RENAME COLUMN "is_playground" TO "is_system"');
    });
  });
});
