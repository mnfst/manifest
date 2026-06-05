import { Client } from 'pg';
import { DataSource, QueryRunner } from 'typeorm';
import { LiftAgentProvidersToGlobal1791000000000 } from './1791000000000-LiftAgentProvidersToGlobal';

/**
 * This spec executes the real migration against a live PostgreSQL database so
 * that both up() and down() are exercised end-to-end. It creates a throwaway
 * database, builds the minimal schema the migration touches (user_providers +
 * agents), seeds collision scenarios, and asserts on the resulting rows and
 * indexes via pg_indexes.
 */

const ADMIN_URL =
  process.env['MIGRATION_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgresql://myuser:mypassword@localhost:5432/postgres';

function baseUrlFor(dbName: string): string {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${dbName}`;
  return url.toString();
}

const OLD_INDEX = 'IDX_user_providers_agent_provider_auth_label';
const NEW_INDEX = 'IDX_user_providers_user_provider_auth_label';

describe('LiftAgentProvidersToGlobal1791000000000 (live DB)', () => {
  const migration = new LiftAgentProvidersToGlobal1791000000000();
  const dbName = `manifest_mig_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  let dataSource: DataSource;
  let runner: QueryRunner;

  async function indexExists(name: string): Promise<boolean> {
    const rows: Array<{ indexname: string }> = await runner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'user_providers' AND indexname = $1`,
      [name],
    );
    return rows.length === 1;
  }

  async function seedSchema(): Promise<void> {
    await runner.query(`
      CREATE TABLE "agents" (
        "id" varchar PRIMARY KEY,
        "name" varchar,
        "display_name" varchar
      )
    `);
    await runner.query(`
      CREATE TABLE "user_providers" (
        "id" varchar PRIMARY KEY,
        "user_id" varchar NOT NULL,
        "agent_id" varchar NOT NULL,
        "provider" varchar NOT NULL,
        "auth_type" varchar NOT NULL DEFAULT 'api_key',
        "label" varchar NOT NULL DEFAULT 'Default',
        "priority" integer NOT NULL DEFAULT 0,
        "connected_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    // The old agent-scoped unique index that up() must drop.
    await runner.query(`
      CREATE UNIQUE INDEX "${OLD_INDEX}"
      ON "user_providers" ("agent_id", "provider", "auth_type", LOWER("label"))
    `);
  }

  beforeAll(async () => {
    const admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    await admin.end();

    dataSource = new DataSource({ type: 'postgres', url: baseUrlFor(dbName) });
    await dataSource.initialize();
    runner = dataSource.createQueryRunner();
    await seedSchema();
  });

  afterAll(async () => {
    if (runner) await runner.release();
    if (dataSource?.isInitialized) await dataSource.destroy();
    const admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    // Terminate stragglers then drop the throwaway DB.
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin.end();
  });

  beforeEach(async () => {
    await runner.query(`DELETE FROM "user_providers"`);
    await runner.query(`DELETE FROM "agents"`);
    // Reset the schema to the pre-up() baseline (old agent-scoped index present,
    // new user-scoped index absent) so each test starts from the same state.
    await runner.query(`DROP INDEX IF EXISTS "${NEW_INDEX}"`);
    await runner.query(`DROP INDEX IF EXISTS "${OLD_INDEX}"`);
    await runner.query(`
      CREATE UNIQUE INDEX "${OLD_INDEX}"
      ON "user_providers" ("agent_id", "provider", "auth_type", LOWER("label"))
    `);
  });

  it('relabels colliding Default rows to agent display names, keeps every row, and swaps the index', async () => {
    await runner.query(
      `INSERT INTO "agents" ("id", "name", "display_name") VALUES ($1, $2, $3), ($4, $5, $6)`,
      ['agent-1', 'agent-one', 'Sales Bot', 'agent-2', 'agent-two', 'Support Bot'],
    );
    await runner.query(
      `INSERT INTO "user_providers" ("id", "user_id", "agent_id", "provider", "auth_type", "label")
       VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)`,
      [
        'up-1',
        'user-1',
        'agent-1',
        'openai',
        'api_key',
        'Default',
        'up-2',
        'user-1',
        'agent-2',
        'openai',
        'api_key',
        'Default',
      ],
    );

    const before: Array<{ c: string }> = await runner.query(
      `SELECT COUNT(*)::text AS c FROM "user_providers"`,
    );

    await migration.up(runner);

    const after: Array<{ c: string }> = await runner.query(
      `SELECT COUNT(*)::text AS c FROM "user_providers"`,
    );
    // No rows deleted.
    expect(after[0].c).toBe(before[0].c);
    expect(after[0].c).toBe('2');

    const rows: Array<{ id: string; label: string; agent_id: string | null }> = await runner.query(
      `SELECT "id", "label", "agent_id" FROM "user_providers" ORDER BY "id"`,
    );
    const labels = rows.map((r) => r.label).sort();
    expect(labels).toEqual(['Sales Bot', 'Support Bot']);
    // agent_id is never nulled by this migration.
    expect(rows.every((r) => r.agent_id !== null)).toBe(true);

    expect(await indexExists(NEW_INDEX)).toBe(true);
    expect(await indexExists(OLD_INDEX)).toBe(false);
  });

  it('relabels a colliding custom label as "<label> - <agentName>"', async () => {
    // agent-2 has no display_name, so the relabel falls back to "name".
    await runner.query(
      `INSERT INTO "agents" ("id", "name", "display_name") VALUES ($1, $2, $3), ($4, $5, $6)`,
      ['agent-1', 'agent-one', 'Sales Bot', 'agent-2', 'agent-two', null],
    );
    await runner.query(
      `INSERT INTO "user_providers" ("id", "user_id", "agent_id", "provider", "auth_type", "label")
       VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)`,
      [
        'up-1',
        'user-1',
        'agent-1',
        'openai',
        'api_key',
        'Prod Key',
        'up-2',
        'user-1',
        'agent-2',
        'openai',
        'api_key',
        'Prod Key',
      ],
    );

    await migration.up(runner);

    const rows: Array<{ id: string; label: string }> = await runner.query(
      `SELECT "id", "label" FROM "user_providers" ORDER BY "id"`,
    );
    const labels = rows.map((r) => r.label).sort();
    expect(labels).toEqual(['Prod Key - Sales Bot', 'Prod Key - agent-two']);
    expect(await indexExists(NEW_INDEX)).toBe(true);
  });

  it('leaves a non-colliding row unchanged', async () => {
    await runner.query(`INSERT INTO "agents" ("id", "name", "display_name") VALUES ($1, $2, $3)`, [
      'agent-1',
      'agent-one',
      'Sales Bot',
    ]);
    await runner.query(
      `INSERT INTO "user_providers" ("id", "user_id", "agent_id", "provider", "auth_type", "label")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['up-solo', 'user-9', 'agent-1', 'anthropic', 'api_key', 'My Anthropic'],
    );

    await migration.up(runner);

    const rows: Array<{ label: string }> = await runner.query(
      `SELECT "label" FROM "user_providers" WHERE "id" = 'up-solo'`,
    );
    expect(rows[0].label).toBe('My Anthropic');
  });

  it('down() drops the user-scoped index and recreates the agent-scoped one', async () => {
    // Bring the schema to the post-up() state first.
    await migration.up(runner);
    expect(await indexExists(NEW_INDEX)).toBe(true);

    await migration.down(runner);

    expect(await indexExists(NEW_INDEX)).toBe(false);
    expect(await indexExists(OLD_INDEX)).toBe(true);

    // Re-establish the post-up() index for any subsequent runs / idempotency.
    await migration.up(runner);
    expect(await indexExists(NEW_INDEX)).toBe(true);
  });
});
