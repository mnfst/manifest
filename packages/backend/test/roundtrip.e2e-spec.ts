import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { createTestApp, TEST_API_KEY, TEST_TENANT_ID, TEST_AGENT_ID } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('Proxy data round-trip', () => {
  beforeAll(async () => {
    const ds = app.get(DataSource);
    await ds.query(
      `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, agent_name, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, new Date().toISOString(), 'ok', 'claude-opus-4-6', 1500, 800, 0, 0, 'demo-agent', 'test-user-001'],
    );
  });

  it('overview reflects ingested data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/overview?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body.has_data).toBe(true);
    expect(res.body.summary.tokens_today.value).toBeGreaterThan(0);
    expect(res.body.summary.messages.value).toBeGreaterThan(0);
  });

  it('tokens endpoint reflects ingested data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tokens?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body.summary.total_tokens.value).toBeGreaterThan(0);
  });
});

describe('Clock skew tolerance', () => {
  beforeAll(async () => {
    const ds = app.get(DataSource);
    const futureTs = new Date(Date.now() + 30_000).toISOString();
    await ds.query(
      `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, agent_name, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, futureTs, 'ok', 'gpt-4o', 500, 200, 0, 0, 'demo-agent', 'test-user-001'],
    );
  });

  it('future-timestamped data is visible in overview', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/overview?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    // Future-timestamped data must not be filtered out (catches timestamp <= :now bug)
    expect(res.body.has_data).toBe(true);
    expect(res.body.summary.messages.value).toBeGreaterThan(0);
  });
});
