import { QueryRunner } from 'typeorm';
import { DropSecurityEventTable1773700000000 } from './1773700000000-DropSecurityEventTable';

describe('DropSecurityEventTable1773700000000', () => {
  let migration: DropSecurityEventTable1773700000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new DropSecurityEventTable1773700000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('should drop the security_event table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP TABLE IF EXISTS "security_event"'),
      );
    });
  });

  describe('down', () => {
    it('should recreate the security_event table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(2);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE "security_event"'),
      );
    });

    it('should recreate the user_id/timestamp index', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('CREATE INDEX'));
    });
  });
});
