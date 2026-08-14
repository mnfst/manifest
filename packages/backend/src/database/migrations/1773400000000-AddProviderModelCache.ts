import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderModelCache1773400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_providers" ADD COLUMN "cached_models" text`);
    await queryRunner.query(
      `ALTER TABLE "user_providers" ADD COLUMN "models_fetched_at" timestamp`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_providers" DROP COLUMN "models_fetched_at"`);
    await queryRunner.query(`ALTER TABLE "user_providers" DROP COLUMN "cached_models"`);
  }
}
