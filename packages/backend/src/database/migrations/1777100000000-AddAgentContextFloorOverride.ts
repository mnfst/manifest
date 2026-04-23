import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a per-agent override for the context window advertised by
 * GET /v1/models. When NULL, the proxy computes the honest floor from the
 * agent's currently-routed models. Users with unusual setups (pinned tiers,
 * known client quirks) can override it from the Settings page — see
 * discussions #1450, #1612 and issue #1617.
 */
export class AddAgentContextFloorOverride1777100000000 implements MigrationInterface {
  name = 'AddAgentContextFloorOverride1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" ADD COLUMN "context_floor_override" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "context_floor_override"`);
  }
}
