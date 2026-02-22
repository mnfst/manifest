import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoutingTables1771700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = async (name: string) => {
      const rows = await queryRunner.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [name],
      );
      return rows.length > 0;
    };

    if (!(await tableExists('user_providers'))) {
      await queryRunner.query(`
        CREATE TABLE "user_providers" (
          "id" varchar PRIMARY KEY,
          "user_id" varchar NOT NULL,
          "provider" varchar NOT NULL,
          "api_key_encrypted" varchar NOT NULL,
          "is_active" boolean NOT NULL DEFAULT true,
          "connected_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW()
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_user_providers_user_provider"
          ON "user_providers" ("user_id", "provider")
      `);
    }

    if (!(await tableExists('tier_assignments'))) {
      await queryRunner.query(`
        CREATE TABLE "tier_assignments" (
          "id" varchar PRIMARY KEY,
          "user_id" varchar NOT NULL,
          "tier" varchar NOT NULL,
          "override_model" varchar,
          "auto_assigned_model" varchar,
          "updated_at" timestamp NOT NULL DEFAULT NOW()
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_tier_assignments_user_tier"
          ON "tier_assignments" ("user_id", "tier")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tier_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_providers"`);
  }
}
