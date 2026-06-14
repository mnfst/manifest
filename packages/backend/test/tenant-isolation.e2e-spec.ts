/**
 * Cross-tenant isolation matrix.
 *
 * Two users, two tenants, each with an agent + data. User B addresses every
 * authed resource-endpoint class with tenant A's identifiers and must get
 * 403/404/empty — never tenant A's data. This pins the tenant-canonical
 * scoping contract: tenants resolve via `tenants.owner_user_id` only, and
 * every resource query is scoped by tenant_id.
 *
 * The MockSessionGuard in helpers.ts authenticates as TEST_USER_ID by default
 * and as the `x-test-user-id` header's user when present — the same mechanism
 * production uses (session → owner_user_id → tenant), minus Better Auth.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import request from 'supertest';
import {
  createTestApp,
  TEST_API_KEY,
  TEST_TENANT_ID,
  TEST_AGENT_ID,
  TEST_USER_ID,
} from './helpers';
import { CustomProvider } from '../src/entities/custom-provider.entity';
import { HeaderTier } from '../src/entities/header-tier.entity';
import { PlaygroundRun } from '../src/entities/playground-run.entity';

let app: INestApplication;
let ds: DataSource;

const USER_B = 'isolation-user-b';
const B_AGENT_NAME = 'b-agent';

// Tenant A's resource identifiers (the attack targets).
const A_MESSAGE_ID = uuid();
const A_RUN_ID = uuid();
const A_CUSTOM_PROVIDER_ID = 'cp-isolation-a';
const A_HEADER_TIER_ID = 'ht-isolation-a';
let aRuleId: string;
let aProviderConnectionId: string;
let bAgentId: string;
let bTenantId: string;

const api = () => request(app.getHttpServer());
/** Authenticated as tenant A's owner (TEST_USER_ID). */
const asA = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);
/** Authenticated as user B (his own tenant, created below). */
const asB = (r: request.Test) =>
  r.set('x-api-key', TEST_API_KEY).set('x-test-user-id', USER_B);

beforeAll(async () => {
  app = await createTestApp();
  ds = app.get(DataSource);
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

  // --- User B onboards through the public API: this lazily creates tenant B
  // with owner_user_id = USER_B (the only sanctioned user→tenant link).
  const bCreate = await asB(api().post('/api/v1/agents'))
    .send({ name: B_AGENT_NAME })
    .expect(201);
  bAgentId = bCreate.body.agent.id as string;
  const bAgentRow = await ds.query(`SELECT tenant_id FROM agents WHERE id = $1`, [bAgentId]);
  bTenantId = bAgentRow[0].tenant_id as string;
  expect(bTenantId).not.toBe(TEST_TENANT_ID);

  // --- Tenant A data ---------------------------------------------------
  // A message.
  await ds.query(
    `INSERT INTO agent_messages
       (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens,
        cache_read_tokens, cache_creation_tokens, description, service_type, agent_name, user_id)
     VALUES ($1,$2,$3,$4,'ok','gpt-4o',100,50,0,0,'Tenant A secret','agent','test-agent',$5)`,
    [A_MESSAGE_ID, TEST_TENANT_ID, TEST_AGENT_ID, now, TEST_USER_ID],
  );

  // A notification rule (created through the API, as A).
  const rule = await asA(api().post('/api/v1/notifications'))
    .send({ agent_name: 'test-agent', metric_type: 'tokens', threshold: 12345, period: 'day' })
    .expect(201);
  aRuleId = rule.body.id as string;

  // A provider connection (tenant-global credential row).
  const provider = await asA(api().post('/api/v1/routing/test-agent/providers'))
    .send({ provider: 'openai', apiKey: 'sk-isolation-a' })
    .expect(201);
  aProviderConnectionId = provider.body.id as string;

  // A message attributed to that connection so per-connection analytics for
  // tenant A's connection_id have something to leak if isolation breaks.
  await ds.query(
    `INSERT INTO agent_messages
       (id, tenant_id, agent_id, timestamp, status, model, provider, auth_type,
        provider_key_label, tenant_provider_id, input_tokens, output_tokens,
        cache_read_tokens, cache_creation_tokens, description, service_type, agent_name, user_id)
     VALUES ($1,$2,$3,$4,'ok','gpt-4o','openai','api_key','Default',$5,100,50,0,0,
             'Tenant A connection secret','agent','test-agent',$6)`,
    [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, now, aProviderConnectionId, TEST_USER_ID],
  );

  // A custom provider (tenant-scoped).
  await ds.getRepository(CustomProvider).insert({
    id: A_CUSTOM_PROVIDER_ID,
    tenant_id: TEST_TENANT_ID,
    created_by_user_id: TEST_USER_ID,
    name: 'A Secret Provider',
    base_url: 'https://llm.tenant-a.example.com/v1',
    api_kind: 'openai',
    models: [{ model_name: 'a-model' }],
    created_at: now,
  });

  // A header tier.
  await ds.getRepository(HeaderTier).insert({
    id: A_HEADER_TIER_ID,
    tenant_id: TEST_TENANT_ID,
    agent_id: TEST_AGENT_ID,
    name: 'a-fast-lane',
    header_key: 'x-manifest-tier',
    header_value: 'fast',
    badge_color: 'indigo',
    sort_order: 0,
    enabled: true,
    override_route: null,
    fallback_routes: null,
    output_modality: 'text',
    response_mode: 'buffered',
  });

  // A playground run, attached to tenant A's reserved Playground agent.
  await asA(api().get('/api/v1/playground/agent')).expect(200);
  const pgAgent = await ds.query(
    `SELECT id FROM agents WHERE tenant_id = $1 AND is_playground = true AND deleted_at IS NULL`,
    [TEST_TENANT_ID],
  );
  await ds.getRepository(PlaygroundRun).insert({
    id: A_RUN_ID,
    tenant_id: TEST_TENANT_ID,
    created_by_user_id: TEST_USER_ID,
    agent_id: pgAgent[0].id as string,
    agent_name: 'Playground',
    prompt: 'tenant A secret prompt',
    starred: false,
    best_column_id: null,
    created_at: now,
  });

  // --- Tenant B data (so "empty" assertions cannot pass vacuously) -----
  await ds.query(
    `INSERT INTO agent_messages
       (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens,
        cache_read_tokens, cache_creation_tokens, description, service_type, agent_name, user_id)
     VALUES ($1,$2,$3,$4,'ok','gpt-4o',10,5,0,0,'Tenant B message','agent',$5,$6)`,
    [uuid(), bTenantId, bAgentId, now, B_AGENT_NAME, USER_B],
  );
}, 30000);

