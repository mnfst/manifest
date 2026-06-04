import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_API_KEY, TEST_TENANT_ID, TEST_AGENT_ID } from './helpers';

// Cross-tenant isolation boundary test for /api/v1/messages.
//
// The MockSessionGuard in test/helpers.ts authenticates every request as
// TEST_USER_ID ("test-user-001"). We seed agent_messages owned by a SECOND
// tenant/user ("attacker-tenant-002" / "attacker-user-002") and assert that
// the authenticated user can never see those rows.
//
// This pins the addTenantFilter() contract in
// packages/backend/src/analytics/services/query-helpers.ts: queries must scope
// by tenant_id (resolved from the user's tenant), not just user_id, so a row
// inserted with a different tenant_id and a different user_id never leaks.

let app: INestApplication;
let ds: DataSource;

const ATTACKER_TENANT_ID = 'attacker-tenant-002';
const ATTACKER_USER_ID = 'attacker-user-002';
const ATTACKER_AGENT_ID = 'attacker-agent-002';
const ATTACKER_MESSAGE_ID = 'attacker-message-002';
const VICTIM_MESSAGE_ID = 'victim-message-001';

async function insertMessage(
  id: string,
  tenantId: string,
  agentId: string,
  agentName: string,
  userId: string,
  description: string,
  now: string,
): Promise<void> {
  await ds.query(
    `INSERT INTO agent_messages
       (id, tenant_id, agent_id, timestamp, status, model,
        input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
        description, service_type, agent_name, user_id)
     VALUES ($1,$2,$3,$4,'ok','gpt-4o',100,50,0,0,$5,'agent',$6,$7)`,
    [id, tenantId, agentId, now, description, agentName, userId],
  );
}

beforeAll(async () => {
  app = await createTestApp();
  ds = app.get(DataSource);

  // Use a "recent" timestamp so the data falls inside the analytics service's
  // default cutoff windows (1h/6h/24h/7d/30d). The existing messages.e2e-spec
  // file also seeds with new Date(), so we mirror that pattern.
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

  // Seed a second tenant + agent that DO NOT belong to TEST_USER_ID. The
  // tenants table's `name` column is the user id (per onboarding flow), so
  // TenantCacheService.resolve(TEST_USER_ID) keeps resolving to
  // TEST_TENANT_ID, never to ATTACKER_TENANT_ID.
  await ds.query(
    `INSERT INTO tenants (id, name, organization_name, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, true, $4, $4)`,
    [ATTACKER_TENANT_ID, ATTACKER_USER_ID, 'Attacker Org', now],
  );
  await ds.query(
    `INSERT INTO agents
       (id, name, display_name, description, is_active, complexity_routing_enabled,
        tenant_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, true, true, $5, $6, $6)`,
    [
      ATTACKER_AGENT_ID,
      'attacker-agent',
      'Attacker Agent',
      'Owned by another tenant',
      ATTACKER_TENANT_ID,
      now,
    ],
  );

  await insertMessage(
    VICTIM_MESSAGE_ID,
    TEST_TENANT_ID,
    TEST_AGENT_ID,
    'test-agent',
    'test-user-001',
    'Victim message',
    now,
  );
  await insertMessage(
    ATTACKER_MESSAGE_ID,
    ATTACKER_TENANT_ID,
    ATTACKER_AGENT_ID,
    'attacker-agent',
    ATTACKER_USER_ID,
    'SECRET attacker payload',
    now,
  );
});

afterAll(async () => {
  await app?.close();
});

describe('Cross-tenant isolation: GET /api/v1/messages', () => {
  it('omits messages owned by a different tenant from the list response', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&limit=200')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);

    // Confirm the victim's own row IS returned, otherwise the assertion below
    // could trivially pass on an empty result. This guards against a future
    // refactor that breaks the legitimate read path.
    const returnedIds: string[] = res.body.items.map((it: { id: string }) => it.id);
    expect(returnedIds).toContain(VICTIM_MESSAGE_ID);

    // The attacker's row must not leak through the projection.
    expect(returnedIds).not.toContain(ATTACKER_MESSAGE_ID);

    // Belt-and-braces: agent_name is in the shared MessageRow projection, so
    // any cross-tenant leak via a missing WHERE clause would surface here.
    for (const item of res.body.items as Record<string, unknown>[]) {
      expect(item['agent_name']).not.toBe('attacker-agent');
    }
  });

  it('does not return another tenant\'s messages when filtering by attacker agent name', async () => {
    // Even an explicit agent_name filter for the attacker's agent must NOT
    // reveal cross-tenant data — addTenantFilter() resolves agent_name within
    // the caller's tenant scope only.
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&agent_name=attacker-agent')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    const returnedIds: string[] = res.body.items.map((it: { id: string }) => it.id);
    expect(returnedIds).not.toContain(ATTACKER_MESSAGE_ID);
  });

  it('blocks PATCH /:id/feedback against a message owned by a different tenant', async () => {
    // Even when the attacker's row id is known, the authenticated user must
    // not be able to mutate it. The feedback service uses tenant scoping in
    // findOwnedMessage(); a leak would return 204 instead of 404.
    await request(app.getHttpServer())
      .patch(`/api/v1/messages/${ATTACKER_MESSAGE_ID}/feedback`)
      .set('x-api-key', TEST_API_KEY)
      .send({ rating: 'like' })
      .expect(404);

    // Confirm at the DB layer that the attacker row was NOT mutated.
    const dbRow = await ds.query(
      `SELECT feedback_rating FROM agent_messages WHERE id = $1`,
      [ATTACKER_MESSAGE_ID],
    );
    expect(dbRow).toHaveLength(1);
    expect(dbRow[0].feedback_rating).toBeNull();
  });

  it('blocks GET /:id/details against a message owned by a different tenant', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/messages/${ATTACKER_MESSAGE_ID}/details`)
      .set('x-api-key', TEST_API_KEY)
      .expect(404);
  });
});
