import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Attribute each message to the exact connection (user_providers row) that
 * served it. Until now per-connection analytics scoped by the
 * (tenant, provider, auth_type, label) tuple, which is not unique per key
 * (the default label is 'Default' and a NULL label coerces to it), so a newly
 * added key showed a sibling key's usage. We add a nullable `user_provider_id`
 * stamped at proxy time and filter per-connection views on it instead.
 *
 * This migration does ONLY metadata-only / structural work that is safe inside
 * the single boot transaction: add the nullable column, add the FK (trivially
 * valid — every row is NULL at this point), and build the covering index. The
 * index must exist here because a later migration (TenantProviders) renames it
 * along with the column and FK; it cannot be deferred out-of-band.
 *
 * The historical backfill of `user_provider_id` is NOT done here. On a
 * multi-million-row `agent_messages` table it stamps most rows, and inside the
 * boot transaction it held an ACCESS EXCLUSIVE lock for 12–30+ minutes,
 * locking the live app out of its main table for the whole deploy. It now runs
 * post-deploy, batched and throttled, against the FINAL (post-rename) schema —
 * see packages/backend/src/database/backfills/backfill-message-providers.ts and
 * `npm run backfill:message-providers`. New messages are stamped at proxy time,
 * so only pre-upgrade history relies on the backfill.
 */
export class AddUserProviderIdToAgentMessages1792000000000 implements MigrationInterface {
  name = 'AddUserProviderIdToAgentMessages1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nullable add → metadata-only, no table rewrite even on a large table.
    await queryRunner.query(
      `ALTER TABLE "agent_messages" ADD COLUMN IF NOT EXISTS "user_provider_id" varchar`,
    );

    // ON DELETE SET NULL, not CASCADE: disconnecting a provider must never
    // delete its billing/usage history. The column is entirely NULL here, so
    // validation is instant — no scan of agent_messages.
    await queryRunner.query(`
      ALTER TABLE "agent_messages"
      ADD CONSTRAINT "FK_agent_messages_user_provider"
      FOREIGN KEY ("user_provider_id") REFERENCES "user_providers"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // user_provider_id leads so this one index serves both the connection-detail
    // reads (WHERE user_provider_id = X AND tenant_id = Y ORDER BY timestamp DESC)
    // and the FK's ON DELETE SET NULL lookup (WHERE user_provider_id = X). Built
    // here against an all-NULL column (cheap) before the post-deploy backfill
    // populates it; TenantProviders later renames it to IDX_agent_messages_tenant_provider.
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