afterAll(async () => {
  await app?.close();
});

/* ------------------------------------------------------------------ */
/*  Agents                                                             */
/* ------------------------------------------------------------------ */
describe('Agents — user B cannot see or mutate tenant A agents', () => {
  it('agent list shows only B agents', async () => {
    const res = await asB(api().get('/api/v1/agents')).expect(200);
    const names = (res.body.agents as Array<{ agent_name: string }>).map((a) => a.agent_name);
    expect(names).toContain(B_AGENT_NAME);
    expect(names).not.toContain('test-agent');
  });

  it('GET /agents/:name → natural empty shape for A agent (no data)', async () => {
    // Read endpoints return the natural empty shape for unowned resources.
    const res = await asB(api().get('/api/v1/agents/test-agent')).expect(200);
    expect(res.body).toEqual({ agent: null });
  });

  it('PATCH /agents/:name (rename) → 404 for A agent', async () => {
    await asB(api().patch('/api/v1/agents/test-agent'))
      .send({ name: 'stolen-agent' })
      .expect(404);
    const row = await ds.query(`SELECT name FROM agents WHERE id = $1`, [TEST_AGENT_ID]);
    expect(row[0].name).toBe('test-agent');
  });

  it('DELETE /agents/:name → 404 for A agent (and A agent survives)', async () => {
    await asB(api().delete('/api/v1/agents/test-agent')).expect(404);
    const row = await ds.query(`SELECT deleted_at FROM agents WHERE id = $1`, [TEST_AGENT_ID]);
    expect(row[0].deleted_at).toBeNull();
  });

  it('GET /agents/:name/key → 404 for A agent', async () => {
    await asB(api().get('/api/v1/agents/test-agent/key')).expect(404);
  });

  it('POST /agents/:name/rotate-key → 404 for A agent', async () => {
    await asB(api().post('/api/v1/agents/test-agent/rotate-key')).expect(404);
  });

  it('duplicate-preview and duplicate → 404 for A agent', async () => {
    await asB(api().get('/api/v1/agents/test-agent/duplicate-preview')).expect(404);
    await asB(api().post('/api/v1/agents/test-agent/duplicate'))
      .send({ name: 'stolen-copy' })
      .expect(404);
  });
});

