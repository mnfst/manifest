import { QueryRunner } from 'typeorm';

import { AddBackfillStateTable1792800000000 } from './1792800000000-AddBackfillStateTable';

describe('AddBackfillStateTable1792800000000', () => {
  const migration = new AddBackfillStateTable1792800000000();
  let queries: string[];
  let queryRunner: QueryRunner;

  beforeEach(() => {
    queries = [];
    queryRunner = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
      }),
    } as unknown as QueryRunner;
  });

  it('creates the backfill_state marker table, keyed by name', async () => {
    await migration.up(queryRunner);
    expect(queries[0]).toContain('CREATE TABLE IF NOT EXISTS "backfill_state"');
    expect(queries[0]).toContain('PRIMARY KEY ("name")');
  });

  it('drops the table on down', async () => {
    await migration.down(queryRunner);
    expect(queries[0]).toContain('DROP TABLE IF EXISTS "backfill_state"');
  });
});
