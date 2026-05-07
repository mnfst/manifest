import { AddHeaderTierParamDefaults1787000000000 } from './1787000000000-AddHeaderTierParamDefaults';

describe('AddHeaderTierParamDefaults1787000000000', () => {
  let migration: AddHeaderTierParamDefaults1787000000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AddHeaderTierParamDefaults1787000000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('up adds a nullable jsonb param_defaults column on header_tiers', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.up(queryRunner as any);
    expect(queryRunner.query).toHaveBeenCalledWith(
      `ALTER TABLE "header_tiers" ADD COLUMN IF NOT EXISTS "param_defaults" jsonb DEFAULT NULL`,
    );
  });

  it('down drops the column', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.down(queryRunner as any);
    expect(queryRunner.query).toHaveBeenCalledWith(
      `ALTER TABLE "header_tiers" DROP COLUMN IF EXISTS "param_defaults"`,
    );
  });
});
