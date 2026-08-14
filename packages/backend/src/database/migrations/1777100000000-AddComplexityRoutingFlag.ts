import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddComplexityRoutingFlag1777100000000 implements MigrationInterface {
  name = 'AddComplexityRoutingFlag1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN "complexity_routing_enabled" boolean NOT NULL DEFAULT false`,
    );

    // Backfill: existing agents keep complexity routing on so their current
    // setup keeps behaving the same. New agents default to off (column default).
    await queryRunner.query(`UPDATE "agents" SET "complexity_routing_enabled" = true`);

    // Seed a 'default' tier row for every agent, copying model + fallbacks from
    // the existing 'standard' tier. Agents without a standard row get a blank
    // default row so later CRUD/auto-assign can populate it.
    await queryRunner.query(`
      INSERT INTO "tier_assignments"
        ("id", "user_id", "agent_id", "tier", "override_model", "override_provider",
         "override_auth_type", "auto_assigned_model", "fallback_models", "updated_at")
      SELECT
        gen_random_uuid()::varchar,
        COALESCE(ta."user_id", ''),
        a."id",
        'default',
        ta."override_model",
        ta."override_provider",
        ta."override_auth_type",
        ta."auto_assigned_model",
        ta."fallback_models",
        NOW()
      FROM "agents" a
      LEFT JOIN "tier_assignments" ta
        ON ta."agent_id" = a."id" AND ta."tier" = 'standard'
      WHERE NOT EXISTS (
        SELECT 1 FROM "tier_assignments" d
        WHERE d."agent_id" = a."id" AND d."tier" = 'default'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "tier_assignments" WHERE "tier" = 'default'`);
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "complexity_routing_enabled"`);
  }
}
