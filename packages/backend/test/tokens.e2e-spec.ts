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
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, now, 'ok', 'claude-opus-4-6', 3000, 1500, 0, 0, 'Query 1', 'agent', 'test-agent', 'test-user-001'],
  );

  await ds.query(
    `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, description, service_type, agent_name, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, now, 'ok', 'gpt-4o', 1000, 500, 0, 0, 'Query 2', 'agent', 'test-agent', 'test-user-001'],
  );
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/v1/tokens', () => {
  it('returns token summary with totals', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tokens?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('total_tokens');
    expect(res.body.summary).toHaveProperty('input_tokens');
    expect(res.body.summary).toHaveProperty('output_tokens');
    expect(res.body.summary.total_tokens.value).toBeGreaterThan(0);
  });

  it('returns hourly breakdown with data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tokens?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('hourly');
    expect(Array.isArray(res.body.hourly)).toBe(true);
    expect(res.body.hourly.length).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/costs', () => {
  it('returns cost summary with weekly total', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/costs?range=7d')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('weekly_cost');
    expect(res.body.summary.weekly_cost).toHaveProperty('value');
  });

  it('returns daily cost breakdown', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/costs?range=7d')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('daily');
    expect(Array.isArray(res.body.daily)).toBe(true);
  });

  it('returns cost by model', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/costs?range=7d')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('by_model');
    expect(Array.isArray(res.body.by_model)).toBe(true);
  });
});
