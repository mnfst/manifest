import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_OTLP_KEY, TEST_USER_ID } from './helpers';

// Enforces the monthly routed-request cap on the /v1/* proxy. Billing env must
// be set BEFORE the app is created so isBillingEnabled() resolves true. We drive
// the block with PLAN_LIMIT_FREE_REQUESTS=0 so the gate trips on the first
// request — no need to seed thousands of agent_messages rows or stub a provider
// (the gate runs before any upstream call). Env is restored in afterAll so it
// can't leak into sibling e2e files sharing the --runInBand worker.
let app: INestApplication;
let ds: DataSource;

const envSnapshots: Record<string, string | undefined> = {};
const BILLING_ENV_VARS = [
  'MANIFEST_MODE',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
  'PLAN_LIMIT_FREE_REQUESTS',
];

beforeAll(async () => {
  for (const key of BILLING_ENV_VARS) envSnapshots[key] = process.env[key];
  process.env['MANIFEST_MODE'] = 'cloud';
  process.env['STRIPE_SECRET_KEY'] = 'sk_test_dummy';
  process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_dummy';
  process.env['STRIPE_PRO_PRICE_ID'] = 'price_dummy';
  process.env['PLAN_LIMIT_FREE_REQUESTS'] = '0';

  app = await createTestApp();
  ds = app.get(DataSource);
  // better-auth's runMigrations doesn't run in the e2e harness, so create the
  // Stripe plugin's subscription table shape ourselves (PlanService.getPlan
  // queries it). camelCase quoted columns match the real schema.
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
  }
  for (const key of BILLING_ENV_VARS) {
    if (envSnapshots[key] === undefined) delete process.env[key];
    else process.env[key] = envSnapshots[key];
  }
  if (app) await app.close();
});

describe('request limit gate (/v1 proxy)', () => {
  it('blocks a free tenant over the monthly request cap with a real 402 for tool callers', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${TEST_OTLP_KEY}`)
      .set('Accept', 'application/json')
      .send({ model: 'auto', messages: [{ role: 'user', content: 'hi' }] })
      .expect(402);
    expect(res.body.error.code).toBe('PLAN_LIMIT_REQUESTS');
    expect(res.body.error.type).toBe('insufficient_quota');
    expect(res.body.error.message).toContain('Upgrade to Pro');
    expect(res.body.limit).toBe(0);
  });

  it('does not record the blocked request as a message (no quota feedback loop)', async () => {
    const before = await ds.query(
      `SELECT COUNT(*)::int AS n FROM agent_messages WHERE tenant_id = (
         SELECT id FROM tenants WHERE owner_user_id = $1 LIMIT 1)`,
      [TEST_USER_ID],
    );
    await request(app.getHttpServer())
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${TEST_OTLP_KEY}`)
      .set('Accept', 'application/json')
      .send({ model: 'auto', messages: [{ role: 'user', content: 'again' }] })
      .expect(402);
    const after = await ds.query(
      `SELECT COUNT(*)::int AS n FROM agent_messages WHERE tenant_id = (
         SELECT id FROM tenants WHERE owner_user_id = $1 LIMIT 1)`,
      [TEST_USER_ID],
    );
    expect(after[0].n).toBe(before[0].n);
  });

  it('allows requests once the tenant is on an active pro subscription (unlimited)', async () => {
    await ds.query(
      `INSERT INTO "subscription" ("id", "plan", "referenceId", "status") VALUES ('sub-req-e2e-1', 'pro', $1, 'active')`,
      [TEST_USER_ID],
    );
    // Pro is unlimited, so the request-limit gate must NOT return 402. The
    // request proceeds past the gate (it may fail downstream for lack of a real
    // provider, but never with our PLAN_LIMIT_REQUESTS block).
    const res = await request(app.getHttpServer())
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${TEST_OTLP_KEY}`)
      .set('Accept', 'application/json')
      .send({ model: 'auto', messages: [{ role: 'user', content: 'pro' }] });
    expect(res.status).not.toBe(402);
  });
});
