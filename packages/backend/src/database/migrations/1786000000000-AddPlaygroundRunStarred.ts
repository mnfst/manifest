import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlaygroundRunStarred1786000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "playground_runs" ADD COLUMN "starred" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "playground_runs" DROP COLUMN "starred"`);
  }
}