/* ------------------------------------------------------------------ */
/*  Messages                                                           */
/* ------------------------------------------------------------------ */
describe('Messages — user B never sees tenant A rows', () => {
  it('message list contains B rows but not A rows', async () => {
    const res = await asB(api().get('/api/v1/messages?range=24h&limit=200')).expect(200);
    const ids = (res.body.items as Array<{ id: string }>).map((i) => i.id);
    expect(ids.length).toBeGreaterThan(0); // B's own row is visible
    expect(ids).not.toContain(A_MESSAGE_ID);
    for (const item of res.body.items as Array<{ agent_name: string }>) {
      expect(item.agent_name).not.toBe('test-agent');
    }
  });

  it('GET /messages/:id/details → 404 for A message', async () => {
    await asB(api().get(`/api/v1/messages/${A_MESSAGE_ID}/details`)).expect(404);
  });

  it('PATCH /messages/:id/feedback → 404 for A message (row not mutated)', async () => {
    await asB(api().patch(`/api/v1/messages/${A_MESSAGE_ID}/feedback`))
      .send({ rating: 'like' })
      .expect(404);
    const row = await ds.query(`SELECT feedback_rating FROM agent_messages WHERE id = $1`, [
      A_MESSAGE_ID,
    ]);
    expect(row[0].feedback_rating).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Notifications                                                      */
/* ------------------------------------------------------------------ */
describe('Notifications — user B cannot read or mutate tenant A rules', () => {
  it('listing rules for A agent name returns empty', async () => {
    const res = await asB(api().get('/api/v1/notifications?agent_name=test-agent')).expect(200);
    expect(res.body).toEqual([]);
  });

  it('creating a rule on A agent is rejected (agent not visible to B)', async () => {
    // The rules service rejects agents outside the caller's tenant with a 400
    // ("Agent not found") — what matters is that no rule is created on A.
    await asB(api().post('/api/v1/notifications'))
      .send({ agent_name: 'test-agent', metric_type: 'tokens', threshold: 1, period: 'day' })
      .expect(400);
    const rows = await ds.query(
      `SELECT id FROM notification_rules WHERE tenant_id = $1 AND threshold = 1`,
      [TEST_TENANT_ID],
    );
    expect(rows).toHaveLength(0);
  });

  it('updating A rule by id → 404 (rule unchanged)', async () => {
    await asB(api().patch(`/api/v1/notifications/${aRuleId}`))
      .send({ threshold: 1 })
      .expect(404);
    const row = await ds.query(`SELECT threshold FROM notification_rules WHERE id = $1`, [
      aRuleId,
    ]);
    expect(Number(row[0].threshold)).toBe(12345);
  });

  it('deleting A rule by id → 404 (rule survives)', async () => {
    await asB(api().delete(`/api/v1/notifications/${aRuleId}`)).expect(404);
    const row = await ds.query(`SELECT id FROM notification_rules WHERE id = $1`, [aRuleId]);
    expect(row).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Routing: tiers / providers / custom providers / header tiers       */
/* ------------------------------------------------------------------ */
describe('Routing — user B cannot reach tenant A routing config', () => {
  it('tiers endpoints on A agent → 404', async () => {
    await asB(api().get('/api/v1/routing/test-agent/tiers')).expect(404);
    await asB(api().put('/api/v1/routing/test-agent/tiers/simple'))
      .send({ model: 'gpt-4o-mini' })
      .expect(404);
  });

  it('provider endpoints on A agent → 404', async () => {
    await asB(api().get('/api/v1/routing/test-agent/providers')).expect(404);
    await asB(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai', apiKey: 'sk-evil' })
      .expect(404);
  });

  it('custom providers of tenant A are invisible from B agents', async () => {
    await asB(api().get('/api/v1/routing/test-agent/custom-providers')).expect(404);
    const own = await asB(api().get(`/api/v1/routing/${B_AGENT_NAME}/custom-providers`)).expect(
      200,
    );
    const ids = (own.body as Array<{ id: string }>).map((c) => c.id);
    expect(ids).not.toContain(A_CUSTOM_PROVIDER_ID);
  });

  it('deleting A custom provider through B agent → 404 (row survives)', async () => {
    await asB(
      api().delete(`/api/v1/routing/${B_AGENT_NAME}/custom-providers/${A_CUSTOM_PROVIDER_ID}`),
    ).expect(404);
    const row = await ds.query(`SELECT id FROM custom_providers WHERE id = $1`, [
      A_CUSTOM_PROVIDER_ID,
    ]);
    expect(row).toHaveLength(1);
  });

  it('header tiers on A agent → 404; A header tier id unreachable via B agent', async () => {
    await asB(api().get('/api/v1/routing/test-agent/header-tiers')).expect(404);
    await asB(
      api().patch(`/api/v1/routing/${B_AGENT_NAME}/header-tiers/${A_HEADER_TIER_ID}/toggle`),
    )
      .send({ enabled: false })
      .expect(404);
    await asB(
      api().delete(`/api/v1/routing/${B_AGENT_NAME}/header-tiers/${A_HEADER_TIER_ID}`),
    ).expect(404);
    const row = await ds.query(`SELECT id FROM header_tiers WHERE id = $1`, [A_HEADER_TIER_ID]);
    expect(row).toHaveLength(1);
  });

  it('enabled-providers: A agent unreadable, A connection unusable from B agent', async () => {
    const list = await asB(api().get('/api/v1/agents/test-agent/enabled-providers')).expect(200);
    expect(list.body).toEqual({ enabled: [] });
    await asB(
      api().put(`/api/v1/agents/${B_AGENT_NAME}/enabled-providers/${aProviderConnectionId}`),
    ).expect(404);
  });
});

/* ------------------------------------------------------------------ */
/*  Per-connection analytics                                           */
/* ------------------------------------------------------------------ */
describe('Provider analytics — user B cannot see tenant A per-connection data', () => {
  it('connection-detail for A connection id → empty shape (no A connection leaked)', async () => {
    const res = await asB(
      api().get('/api/v1/provider-analytics/connection-detail').query({
        connection_id: aProviderConnectionId,
      }),
    ).expect(200);
    // The connection lookup is tenant-scoped, so B sees the null/empty shape —
    // never tenant A's connection or its attributed messages.
    expect(res.body.connection).toBeNull();
    expect(res.body.recent_messages).toEqual([]);
    expect(res.body.model_usage).toEqual([]);
  });

  it('analytics scoped to A connection id → no A usage (B tenant only)', async () => {
    const res = await asB(
      api().get('/api/v1/provider-analytics').query({
        connection_id: aProviderConnectionId,
        range: '30d',
      }),
    ).expect(200);
    // connection_id rides as the tenant_provider_id filter, but the query is
    // still tenant-scoped to B — A's message attributed to that connection must
    // not surface in B's message/token counts.
    expect(res.body.summary.messages.value ?? 0).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Playground history                                                 */
/* ------------------------------------------------------------------ */
describe('Playground — user B cannot see tenant A runs', () => {
  it('run list for B is empty (A run invisible)', async () => {
    const res = await asB(api().get('/api/v1/playground/runs')).expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /playground/runs/:id → 404 for A run', async () => {
    await asB(api().get(`/api/v1/playground/runs/${A_RUN_ID}`)).expect(404);
  });

  it('PATCH /playground/runs/:id/best → 404 for A run', async () => {
    await asB(api().patch(`/api/v1/playground/runs/${A_RUN_ID}/best`))
      .send({ columnId: null })
      .expect(404);
  });
});

/* ------------------------------------------------------------------ */
/*  Sanity: tenant A still sees its own data                           */
/* ------------------------------------------------------------------ */
describe('Sanity — tenant A access is unaffected', () => {
  it('A sees its agent, message, rule and playground run', async () => {
    const agents = await asA(api().get('/api/v1/agents')).expect(200);
    const names = (agents.body.agents as Array<{ agent_name: string }>).map((a) => a.agent_name);
    expect(names).toContain('test-agent');

    const messages = await asA(api().get('/api/v1/messages?range=24h&limit=200')).expect(200);
    const ids = (messages.body.items as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toContain(A_MESSAGE_ID);

    const rules = await asA(api().get('/api/v1/notifications?agent_name=test-agent')).expect(200);
    expect((rules.body as Array<{ id: string }>).map((r) => r.id)).toContain(aRuleId);

    const runs = await asA(api().get('/api/v1/playground/runs')).expect(200);
    expect((runs.body as Array<{ id: string }>).map((r) => r.id)).toContain(A_RUN_ID);
  });
});
