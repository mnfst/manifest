import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_API_KEY, TEST_USER_ID } from './helpers';

// Billing must be enabled BEFORE the app is created so isBillingEnabled()
// resolves true and PlanService enforces the free-plan agent limit. Env is
// set in beforeAll (not at module load) and restored in afterAll so it
// cannot leak into other e2e files sharing this jest worker (--runInBand).
let app: INestApplication;
let ds: DataSource;

const envSnapshots: Record<string, string | undefined> = {};
const BILLING_ENV_VARS = [
  'MANIFEST_MODE',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
];

beforeAll(async () => {
  for (const key of BILLING_ENV_VARS) envSnapshots[key] = process.env[key];
  process.env['MANIFEST_MODE'] = 'cloud';
  process.env['STRIPE_SECRET_KEY'] = 'sk_test_dummy';
  process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_dummy';
  process.env['STRIPE_PRO_PRICE_ID'] = 'price_dummy';

  app = await createTestApp();
  ds = app.get(DataSource);
  // better-auth's runMigrations doesn't run in the e2e harness, so create the
  // Stripe plugin's subscription table shape ourselves. camelCase quoted columns
  // match what PlanService.getPlan() queries against.
  await ds.query(`CREATE TABLE IF NOT EXISTS "subscription" (
    "id" text PRIMARY KEY,
    "plan" text NOT NULL,
    "referenceId" text NOT NULL,
    "stripeCustomerId" text,
    "stripeSubscriptionId" text,
    "status" text NOT NULL,
    "periodStart" timestamptz,
    "periodEnd" timestamptz,
    "cancelAtPeriodEnd" boolean DEFAULT false
  )`);
});

afterAll(async () => {
  if (ds) {
    await ds.query(`DELETE FROM "subscription" WHERE "referenceId" = $1`, [TEST_USER_ID]);
    await ds.query(`DELETE FROM agents WHERE name LIKE 'billing-e2e-%'`);
  }
  for (const key of BILLING_ENV_VARS) {
    if (envSnapshots[key] === undefined) delete process.env[key];
    else process.env[key] = envSnapshots[key];
  }
  if (app) await app.close();
});

describe('agent limit gate', () => {
  it('blocks a free user already at 1 agent with 402 PLAN_LIMIT_AGENTS', async () => {
    // The seeded test tenant already owns 1 non-playground agent (TEST_AGENT_ID)
    // -> at the free-plan limit of 1.
    const res = await request(app.getHttpServer())
      .post('/api/v1/agents')
      .set('x-api-key', TEST_API_KEY)
      .send({ name: 'billing-e2e-blocked' })
      .expect(402);
    expect(res.body.code).toBe('PLAN_LIMIT_AGENTS');
    expect(res.body.limit).toBe(1);
    expect(res.body.used).toBeGreaterThanOrEqual(1);
  });

  it('blocks duplication the same way', async () => {
    const agents = await ds.query(
      `SELECT a.name FROM agents a JOIN tenants t ON a.tenant_id = t.id WHERE t.owner_user_id = $1 AND a.deleted_at IS NULL LIMIT 1`,
      [TEST_USER_ID],
    );
    const res = await request(app.getHttpServer())
      .post(`/api/v1/agents/${agents[0].name}/duplicate`)
      .set('x-api-key', TEST_API_KEY)
      .send({ name: 'billing-e2e-dup' })
      .expect(402);
    expect(res.body.code).toBe('PLAN_LIMIT_AGENTS');
  });

  it('allows creation once the user has an active pro subscription', async () => {
    await ds.query(
      `INSERT INTO "subscription" ("id", "plan", "referenceId", "status") VALUES ('sub-e2e-1', 'pro', $1, 'active')`,
      [TEST_USER_ID],
    );
    await request(app.getHttpServer())
      .post('/api/v1/agents')
      .set('x-api-key', TEST_API_KEY)
      .send({ name: 'billing-e2e-pro-ok' })
      .expect(201);
  });
});
