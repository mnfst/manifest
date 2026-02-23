import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModelPricingImprovements1771600000000
  implements MigrationInterface
{
  name = 'ModelPricingImprovements1771600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createModelPricingHistoryTable(queryRunner);
    await this.createUnresolvedModelsTable(queryRunner);
    await this.convertUpdatedAtToTimestamp(queryRunner);
  }

  private async createModelPricingHistoryTable(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "model_pricing_history" (
        "id" character varying NOT NULL,
        "model_name" character varying NOT NULL,
        "input_price_per_token" numeric(12,10) NOT NULL,
        "output_price_per_token" numeric(12,10) NOT NULL,
        "provider" character varying NOT NULL DEFAULT '',
        "effective_from" TIMESTAMP NOT NULL,
        "effective_until" TIMESTAMP,
        "change_source" character varying NOT NULL DEFAULT 'sync',
        CONSTRAINT "PK_model_pricing_history" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_mph_model_name" ON "model_pricing_history" ("model_name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mph_model_effective" ON "model_pricing_history" ("model_name", "effective_from")`,
    );
  }

  private async createUnresolvedModelsTable(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "unresolved_models" (
        "model_name" character varying NOT NULL,
        "first_seen" TIMESTAMP NOT NULL,
        "last_seen" TIMESTAMP NOT NULL,
        "occurrence_count" integer NOT NULL DEFAULT 1,
        "resolved" boolean NOT NULL DEFAULT false,
        "resolved_to" character varying,
        "resolved_at" TIMESTAMP,
        CONSTRAINT "PK_unresolved_models" PRIMARY KEY ("model_name")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_unresolved_resolved" ON "unresolved_models" ("resolved")`,
    );
  }

  private async convertUpdatedAtToTimestamp(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "model_pricing"
      ALTER COLUMN "updated_at" TYPE TIMESTAMP
      USING "updated_at"::timestamp
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "model_pricing" ALTER COLUMN "updated_at" TYPE character varying`,
    );
    await queryRunner.query(`DROP INDEX "IDX_unresolved_resolved"`);
    await queryRunner.query(`DROP TABLE "unresolved_models"`);
    await queryRunner.query(`DROP INDEX "IDX_mph_model_effective"`);
    await queryRunner.query(`DROP INDEX "IDX_mph_model_name"`);
    await queryRunner.query(`DROP TABLE "model_pricing_history"`);
  }
}
