import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import request from 'supertest';
import { createTestApp, TEST_API_KEY, TEST_TENANT_ID } from './helpers';

let app: INestApplication;
let ds: DataSource;

beforeAll(async () => {
  app = await createTestApp();
  ds = app.get(DataSource);
});

afterAll(async () => {
  await app.close();
});

describe('agent delete + recreate (issue #1765)', () => {
  it('keeps deleted-agent data in storage but does not surface it on the recreated agent', async () => {
    const agentName = 'reusable-agent';

    // Create v1
    const createV1 = await request(app.getHttpServer())
      .post('/api/v1/agents')
      .set('x-api-key', TEST_API_KEY)
      .send({ name: agentName })
      .expect(201);
    const v1Id = createV1.body.agent.id as string;

    // Seed v1 telemetry + a routing override
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
    await ds.query(
      `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, agent_name, user_id, cost_usd)
       VALUES ($1, $2, $3, $4, 'ok', 'gpt-4o', 100, 50, 0, 0, $5, 'test-user-001', 0.001)`,
      [uuid(), TEST_TENANT_ID, v1Id, now, agentName],
    );
    await ds.query(
      `INSERT INTO tier_assignments (id, user_id, agent_id, tier, override_route)
       VALUES ($1, 'test-user-001', $2, 'simple', $3::jsonb)`,
      [
        uuid(),
        v1Id,
        JSON.stringify({ provider: 'openai', authType: 'api_key', model: 'gpt-4o-mini' }),
      ],
    );

    // Sanity: messages visible
    const before = await request(app.getHttpServer())
      .get(`/api/v1/messages?agent_name=${agentName}&range=24h`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(before.body.items.length).toBe(1);

    // Delete v1 (soft)
    await request(app.getHttpServer())
      .delete(`/api/v1/agents/${agentName}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    // Data is preserved in storage
    const remainingMessages = await ds.query(
      `SELECT COUNT(*)::int AS count FROM agent_messages WHERE tenant_id = $1 AND agent_id = $2`,
      [TEST_TENANT_ID, v1Id],
    );
    expect(remainingMessages[0].count).toBe(1);

    const remainingTiers = await ds.query(
      `SELECT COUNT(*)::int AS count FROM tier_assignments WHERE agent_id = $1`,
      [v1Id],
    );
    expect(remainingTiers[0].count).toBe(1);

    // The agent row is soft-deleted, not removed
    const agentRow = await ds.query(
      `SELECT deleted_at, is_active FROM agents WHERE id = $1`,
      [v1Id],
    );
    expect(agentRow).toHaveLength(1);
    expect(agentRow[0].deleted_at).not.toBeNull();
    expect(agentRow[0].is_active).toBe(false);

    // Recreate v2 with the same slug
    const createV2 = await request(app.getHttpServer())
      .post('/api/v1/agents')
      .set('x-api-key', TEST_API_KEY)
      .send({ name: agentName })
      .expect(201);
    expect(createV2.body.agent.id).not.toBe(v1Id);

    // Per-agent messages are empty on the new agent
    const messages = await request(app.getHttpServer())
      .get(`/api/v1/messages?agent_name=${agentName}&range=24h`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(messages.body.items).toEqual([]);

    // Per-agent costs are zero
    const costs = await request(app.getHttpServer())
      .get(`/api/v1/costs?range=24h&agent_name=${agentName}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(costs.body.summary.weekly_cost.value).toBe(0);
    expect(costs.body.by_model).toEqual([]);

    // Per-agent routing tiers do not surface the v1 override
    const tiers = await request(app.getHttpServer())
      .get(`/api/v1/routing/${agentName}/tiers`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    const overridden = (tiers.body as Array<{ override_route: unknown | null }>).filter(
      (t) => t.override_route !== null,
    );
    expect(overridden).toEqual([]);

    // Agent list shows only the live recreated agent (zero stats)
    const agents = await request(app.getHttpServer())
      .get('/api/v1/agents')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    const matches = (agents.body.agents as Array<{ agent_name: string; message_count: number }>)
      .filter((a) => a.agent_name === agentName);
    expect(matches).toHaveLength(1);
    expect(matches[0].message_count).toBe(0);
  });
});
