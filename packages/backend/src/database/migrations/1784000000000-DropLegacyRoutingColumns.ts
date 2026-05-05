import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the legacy routing identity columns from tier_assignments,
 * specificity_assignments, and header_tiers. The structured route columns
 * (override_route, auto_assigned_route, fallback_routes) added in
 * 1783000000000-AddModelRouteColumns are now the sole source of truth.
 *
 * Pre-conditions for running this migration:
 *   1. AddModelRouteColumns has been live for at least one full release
 *      cycle so every active row has been touched and the route columns are
 *      populated where the legacy triple was.
 *   2. The dual-write code paths in TierService / SpecificityService /
 *      HeaderTierService and the legacy-fallback reads in route-helpers.ts
 *      have been removed in the same release as this migration. Otherwise
 *      reads will return null routes for backfilled-but-not-yet-touched rows.
 *   3. Operators have been notified that any third-party integration relying
 *      on the legacy fields in /api/v1/routing/resolve must switch to the
 *      `route` / `fallback_routes` shape (the deprecation header was set
 *      one release prior).
 *
 * Down() is intentionally lossy — it re-adds the columns as null. The legacy
 * data is gone after this runs forward; rollback is best-effort.
 */
export class DropLegacyRoutingColumns1784000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['tier_assignments', 'specificity_assignments', 'header_tiers']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "override_model"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "override_provider"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "override_auth_type"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "fallback_models"`);
    }
    for (const table of ['tier_assignments', 'specificity_assignments']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "auto_assigned_model"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['tier_assignments', 'specificity_assignments']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "auto_assigned_model" varchar DEFAULT NULL`,
      );
    }
    for (const table of ['tier_assignments', 'specificity_assignments', 'header_tiers']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "fallback_models" text DEFAULT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "override_auth_type" varchar DEFAULT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "override_provider" varchar DEFAULT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "override_model" varchar DEFAULT NULL`,
      );
    }
  }
}
