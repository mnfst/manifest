import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKeyPrefixIndex1773900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_api_keys_key_prefix" ON "agent_api_keys" ("key_prefix")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_api_keys_key_prefix" ON "api_keys" ("key_prefix")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_api_keys_key_prefix"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_api_keys_key_prefix"`);
  }
}
