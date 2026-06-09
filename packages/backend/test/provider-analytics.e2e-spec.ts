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

let app: INestApplication;
let connectionId: string;

beforeAll(async () => {
  app = await createTestApp();
  const ds = app.get(DataSource);
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

  // A user-global OpenAI connection (agent_id NULL = global under the new schema).
  connectionId = uuid();
  await ds.query(
    `INSERT INTO user_providers (id, user_id, agent_id, provider, key_prefix, auth_type, label, is_active, connected_at, updated_at, cached_models)
     VALUES ($1,$2,NULL,$3,$4,$5,$6,true,$7,$7,$8)`,
    [
      connectionId,
      TEST_USER_ID,
      'openai',
      'sk-abc',
      'subscription',
      'My OpenAI',
      now,
      JSON.stringify([{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }]),
    ],
  );

  // Subscription-auth messages on openai for the test agent.
  for (const [model, inTok, outTok] of [
    ['gpt-4o', 1000, 500],
    ['gpt-4o-mini', 200, 100],
  ] as Array<[string, number, number]>) {
    await ds.query(
      `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, provider, auth_type, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd, description, service_type, agent_name, user_id)
       VALUES ($1,$2,$3,$4,'ok',$5,'openai','subscription',$6,$7,0,0,$8,'msg','agent','test-agent',$9)`,
      [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, now, model, inTok, outTok, 0.01, TEST_USER_ID],
    );
  }
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/v1/provider-analytics', () => {
  it('returns summary + token/message usage for subscription auth', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/provider-analytics?auth_type=subscription&range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('token_usage');
    expect(res.body).toHaveProperty('message_usage');
    expect(res.body.summary.messages.value).toBeGreaterThan(0);
  });

  it('supports the agents endpoint', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/provider-analytics/agents?auth_type=subscription')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.agents).toContain('test-agent');
  });

  it('returns per-agent token timeseries pivots', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/provider-analytics/per-agent-timeseries?auth_type=subscription&provider=openai')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body).toHaveProperty('agents');
    expect(res.body).toHaveProperty('timeseries');
    expect(res.body.agents).toContain('test-agent');
  });

  it('returns per-agent message + cost timeseries', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/v1/provider-analytics/per-agent-message-timeseries?auth_type=subscription&provider=openai',
      )
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    await request(app.getHttpServer())
      .get(
        '/api/v1/provider-analytics/per-agent-cost-timeseries?auth_type=subscription&provider=openai&range=7d',
      )
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
  });

  it('returns connection detail for an owned connection', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/provider-analytics/connection-detail?connection_id=${connectionId}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body.connection).toMatchObject({
      id: connectionId,
      provider: 'openai',
      auth_type: 'subscription',
      cached_model_count: 2,
    });
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.agents.some((a: { agent_name: string }) => a.agent_name === 'test-agent')).toBe(
      true,
    );
    expect(Array.isArray(res.body.model_usage)).toBe(true);
    expect(res.body.model_usage.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.recent_messages)).toBe(true);
  });

  it('returns an empty shape for a missing connection_id', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/provider-analytics/connection-detail')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body).toEqual({ connection: null, agents: [], recent_messages: [] });
  });

  it('returns an empty shape for a connection that does not belong to the user', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/provider-analytics/connection-detail?connection_id=${uuid()}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body.connection).toBeNull();
  });
});

describe('GET /api/v1/overview/per-* timeseries', () => {
  it('exposes per-agent, per-provider and per-model overview timeseries', async () => {
    const paths = [
      'per-agent-timeseries',
      'per-agent-message-timeseries',
      'per-agent-cost-timeseries',
      'per-provider-timeseries',
      'per-provider-message-timeseries',
      'per-provider-cost-timeseries',
      'per-model-timeseries',
      'per-model-message-timeseries',
      'per-model-cost-timeseries',
    ];
    for (const p of paths) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/overview/${p}?range=24h`)
        .set('x-api-key', TEST_API_KEY)
        .expect(200);
      expect(res.body).toHaveProperty('agents');
      expect(res.body).toHaveProperty('timeseries');
    }
  });
});

describe('GET /api/v1/rate-limits', () => {
  it('returns an empty providers list when nothing has been captured', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/rate-limits')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body).toHaveProperty('providers');
    expect(Array.isArray(res.body.providers)).toBe(true);
  });
});
