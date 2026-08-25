import { AddHeaderTierModelAliases1802100000000 } from './1802100000000-AddHeaderTierModelAliases';

describe('AddHeaderTierModelAliases1802100000000', () => {
  const migration = new AddHeaderTierModelAliases1802100000000();
  const queryRunner = { query: jest.fn().mockResolvedValue(undefined) } as never;

  beforeEach(() => jest.clearAllMocks());

  it('adds a constrained, agent-scoped model alias', async () => {
    await migration.up(queryRunner);

    const queries = (queryRunner as { query: jest.Mock }).query.mock.calls.map(([sql]) => sql);
    expect(queries[0]).toContain('ADD COLUMN "model_alias" varchar(48) DEFAULT NULL');
    expect(queries[1]).toContain('"model_alias" <> \'auto\'');
    expect(queries[1]).toContain("'^[a-z0-9]+(-[a-z0-9]+)*$'");
    expect(queries[2]).toContain('CREATE UNIQUE INDEX "IDX_header_tiers_agent_model_alias"');
    expect(queries[2]).toContain('("agent_id", "model_alias")');
    expect(queries[2]).toContain('WHERE "model_alias" IS NOT NULL');
  });

  it('removes the index, constraint, and column on rollback', async () => {
    await migration.down(queryRunner);

    const queries = (queryRunner as { query: jest.Mock }).query.mock.calls.map(([sql]) => sql);
    expect(queries[0]).toContain('DROP INDEX IF EXISTS "IDX_header_tiers_agent_model_alias"');
    expect(queries[1]).toContain('DROP CONSTRAINT IF EXISTS "CHK_header_tiers_model_alias"');
    expect(queries[2]).toContain('DROP COLUMN "model_alias"');
  });
});
