import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames agent_provider_access → agent_enabled_providers, aligning the table
 * with the "enabled providers" vocabulary used everywhere else (UI toggles,
 * `{ enabled: [...] }` API responses, enable/disable endpoints). A pure rename:
 * RENAME TO keeps all rows, constraints, and indexes attached, so the
 * follow-up statements only rename the constraint/index identifiers for
 * consistency. No data is touched.
 */
export class RenameProviderAccessToEnabledProviders1791800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_provider_access" RENAME TO "agent_enabled_providers"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_enabled_providers" RENAME CONSTRAINT "PK_agent_provider_access" TO "PK_agent_enabled_providers"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_enabled_providers" RENAME CONSTRAINT "FK_agent_provider_access_agent" TO "FK_agent_enabled_providers_agent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_enabled_providers" RENAME CONSTRAINT "FK_agent_provider_access_provider" TO "FK_agent_enabled_providers_provider"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_agent_provider_access_provider" RENAME TO "IDX_agent_enabled_providers_provider"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER INDEX "IDX_agent_enabled_providers_provider" RENAME TO "IDX_agent_provider_access_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_enabled_providers" RENAME CONSTRAINT "FK_agent_enabled_providers_provider" TO "FK_agent_provider_access_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_enabled_providers" RENAME CONSTRAINT "FK_agent_enabled_providers_agent" TO "FK_agent_provider_access_agent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_enabled_providers" RENAME CONSTRAINT "PK_agent_enabled_providers" TO "PK_agent_provider_access"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_enabled_providers" RENAME TO "agent_provider_access"`,
    );
  }
}
