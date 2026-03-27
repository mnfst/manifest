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
    [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, now, 'ok', 'claude-opus-4-6', 2000, 1000, 0, 0, 'Chat message processed', 'agent', 'test-agent', 'test-user-001'],
  );

  await ds.query(
    `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, description, service_type, agent_name, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, now, 'error', 'gpt-4o', 500, 0, 0, 0, 'Browser scrape failed', 'browser', 'test-agent', 'test-user-001'],
  );

  await ds.query(
    `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, description, service_type, agent_name, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, now, 'ok', 'whisper-large', 0, 300, 0, 0, 'Voice transcription completed', 'voice', 'test-agent', 'test-user-001'],
  );
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/v1/messages', () => {
  it('returns paginated message list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total_count');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('returns message details with expected fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    const item = res.body.items[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('timestamp');
    expect(item).toHaveProperty('description');
    expect(item).toHaveProperty('service_type');
    expect(item).toHaveProperty('status');
  });

  it('filters by provider', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&provider=openai')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(
      res.body.items.every((item: Record<string, string>) => item['model'] === 'gpt-4o'),
    ).toBe(true);
  });

  it('filters by service_type', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&service_type=agent')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(
      res.body.items.every((item: Record<string, string>) => item['service_type'] === 'agent'),
    ).toBe(true);
  });

  it('respects limit parameter', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&limit=1')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body.items.length).toBeLessThanOrEqual(1);
  });

  it('supports cursor-based pagination', async () => {
    const res1 = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&limit=1')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    if (res1.body.next_cursor) {
      const res2 = await request(app.getHttpServer())
        .get(`/api/v1/messages?range=24h&limit=1&cursor=${res1.body.next_cursor}`)
        .set('x-api-key', TEST_API_KEY)
        .expect(200);

      expect(res2.body.items.length).toBeGreaterThan(0);
      expect(res2.body.items[0].id).not.toBe(res1.body.items[0].id);
    }
  });
});
