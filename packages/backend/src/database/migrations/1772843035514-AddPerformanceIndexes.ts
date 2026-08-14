import { MigrationInterface, QueryRunner } from 'typeorm';
import { decrypt, getEncryptionSecret } from '../../common/utils/crypto.util';

export class AddPerformanceIndexes1772843035514 implements MigrationInterface {
  name = 'AddPerformanceIndexes1772843035514';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // agent_messages indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_messages_user_id_timestamp" ON "agent_messages" ("user_id", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_messages_tenant_agent_name_ts" ON "agent_messages" ("tenant_id", "agent_name", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_messages_timestamp" ON "agent_messages" ("timestamp")`,
    );

    // security_event index
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_security_event_user_id_timestamp" ON "security_event" ("user_id", "timestamp")`,
    );

    // cost_snapshots index
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cost_snapshots_tenant_agent_time" ON "cost_snapshots" ("tenant_id", "agent_id", "snapshot_time")`,
    );

    // Add key_prefix column to user_providers
    await queryRunner.query(
      `ALTER TABLE "user_providers" ADD COLUMN "key_prefix" varchar DEFAULT NULL`,
    );

    // Backfill key_prefix from encrypted keys
    await this.backfillKeyPrefix(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_providers" DROP COLUMN "key_prefix"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cost_snapshots_tenant_agent_time"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_security_event_user_id_timestamp"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_messages_timestamp"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_messages_tenant_agent_name_ts"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_messages_user_id_timestamp"`);
  }

  private async backfillKeyPrefix(queryRunner: QueryRunner): Promise<void> {
    const log = queryRunner.connection.logger;
    let secret: string;
    try {
      secret = getEncryptionSecret();
    } catch {
      log.log(
        'warn',
        'AddPerformanceIndexes: No encryption secret found. Skipping key_prefix backfill.',
      );
      return;
    }

    const rows: { id: string; api_key_encrypted: string }[] = await queryRunner.query(
      `SELECT id, api_key_encrypted FROM "user_providers" WHERE api_key_encrypted IS NOT NULL AND api_key_encrypted != ''`,
    );

    let backfilled = 0;
    for (const row of rows) {
      let prefix: string;
      try {
        const plaintext = decrypt(row.api_key_encrypted, secret);
        prefix = plaintext.substring(0, 8);
      } catch {
        continue; // Skip rows that can't be decrypted
      }
      await queryRunner.query(`UPDATE "user_providers" SET key_prefix = $1 WHERE id = $2`, [
        prefix,
        row.id,
      ]);
      backfilled++;
    }

    if (backfilled > 0) {
      log.log(
        'info',
        `AddPerformanceIndexes: Backfilled key_prefix for ${backfilled} provider(s).`,
      );
    }
  }
}
