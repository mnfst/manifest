import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropModelPricingTables1773500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "model_pricing_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "unresolved_models"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "model_pricing"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "model_pricing" (
        "model_name" varchar PRIMARY KEY,
        "input_price_per_token" decimal(12,10),
        "output_price_per_token" decimal(12,10),
        "provider" varchar DEFAULT '',
        "updated_at" timestamp,
        "context_window" integer DEFAULT 128000,
        "capability_reasoning" boolean DEFAULT false,
        "capability_code" boolean DEFAULT false,
        "quality_score" integer DEFAULT 3,
        "display_name" varchar DEFAULT ''
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "model_pricing_history" (
        "id" varchar PRIMARY KEY,
        "model_name" varchar NOT NULL,
        "input_price_per_token" decimal(12,10) NOT NULL,
        "output_price_per_token" decimal(12,10) NOT NULL,
        "provider" varchar DEFAULT '',
        "effective_from" timestamp NOT NULL,
        "effective_until" timestamp,
        "change_source" varchar DEFAULT 'sync'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "unresolved_models" (
        "model_name" varchar PRIMARY KEY,
        "first_seen" timestamp NOT NULL,
        "last_seen" timestamp NOT NULL,
        "occurrence_count" integer DEFAULT 1,
        "resolved" boolean DEFAULT false,
        "resolved_to" varchar,
        "resolved_at" timestamp
      )
    `);
  }
}
