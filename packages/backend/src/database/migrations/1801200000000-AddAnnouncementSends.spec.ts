import { QueryRunner } from 'typeorm';
import { AddAnnouncementSends1801200000000 } from './1801200000000-AddAnnouncementSends';

describe('AddAnnouncementSends1801200000000', () => {
  let migration: AddAnnouncementSends1801200000000;
  let queryRunner: jest.Mocked<Pick<QueryRunner, 'query'>>;

  beforeEach(() => {
    migration = new AddAnnouncementSends1801200000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('creates the announcement send ledger with a composite primary key', async () => {
    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS "announcement_sends"'),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'CONSTRAINT "PK_announcement_sends" PRIMARY KEY ("announcement", "email")',
      ),
    );
  });

  it('drops the announcement send ledger', async () => {
    await migration.down(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS "announcement_sends"');
  });

  it('exposes a stable migration name', () => {
    expect(migration.name).toBe('AddAnnouncementSends1801200000000');
  });
});
