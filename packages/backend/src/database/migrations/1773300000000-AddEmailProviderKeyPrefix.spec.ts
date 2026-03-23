import { QueryRunner } from 'typeorm';
import { AddEmailProviderKeyPrefix1773300000000 } from './1773300000000-AddEmailProviderKeyPrefix';

describe('AddEmailProviderKeyPrefix1773300000000', () => {
  let migration: AddEmailProviderKeyPrefix1773300000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddEmailProviderKeyPrefix1773300000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('should add key_prefix column', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('key_prefix'));
    });

    it('should use ALTER TABLE ADD COLUMN', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query.mock.calls[0][0]).toMatch(/ALTER TABLE/);
      expect(queryRunner.query.mock.calls[0][0]).toMatch(/ADD COLUMN/);
    });
  });

  describe('down', () => {
    it('should drop key_prefix column', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('key_prefix'));
    });

    it('should use ALTER TABLE DROP COLUMN', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query.mock.calls[0][0]).toMatch(/DROP COLUMN/);
    });
  });
});
