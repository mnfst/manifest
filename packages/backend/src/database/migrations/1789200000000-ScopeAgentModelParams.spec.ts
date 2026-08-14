import { ScopeAgentModelParams1789200000000 } from './1789200000000-ScopeAgentModelParams';

describe('ScopeAgentModelParams1789200000000', () => {
  let migration: ScopeAgentModelParams1789200000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new ScopeAgentModelParams1789200000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('guards fallback route expansion before calling jsonb_array_elements', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).toContain("WHEN jsonb_typeof(rs.fallback_routes) = 'array'");
    expect(sql).toContain("ELSE '[]'::jsonb");
  });
});
