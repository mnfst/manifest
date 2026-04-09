import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpecificityAssignments1775200000000 implements MigrationInterface {
  name = 'AddSpecificityAssignments1775200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "specificity_assignments" (
        "id" varchar PRIMARY KEY,
        "user_id" varchar NOT NULL,
        "agent_id" varchar NOT NULL,
        "category" varchar NOT NULL,
        "is_active" boolean NOT NULL DEFAULT false,
        "override_model" varchar,
        "override_provider" varchar,
        "override_auth_type" varchar,
        "auto_assigned_model" varchar,
        "fallback_models" text,
        "updated_at" timestamp NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_specificity_assignments_agent_category"
        ON "specificity_assignments" ("agent_id", "category")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "specificity_assignments"`);
  }
}
