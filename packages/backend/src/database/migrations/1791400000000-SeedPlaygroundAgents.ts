import { MigrationInterface, QueryRunner } from 'typeorm';
import { PLAYGROUND_AGENT_NAME } from '../../common/constants/playground.constants';

export class SeedPlaygroundAgents1791400000000 implements MigrationInterface {
  name = 'SeedPlaygroundAgents1791400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Reserved-system flag on agents (hidden from list/switcher/counts).
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "is_system" boolean NOT NULL DEFAULT false`,
    );

    // 2. Free the reserved name: relabel any existing NON-system agent literally
    //    named 'Playground' (suffix with its id — never delete a user's agent) so
    //    the reserved per-tenant agent can take the name without colliding on the
    //    (tenant_id, name) unique index.
    await queryRunner.query(
      `UPDATE "agents" SET "name" = "name" || ' [' || "id" || ']'
       WHERE "name" = $1 AND "is_system" = false AND "deleted_at" IS NULL`,
      [PLAYGROUND_AGENT_NAME],
    );

    // 3. Create one reserved Playground agent per tenant that doesn't have one.
    //    Keyless by design — it backs the Playground and never ingests OTLP, so
    //    no agent_api_keys row is needed.
    await queryRunner.query(
      `INSERT INTO "agents" ("id", "name", "display_name", "is_system", "is_active", "tenant_id")
       SELECT gen_random_uuid()::text, $1, $1, true, true, t."id"
       FROM "tenants" t
       WHERE NOT EXISTS (
         SELECT 1 FROM "agents" a
         WHERE a."tenant_id" = t."id" AND a."is_system" = true AND a."deleted_at" IS NULL
       )`,
      [PLAYGROUND_AGENT_NAME],
    );

    // 4. Grant each Playground agent access to its tenant's whole provider pool
    //    (tenants.name = user_providers.user_id) so the Playground routes against
    //    every connected provider.
    await queryRunner.query(
      `INSERT INTO "agent_provider_access" ("agent_id", "user_provider_id")
       SELECT a."id", up."id"
       FROM "agents" a
       JOIN "tenants" t ON t."id" = a."tenant_id"
       JOIN "user_providers" up ON up."user_id" = t."name"
       WHERE a."is_system" = true AND a."deleted_at" IS NULL
       ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Grants cascade-delete with the agent rows (agent_provider_access FK is
    // ON DELETE CASCADE), so removing the system agents is enough.
    await queryRunner.query(`DELETE FROM "agents" WHERE "is_system" = true`);
    await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN IF EXISTS "is_system"`);
  }
}
