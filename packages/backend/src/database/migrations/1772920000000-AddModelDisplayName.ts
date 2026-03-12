import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModelDisplayName1772920000000 implements MigrationInterface {
  name = 'AddModelDisplayName1772920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "model_pricing" ADD COLUMN "display_name" varchar DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "model_pricing" DROP COLUMN "display_name"`);
  }
}
