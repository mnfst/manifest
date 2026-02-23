import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExtraCapabilities1771900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "model_pricing" ADD COLUMN "capability_vision" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "model_pricing" ADD COLUMN "capability_tool_calling" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "model_pricing" ADD COLUMN "capability_structured_output" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "model_pricing" DROP COLUMN "capability_structured_output"`,
    );
    await queryRunner.query(
      `ALTER TABLE "model_pricing" DROP COLUMN "capability_tool_calling"`,
    );
    await queryRunner.query(
      `ALTER TABLE "model_pricing" DROP COLUMN "capability_vision"`,
    );
  }
}
