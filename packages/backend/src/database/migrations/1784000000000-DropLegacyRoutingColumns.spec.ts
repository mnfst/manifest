import { DropLegacyRoutingColumns1784000000000 } from './1784000000000-DropLegacyRoutingColumns';

describe('DropLegacyRoutingColumns1784000000000', () => {
  let migration: DropLegacyRoutingColumns1784000000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new DropLegacyRoutingColumns1784000000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up', () => {
    it('drops every legacy column on tier_assignments, specificity_assignments, header_tiers', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await migration.up(queryRunner as any);
      const sql = queryRunner.query.mock.calls.map((c) => c[0] as string).join('\n');
      // tier + specificity drops
      for (const table of ['tier_assignments', 'specificity_assignments', 'header_tiers']) {
        for (const col of [
          'override_model',
          'override_provider',
          'override_auth_type',
          'fallback_models',
        ]) {
          expect(sql).toContain(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${col}"`);
        }
      }
      // auto_assigned_model only on tier + specificity
      for (const table of ['tier_assignments', 'specificity_assignments']) {
        expect(sql).toContain(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "auto_assigned_model"`);
      }
      // never on header_tiers
      expect(sql).not.toContain(
        `ALTER TABLE "header_tiers" DROP COLUMN IF EXISTS "auto_assigned_model"`,
      );
    });
  });

  describe('down', () => {
    it('re-adds every legacy column with IF NOT EXISTS so re-runs are safe', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await migration.down(queryRunner as any);
      const sql = queryRunner.query.mock.calls.map((c) => c[0] as string).join('\n');
      for (const table of ['tier_assignments', 'specificity_assignments', 'header_tiers']) {
        for (const col of [
          'override_model',
          'override_provider',
          'override_auth_type',
          'fallback_models',
        ]) {
          expect(sql).toContain(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}"`);
        }
      }
      for (const table of ['tier_assignments', 'specificity_assignments']) {
        expect(sql).toContain(
          `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "auto_assigned_model"`,
        );
      }
    });
  });
});
