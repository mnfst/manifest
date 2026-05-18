import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlaygroundRunBestColumn1787000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "playground_runs" ADD COLUMN "best_column_id" varchar`);
    // The user's "best answer" pick is a reinforcement-learning signal, so it
    // must reference a real column of this run. SET NULL (not CASCADE) keeps the
    // run row alive if the chosen column is ever removed.
    await queryRunner.query(
      `ALTER TABLE "playground_runs" ADD CONSTRAINT "FK_playground_runs_best_column" ` +
        `FOREIGN KEY ("best_column_id") REFERENCES "playground_columns"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "playground_runs" DROP CONSTRAINT IF EXISTS "FK_playground_runs_best_column"`,
    );
    await queryRunner.query(`ALTER TABLE "playground_runs" DROP COLUMN IF EXISTS "best_column_id"`);
  }
}
