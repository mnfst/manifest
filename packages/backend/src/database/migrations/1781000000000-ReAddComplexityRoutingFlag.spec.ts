import { ReAddComplexityRoutingFlag1781000000000 } from './1781000000000-ReAddComplexityRoutingFlag';

describe('ReAddComplexityRoutingFlag1781000000000', () => {
  const migration = new ReAddComplexityRoutingFlag1781000000000();
  const queries: string[] = [];
  const queryRunner = { query: jest.fn(async (sql: string) => queries.push(sql)) } as never;

  beforeEach(() => {
    queries.length = 0;
    (queryRunner as { query: jest.Mock }).query.mockClear();
  });

  it('up adds the column with DEFAULT true then alters to DEFAULT false', async () => {
    await migration.up(queryRunner);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain('ADD COLUMN');
    expect(queries[0]).toContain('DEFAULT true');
    expect(queries[1]).toContain('SET DEFAULT false');
  });

  it('down drops the column', async () => {
    await migration.down(queryRunner);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('DROP COLUMN');
  });
});
