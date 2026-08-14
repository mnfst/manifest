import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandProviderUniqueKey1773000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old unique index on (agent_id, provider) — try all known name variants
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_provider"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_id_provider"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_6f1a1e6c8d2b3a4f5e7d9c0b1a"`);

    // Create new unique index on (agent_id, provider, auth_type)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_providers_agent_provider_auth" ` +
        `ON "user_providers" ("agent_id", "provider", "auth_type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_providers_agent_provider_auth"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_providers_agent_id_provider" ` +
        `ON "user_providers" ("agent_id", "provider")`,
    );
  }
}
