import { DataSource } from 'typeorm';
import { AddTenantRequestUsage1801300000000 } from '../src/database/migrations/1801300000000-AddTenantRequestUsage';
import { toSqlTimestamp } from '../src/common/utils/postgres-sql';

const TENANT = 'usage-tenant';
const AGENT = 'usage-agent';
const PLAYGROUND = 'usage-playground';
const WINDOW_START = toSqlTimestamp(new Date('2026-07-09T09:06:52Z'));
const REQUEST_TIMESTAMP = '2026-07-20 12:00:00';

async function runMigration(
  ds: DataSource,
  direction: 'up' | 'down',
  migration = new AddTenantRequestUsage1801300000000(),
): Promise<void> {
  const queryRunner = ds.createQueryRunner();
  try {
    await migration[direction](queryRunner);
  } finally {
    await queryRunner.release();
  }
}

async function insertRequest(
  ds: DataSource,
  id: string,
  agentId = AGENT,
  timestamp = REQUEST_TIMESTAMP,
): Promise<void> {
  await ds.query(
    `INSERT INTO "requests" ("id", "tenant_id", "agent_id", "timestamp", "status")
     VALUES ($1, $2, $3, $4, 'success')`,
    [id, TENANT, agentId, timestamp],
  );
}

async function insertAttempt(
  ds: DataSource,
  id: string,
  opts: {
    requestId?: string | null;
    agentId?: string;
    timestamp?: string;
    superseded?: boolean;
    errorOrigin?: string | null;
  } = {},
): Promise<void> {
  await ds.query(
    `INSERT INTO "agent_messages" (
       "id", "request_id", "tenant_id", "agent_id", "agent_name", "timestamp",
       "status", "input_tokens", "output_tokens", "cache_read_tokens",
       "cache_creation_tokens", "superseded", "error_origin"
     )
     VALUES ($1, $2, $3, $4, $4, $5, 'success', 0, 0, 0, 0, $6, $7)`,
    [
      id,
      opts.requestId ?? null,
      TENANT,
      opts.agentId ?? AGENT,
      opts.timestamp ?? REQUEST_TIMESTAMP,
      opts.superseded ?? false,
      opts.errorOrigin ?? null,
    ],
  );
}

async function usageCount(ds: DataSource, windowStart = WINDOW_START): Promise<number> {
  const rows: Array<{ request_count: string }> = await ds.query(
    `SELECT "request_count"
       FROM "tenant_request_usage"
      WHERE "tenant_id" = $1
        AND "window_start" = $2`,
    [TENANT, windowStart],
  );
  return Number(rows[0]?.request_count ?? 0);
}

describe('AddTenantRequestUsage migration (e2e)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'postgres',
      url:
        process.env['DATABASE_URL'] ?? 'postgresql://myuser:mypassword@localhost:5432/mydatabase',
      entities: ['src/entities/!(*.spec).ts'],
      migrations: ['src/database/migrations/!(*.spec).ts'],
      synchronize: false,
      dropSchema: true,
      logging: false,
    });
    await ds.initialize();
    await ds.runMigrations({ transaction: 'each' });
    await runMigration(ds, 'down');

    await ds.query(`INSERT INTO "tenants" ("id", "name", "is_active") VALUES ($1, $1, true)`, [
      TENANT,
    ]);
    await ds.query(
      `INSERT INTO "agents" ("id", "tenant_id", "name", "display_name", "is_playground")
       VALUES ($1, $3, $1, $1, false), ($2, $3, $2, $2, true)`,
      [AGENT, PLAYGROUND, TENANT],
    );

    await insertRequest(ds, 'seed-linked');
    await insertAttempt(ds, 'seed-linked-attempt', { requestId: 'seed-linked' });

    await insertRequest(ds, 'seed-playground', PLAYGROUND);
    await insertAttempt(ds, 'seed-playground-attempt', {
      requestId: 'seed-playground',
      agentId: PLAYGROUND,
    });

    await insertRequest(ds, 'seed-zero-attempt');
    await insertAttempt(ds, 'seed-legacy');
    await insertAttempt(ds, 'seed-legacy-superseded', { superseded: true });
    await insertAttempt(ds, 'seed-manifest-rejection', { errorOrigin: 'policy' });

    await runMigration(ds, 'up');
  }, 60_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('seeds linked and eligible unlinked Requests without counting exclusions', async () => {
    expect(await usageCount(ds)).toBe(2);

    const requests = await ds.query(
      `SELECT "id", "quota_counted"
         FROM "requests"
        WHERE "id" LIKE 'seed-%'
     ORDER BY "id"`,
    );
    expect(requests).toEqual([
      { id: 'seed-linked', quota_counted: true },
      { id: 'seed-playground', quota_counted: false },
      { id: 'seed-zero-attempt', quota_counted: false },
    ]);

    const attempts = await ds.query(
      `SELECT "id", "legacy_quota_counted"
         FROM "agent_messages"
        WHERE "id" IN ('seed-legacy', 'seed-legacy-superseded', 'seed-manifest-rejection')
     ORDER BY "id"`,
    );
    expect(attempts).toEqual([
      { id: 'seed-legacy', legacy_quota_counted: true },
      { id: 'seed-legacy-superseded', legacy_quota_counted: false },
      { id: 'seed-manifest-rejection', legacy_quota_counted: false },
    ]);
  });

  it('keeps one exact count through live attempts and legacy linking', async () => {
    await insertRequest(ds, 'live-request');
    await insertAttempt(ds, 'live-attempt-1', { requestId: 'live-request' });
    await insertAttempt(ds, 'live-attempt-2', { requestId: 'live-request' });

    expect(await usageCount(ds)).toBe(3);
    await insertRequest(ds, 'live-playground', PLAYGROUND);
    await insertAttempt(ds, 'live-playground-attempt', {
      requestId: 'live-playground',
      agentId: PLAYGROUND,
    });

    expect(await usageCount(ds)).toBe(3);
    await insertRequest(ds, 'legacy-parent');
    await ds.query(
      `UPDATE "agent_messages"
          SET "request_id" = $1, "attempt_number" = 1
        WHERE "id" = 'seed-legacy'`,
      ['legacy-parent'],
    );

    expect(await usageCount(ds)).toBe(3);
    await insertRequest(ds, 'legacy-race-parent');
    await insertAttempt(ds, 'legacy-race-attempt');
    await ds.query(
      `UPDATE "agent_messages"
          SET "request_id" = $1, "attempt_number" = 1
        WHERE "id" = 'legacy-race-attempt'`,
      ['legacy-race-parent'],
    );

    expect(await usageCount(ds)).toBe(4);
    const rows = await ds.query(
      `SELECT "id", "quota_counted"
         FROM "requests"
        WHERE "id" IN ('live-request', 'live-playground', 'legacy-parent', 'legacy-race-parent')
     ORDER BY "id"`,
    );
    expect(rows).toEqual([
      { id: 'legacy-parent', quota_counted: true },
      { id: 'legacy-race-parent', quota_counted: true },
      { id: 'live-playground', quota_counted: false },
      { id: 'live-request', quota_counted: true },
    ]);

    const augustWindow = toSqlTimestamp(new Date(Date.UTC(2026, 7, 1)));
    await insertRequest(ds, 'august-request', AGENT, '2026-08-15 12:00:00');
    await insertAttempt(ds, 'august-attempt', {
      requestId: 'august-request',
      timestamp: '2026-08-15 12:00:00',
    });

    expect(await usageCount(ds, augustWindow)).toBe(1);
  });
});
