import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Attribute each message to the exact connection (user_providers row) that
 * served it. Until now per-connection analytics scoped by the
 * (tenant, provider, auth_type, label) tuple, which is not unique per key
 * (the default label is 'Default' and a NULL label coerces to it), so a newly
 * added key showed a sibling key's usage. We add a nullable `user_provider_id`
 * stamped at proxy time and filter per-connection views on it instead.
 *
 * The whole migration runs inside the single boot transaction
 * (migrationsTransactionMode: 'all'), so CREATE INDEX CONCURRENTLY is not
 * usable here — a plain index build briefly locks `agent_messages` writes.
 * Fine at current scale; large self-hosted installs should expect a short
 * write stall the first time this migration runs.
 */
export class AddUserProviderIdToAgentMessages1791900000000 implements MigrationInterface {
  name = 'AddUserProviderIdToAgentMessages1791900000000';

  private readonly logger = new Logger(AddUserProviderIdToAgentMessages1791900000000.name);

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nullable add → metadata-only, no table rewrite even on a large table.
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN IF NOT EXISTS "user_provider_id" varchar`,
    );

    // Best-effort backfill of pre-upgrade history: stamp a message only when
    // exactly ONE active key matches its (provider, auth_type, label) tuple for
    // the owning user. The user is reached via tenants.name = user_providers.user_id
    // (tenant.name holds the user id). Where 0 or >1 keys match, leave NULL —
    // ambiguous history correctly stays out of every per-connection view.
    await queryRunner.query(`
      UPDATE "agent_messages" am
      SET "user_provider_id" = m.up_id
      FROM (
        SELECT am2.id AS msg_id, MIN(up.id) AS up_id
        FROM "agent_messages" am2
        JOIN "tenants" t ON t.id = am2.tenant_id
        JOIN "user_providers" up
          ON up.user_id = t.name
         AND LOWER(up.provider) = LOWER(am2.provider)
         AND up.auth_type = am2.auth_type
         AND LOWER(up.label) = LOWER(COALESCE(am2.provider_key_label, 'Default'))
        WHERE am2.user_provider_id IS NULL
          AND am2.provider IS NOT NULL
        GROUP BY am2.id
        HAVING COUNT(*) = 1
      ) m
      WHERE am.id = m.msg_id
    `);

    // Surface the backfill outcome so operators can see the pre-upgrade history
    // gap. Everything still NULL is ambiguous, local/Ollama, blind-proxy, or
    // simply had no matching connection — all expected.
    const [{ matched, remaining }] = (await queryRunner.query(`
      SELECT
        COUNT(*) FILTER (WHERE user_provider_id IS NOT NULL)::int AS matched,
        COUNT(*) FILTER (WHERE user_provider_id IS NULL)::int AS remaining
      FROM "agent_messages"
    `)) as { matched: number; remaining: number }[];
    this.logger.log(
      `Backfilled user_provider_id on ${matched} message(s); ${remaining} left NULL ` +
        `(ambiguous, local/Ollama, or no matching connection).`,
    );

    // ON DELETE SET NULL, not CASCADE: disconnecting a provider must never
    // delete its billing/usage history. Disconnect is a soft delete today
    // (is_active = false), so this fires only on a true hard delete such as an
    // account purge — and then the rows survive with a NULL connection.
    await queryRunner.query(`
      ALTER TABLE "agent_messages"
      ADD CONSTRAINT "FK_agent_messages_user_provider"
      FOREIGN KEY ("user_provider_id") REFERENCES "user_providers"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // user_provider_id leads so this one index serves both the connection-detail
    // reads (WHERE user_provider_id = X AND tenant_id = Y ORDER BY timestamp DESC)
    // and the FK's ON DELETE SET NULL lookup (WHERE user_provider_id = X). An
    // index leading with tenant_id would leave the parent-delete cleanup to a
    // sequential scan of agent_messages.
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_messages_user_provider" ON "agent_messages" ("user_provider_id", "tenant_id", "timestamp" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_messages_user_provider"`);
    await queryRunner.query(
      `ALTER TABLE "agent_messages" DROP CONSTRAINT IF EXISTS "FK_agent_messages_user_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_messages" DROP COLUMN IF EXISTS "user_provider_id"`,
    );
  }
}
