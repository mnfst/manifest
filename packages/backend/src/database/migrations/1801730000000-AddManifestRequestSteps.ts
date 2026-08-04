import { MigrationInterface, QueryRunner } from 'typeorm';

/** Retain Manifest-authored routing failures without creating fake Provider Attempts. */
export class AddManifestRequestSteps1801730000000 implements MigrationInterface {
  name = 'AddManifestRequestSteps1801730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.withBoundedLockWait(queryRunner, async () => {
      await queryRunner.query(`
        ALTER TABLE "requests"
          ADD COLUMN IF NOT EXISTS "manifest_steps" jsonb NOT NULL DEFAULT '[]'::jsonb
      `);
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.withBoundedLockWait(queryRunner, async () => {
      await queryRunner.query(`
        ALTER TABLE "requests"
          DROP COLUMN IF EXISTS "manifest_steps"
      `);
    });
  }

  private async withBoundedLockWait(
    queryRunner: QueryRunner,
    change: () => Promise<void>,
  ): Promise<void> {
    if (queryRunner.isTransactionActive) {
      await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
      await change();
      return;
    }

    await queryRunner.query(`SET lock_timeout = '5s'`);
    try {
      await change();
    } finally {
      await queryRunner.query(`RESET lock_timeout`);
    }
  }
}
