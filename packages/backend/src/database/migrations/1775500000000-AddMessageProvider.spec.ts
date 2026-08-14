import { QueryRunner } from 'typeorm';
import { AddMessageProvider1775500000000 } from './1775500000000-AddMessageProvider';

describe('AddMessageProvider1775500000000', () => {
  let migration: AddMessageProvider1775500000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddMessageProvider1775500000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('should add provider column to agent_messages', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('"provider"'));
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE "agent_messages"'),
      );
      expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN'));
    });

    it('should create a nullable varchar column', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain('varchar');
      expect(sql).toContain('DEFAULT NULL');
    });
  });

  describe('down', () => {
    it('should drop the provider column', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP COLUMN "provider"'),
      );
    });
  });

  it('exposes a stable migration name', () => {
    expect(migration.name).toBe('AddMessageProvider1775500000000');
  });
});
