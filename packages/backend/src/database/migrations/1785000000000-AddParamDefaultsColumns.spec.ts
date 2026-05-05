import { AddParamDefaultsColumns1785000000000 } from './1785000000000-AddParamDefaultsColumns';

describe('AddParamDefaultsColumns1785000000000', () => {
  let migration: AddParamDefaultsColumns1785000000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AddParamDefaultsColumns1785000000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('up adds a nullable jsonb param_defaults column on both assignment tables', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.up(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map((c) => c[0] as string).join('\n');
    for (const table of ['tier_assignments', 'specificity_assignments']) {
      expect(sql).toContain(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "param_defaults" jsonb DEFAULT NULL`,
      );
    }
  });

  it('down drops the column on both tables', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.down(queryRunner as any);
    const sql = queryRunner.query.mock.calls.map((c) => c[0] as string).join('\n');
    for (const table of ['tier_assignments', 'specificity_assignments']) {
      expect(sql).toContain(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "param_defaults"`);
    }
  });
});
