import { MigrationInterface, QueryRunner } from 'typeorm';
import { createHash } from 'crypto';

export class HashApiKeys1771500000000 implements MigrationInterface {
  name = 'HashApiKeys1771500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Helper: check if a column exists
    const columnExists = async (
      table: string,
      column: string,
    ): Promise<boolean> => {
      const result = await queryRunner.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [table, column],
      );
      return result.length > 0;
    };

    // Helper: check if an index exists
    const indexExists = async (name: string): Promise<boolean> => {
      const result = await queryRunner.query(
        `SELECT 1 FROM pg_indexes WHERE indexname = $1`,
        [name],
      );
      return result.length > 0;
    };

    // 1. Add nullable columns (if not already present)
    if (!(await columnExists('agent_api_keys', 'key_hash'))) {
      await queryRunner.query(
        `ALTER TABLE "agent_api_keys" ADD COLUMN "key_hash" character varying(64)`,
      );
    }
    if (!(await columnExists('agent_api_keys', 'key_prefix'))) {
      await queryRunner.query(
        `ALTER TABLE "agent_api_keys" ADD COLUMN "key_prefix" character varying(12)`,
      );
    }
    if (!(await columnExists('api_keys', 'key_hash'))) {
      await queryRunner.query(
        `ALTER TABLE "api_keys" ADD COLUMN "key_hash" character varying(64)`,
      );
    }
    if (!(await columnExists('api_keys', 'key_prefix'))) {
      await queryRunner.query(
        `ALTER TABLE "api_keys" ADD COLUMN "key_prefix" character varying(12)`,
      );
    }

    // 2. Backfill hashes from existing plaintext keys
    const agentKeys: { id: string; key: string }[] = await queryRunner.query(
      `SELECT id, key FROM "agent_api_keys" WHERE key IS NOT NULL AND key != ''`,
    );
    for (const row of agentKeys) {
      const hash = createHash('sha256').update(row.key).digest('hex');
      const prefix = row.key.substring(0, 12);
      await queryRunner.query(
        `UPDATE "agent_api_keys" SET key_hash = $1, key_prefix = $2 WHERE id = $3`,
        [hash, prefix, row.id],
      );
    }

    const apiKeys: { id: string; key: string }[] = await queryRunner.query(
      `SELECT id, key FROM "api_keys" WHERE key IS NOT NULL AND key != ''`,
    );
    for (const row of apiKeys) {
      const hash = createHash('sha256').update(row.key).digest('hex');
      const prefix = row.key.substring(0, 12);
      await queryRunner.query(
        `UPDATE "api_keys" SET key_hash = $1, key_prefix = $2 WHERE id = $3`,
        [hash, prefix, row.id],
      );
    }

    // 3. Remove rows that have no plaintext key AND no hash (orphaned from partial migration)
    await queryRunner.query(
      `DELETE FROM "agent_api_keys" WHERE key_hash IS NULL AND (key IS NULL OR key = '')`,
    );
    await queryRunner.query(
      `DELETE FROM "api_keys" WHERE key_hash IS NULL AND (key IS NULL OR key = '')`,
    );

    // 4. Set columns NOT NULL
    await queryRunner.query(
      `ALTER TABLE "agent_api_keys" ALTER COLUMN "key_hash" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_api_keys" ALTER COLUMN "key_prefix" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ALTER COLUMN "key_hash" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ALTER COLUMN "key_prefix" SET NOT NULL`,
    );

    // 5. Create unique index on key_hash (if not already present)
    if (!(await indexExists('IDX_agent_api_keys_key_hash'))) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX "IDX_agent_api_keys_key_hash" ON "agent_api_keys" ("key_hash")`,
      );
    }
    if (!(await indexExists('IDX_api_keys_key_hash'))) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX "IDX_api_keys_key_hash" ON "api_keys" ("key_hash")`,
      );
    }

    // 6. Drop old unique index on agent_api_keys.key (if still present)
    if (await indexExists('IDX_9357d38f073722e36f2f281276')) {
      await queryRunner.query(
        `DROP INDEX "public"."IDX_9357d38f073722e36f2f281276"`,
      );
    }

    // 7. Make key column nullable (MUST happen before nulling values)
    await queryRunner.query(
      `ALTER TABLE "agent_api_keys" ALTER COLUMN "key" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ALTER COLUMN "key" DROP NOT NULL`,
    );

    // 8. NULL out plaintext keys (safe now that column is nullable)
    await queryRunner.query(`UPDATE "agent_api_keys" SET key = NULL`);
    await queryRunner.query(`UPDATE "api_keys" SET key = NULL`);
  }

  public async down(): Promise<void> {
    throw new Error(
      'Irreversible migration: plaintext keys have been removed and cannot be recovered.',
    );
  }
}
