import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenKeyHashColumn1774000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_api_keys" ALTER COLUMN "key_hash" TYPE varchar(128)`,
    );
    await queryRunner.query(`ALTER TABLE "api_keys" ALTER COLUMN "key_hash" TYPE varchar(128)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_api_keys" ALTER COLUMN "key_hash" TYPE varchar(64)`,
    );
    await queryRunner.query(`ALTER TABLE "api_keys" ALTER COLUMN "key_hash" TYPE varchar(64)`);
  }
}
