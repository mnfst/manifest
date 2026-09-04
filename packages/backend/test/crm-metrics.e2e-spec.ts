import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { createTestApp, TEST_TENANT_ID, TEST_AGENT_ID } from './helpers';

/**
 * Exercises the real SQL against real Postgres. The unit specs mock the
 * DataSource entirely, so this is the only place a syntax error, a bad column
 * name, or an invalid index definition would surface.
 */

const SECRET = 'e2e-crm-metrics-secret-at-least-32-chars';
const HEALED_INDEX = 'IDX_requests_autofix_healed';

const OWNER_ID = 'crm-owner-001';
const OWNER_EMAIL = 'healed.user@example.com';

/** Local wall clock, matching how the pg driver writes these naive columns. */
function localSqlTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

describe('Internal CRM metrics (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    process.env['CRM_METRICS_SECRET'] = SECRET;
    app = await createTestApp();
    ds = app.get(DataSource);

    // Better Auth owns the `user` table and its migrations do not run in e2e.
    await ds.query(
      `CREATE TABLE IF NOT EXISTS "user" (
         id VARCHAR PRIMARY KEY,
         name VARCHAR,
         email VARCHAR,
         "emailVerified" BOOLEAN
       )`,
    );

    // The partial index lives in a migration, not on the entity, so
    // synchronize() never creates it. Building it here also proves the exact
    // definition the migration emits is valid Postgres.
    await ds.query(
      `CREATE INDEX IF NOT EXISTS "${HEALED_INDEX}" ON "requests" ("tenant_id", "timestamp") ` +
        `INCLUDE ("status") WHERE "autofix_status" = 'retry_succeeded'`,
    );
  });

  afterAll(async () => {
    await app.close();
    delete process.env['CRM_METRICS_SECRET'];
  });

  beforeEach(async () => {
    await ds.query('DELETE FROM agent_messages');
    await ds.query('DELETE FROM requests');
    await ds.query('DELETE FROM waitlist_claims');
    await ds.query('DELETE FROM "user"');
    await ds.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)`,
      [OWNER_ID, 'Healed User', OWNER_EMAIL],
    );
    await ds.query(`UPDATE tenants SET owner_user_id = $1 WHERE id = $2`, [
      OWNER_ID,
      TEST_TENANT_ID,
    ]);
  });

  async function seedHealedRequest(
    ageDays: number,
    provider: string,
    status = 'success',
  ): Promise<void> {
    const requestId = uuid();
    const at = localSqlTimestamp(new Date(Date.now() - ageDays * 86_400_000));
    await ds.query(
      `INSERT INTO requests (id, tenant_id, agent_id, agent_name, timestamp, status, autofix_status)
       VALUES ($1, $2, $3, 'demo-agent', $4, $5, 'retry_succeeded')`,
      [requestId, TEST_TENANT_ID, TEST_AGENT_ID, at, status],
    );
    await ds.query(
      `INSERT INTO agent_messages (id, tenant_id, agent_id, agent_name, request_id, timestamp, provider, model, autofix_applied)
       VALUES ($1, $2, $3, 'demo-agent', $4, $5, $6, 'some-model', true)`,
      [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, requestId, at, provider],
    );
  }

  const get = (path: string) =>
    request(app.getHttpServer()).get(`/api/v1/internal/crm-metrics${path}`);

  /**
   * Results are memoised per window for 60s, which outlives this suite, so each
   * cohort assertion asks for its own `days` value. They are all far shorter
   * than the 40-day-old row seeded below, so the window itself never matters —
   * only that the cache keys differ.
   */
  let windowDays = 6;
  const nextWindow = () => `?days=${++windowDays}`;

  describe('auth', () => {
    it('rejects a request with no secret', async () => {
      await get('').expect(401);
    });

    it('rejects a request with the wrong secret', async () => {
      await get('').set('x-internal-secret', 'wrong').expect(401);
    });

    it('rejects the conversions route without the secret', async () => {
      await get('/conversions').expect(401);
    });
  });

  describe('validation', () => {
    it('rejects an out-of-range window', async () => {
      await get('?days=0').set('x-internal-secret', SECRET).expect(400);
      await get('?days=400').set('x-internal-secret', SECRET).expect(400);
    });

    it('rejects an undeclared query parameter', async () => {
      await get('?nope=1').set('x-internal-secret', SECRET).expect(400);
    });
  });

  describe('cohort', () => {
    it('returns a healed user with their counts and providers', async () => {
      await seedHealedRequest(1, 'openrouter');
      await seedHealedRequest(2, 'openrouter');
      await seedHealedRequest(3, 'anthropic');

      const res = await get(nextWindow()).set('x-internal-secret', SECRET).expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        email: OWNER_EMAIL,
        name: 'Healed User',
        healed_recent: 3,
        healed_all: 3,
        providers: ['openrouter', 'anthropic'],
        top_provider: 'openrouter',
      });
    });

    it('counts older heals in the all-time total but not the window', async () => {
      await seedHealedRequest(1, 'openai');
      await seedHealedRequest(40, 'openai');

      const res = await get(nextWindow()).set('x-internal-secret', SECRET).expect(200);

      expect(res.body[0]).toMatchObject({ healed_recent: 1, healed_all: 2 });
    });

    it('ignores a retry that succeeded on a request which still failed', async () => {
      await seedHealedRequest(1, 'openai', 'failed');

      const res = await get(nextWindow()).set('x-internal-secret', SECRET).expect(200);

      expect(res.body).toEqual([]);
    });

    it('omits users whose email is unverified', async () => {
      await seedHealedRequest(1, 'openai');
      await ds.query(`UPDATE "user" SET "emailVerified" = false WHERE id = $1`, [OWNER_ID]);

      const res = await get(nextWindow()).set('x-internal-secret', SECRET).expect(200);

      expect(res.body).toEqual([]);
    });

    it('omits internal addresses', async () => {
      await seedHealedRequest(1, 'openai');
      await ds.query(`UPDATE "user" SET email = 'bruno@buddyweb.fr' WHERE id = $1`, [OWNER_ID]);

      const res = await get(nextWindow()).set('x-internal-secret', SECRET).expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns an empty list when nothing was healed', async () => {
      const res = await get(nextWindow()).set('x-internal-secret', SECRET).expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('conversions', () => {
    it('returns waitlist claims in the window, lowercased', async () => {
      await ds.query(
        `INSERT INTO waitlist_claims (id, email, source, claimed_at) VALUES ($1, $2, $3, now())`,
        [uuid(), 'Converted@Example.com', 'cloud'],
      );
      await ds.query(
        `INSERT INTO waitlist_claims (id, email, source, claimed_at)
         VALUES ($1, $2, $3, now() - interval '200 days')`,
        [uuid(), 'ancient@example.com', 'cloud'],
      );

      const res = await get('/conversions?days=90').set('x-internal-secret', SECRET).expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ email: 'converted@example.com', source: 'cloud' });
    });
  });
});
