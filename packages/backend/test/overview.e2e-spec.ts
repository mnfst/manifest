import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import request from 'supertest';
import { createTestApp, TEST_API_KEY, TEST_TENANT_ID, TEST_AGENT_ID } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  // Seed test data via direct DB inserts
  const ds = app.get(DataSource);
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

  await ds.query(
    `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, description, service_type, agent_name, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, now, 'ok', 'claude-opus-4-6', 2000, 1000, 0, 0, 'User query processed', 'agent', 'test-agent', 'test-user-001'],
  );

  await ds.query(
    `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, description, service_type, agent_name, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, now, 'ok', 'gpt-4o', 500, 300, 0, 0, 'Browser task completed', 'browser', 'test-agent', 'test-user-001'],
  );
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/v1/overview', () => {
  it('returns overview data with summary cards', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/overview?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('tokens_today');
    expect(res.body.summary).toHaveProperty('cost_today');
    expect(res.body.summary).toHaveProperty('messages');
    expect(res.body.summary.tokens_today).toHaveProperty('value');
    expect(res.body.summary.tokens_today).toHaveProperty('trend_pct');
    expect(res.body.has_data).toBe(true);
    expect(res.body.summary.tokens_today.value).toBeGreaterThan(0);
    expect(res.body.summary.messages.value).toBeGreaterThan(0);
  });

  it('returns cost by model with data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/overview?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('cost_by_model');
    expect(Array.isArray(res.body.cost_by_model)).toBe(true);
    expect(res.body.cost_by_model.length).toBeGreaterThan(0);
  });

  it('returns recent activity with data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/overview?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('recent_activity');
    expect(Array.isArray(res.body.recent_activity)).toBe(true);
    expect(res.body.recent_activity.length).toBeGreaterThan(0);
  });

  it('returns token usage data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/overview?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('token_usage');
    expect(Array.isArray(res.body.token_usage)).toBe(true);
  });

  it('accepts time range parameter', async () => {
    for (const range of ['1h', '6h', '24h', '7d', '30d']) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/overview?range=${range}`)
        .set('x-api-key', TEST_API_KEY)
        .expect(200);
      expect(res.body).toHaveProperty('summary');
    }
  });

  it('rejects request without API key with 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/overview?range=24h')
      .expect(401);
  });
});
