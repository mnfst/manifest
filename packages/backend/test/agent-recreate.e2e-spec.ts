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
  it('does not surface deleted-agent data on a freshly recreated agent with the same name', async () => {
    const agentName = 'reusable-agent';

    // Create agent v1
    const createV1 = await request(app.getHttpServer())
      .post('/api/v1/agents')
      .set('x-api-key', TEST_API_KEY)
      .send({ name: agentName })
      .expect(201);
    const v1Id = createV1.body.agent.id as string;

    // Seed denormalised + agent_id-keyed rows for v1
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
    await ds.query(
      `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, agent_name, user_id, cost_usd)
       VALUES ($1, $2, $3, $4, 'ok', 'gpt-4o', 100, 50, 0, 0, $5, 'test-user-001', 0.001)`,
      [uuid(), TEST_TENANT_ID, v1Id, now, agentName],
    );
    await ds.query(
      `INSERT INTO tier_assignments (id, user_id, agent_id, tier, override_model, override_provider)
       VALUES ($1, 'test-user-001', $2, 'simple', 'gpt-4o-mini', 'openai')`,
      [uuid(), v1Id],
    );

    // Sanity: messages visible
    const before = await request(app.getHttpServer())
      .get(`/api/v1/messages?agent_name=${agentName}&range=24h`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(before.body.items.length).toBe(1);

    // Delete v1
    await request(app.getHttpServer())
      .delete(`/api/v1/agents/${agentName}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    // Orphan rows are gone
    const orphanMessages = await ds.query(
      `SELECT COUNT(*)::int AS count FROM agent_messages WHERE tenant_id = $1 AND agent_name = $2`,
      [TEST_TENANT_ID, agentName],
    );
    expect(orphanMessages[0].count).toBe(0);

    const orphanTiers = await ds.query(
      `SELECT COUNT(*)::int AS count FROM tier_assignments WHERE agent_id = $1`,
      [v1Id],
    );
    expect(orphanTiers[0].count).toBe(0);

    // Recreate v2 with the same slug
    const createV2 = await request(app.getHttpServer())
      .post('/api/v1/agents')
      .set('x-api-key', TEST_API_KEY)
      .send({ name: agentName })
      .expect(201);
    expect(createV2.body.agent.id).not.toBe(v1Id);

    // Messages list is empty
    const messages = await request(app.getHttpServer())
      .get(`/api/v1/messages?agent_name=${agentName}&range=24h`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(messages.body.items).toEqual([]);

    // Costs aggregate is empty
    const costs = await request(app.getHttpServer())
      .get(`/api/v1/costs?range=24h&agent_name=${agentName}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(costs.body.summary.weekly_cost.value).toBe(0);
    expect(costs.body.by_model).toEqual([]);

    // Tier list does not surface the v1 override
    const tiers = await request(app.getHttpServer())
      .get(`/api/v1/routing/${agentName}/tiers`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    const overridden = (tiers.body as Array<{ override_model: string | null }>).filter(
      (t) => t.override_model !== null,
    );
    expect(overridden).toEqual([]);
  });
});
