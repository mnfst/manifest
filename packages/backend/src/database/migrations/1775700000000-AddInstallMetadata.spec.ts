import { QueryRunner } from 'typeorm';
import { AddInstallMetadata1775700000000 } from './1775700000000-AddInstallMetadata';

describe('AddInstallMetadata1775700000000', () => {
  let migration: AddInstallMetadata1775700000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddInstallMetadata1775700000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('creates the install_metadata table', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain('CREATE TABLE "install_metadata"');
      expect(sql).toContain('"id" varchar NOT NULL');
      expect(sql).toContain('"install_id" varchar NOT NULL');
      expect(sql).toContain('"first_send_at" timestamp');
      expect(sql).toContain('"last_sent_at" timestamp');
      expect(sql).toContain('PRIMARY KEY ("id")');
    });
  });

  describe('down', () => {
    it('drops the install_metadata table', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      const sql = queryRunner.query.mock.calls[0][0] as string;
      expect(sql).toContain('DROP TABLE "install_metadata"');
    });
  });

  it('exposes a stable migration name', () => {
    expect(migration.name).toBe('AddInstallMetadata1775700000000');
  });
});
