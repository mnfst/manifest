import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  // Seed test data
  await request(app.getHttpServer())
    .post('/api/v1/telemetry')
    .set('x-api-key', TEST_API_KEY)
    .send({
      events: [
        {
          timestamp: new Date().toISOString(),
          description: 'Chat message processed',
          service_type: 'agent',
          status: 'ok',
          model: 'claude-opus-4-6',
          input_tokens: 2000,
          output_tokens: 1000,
        },
        {
          timestamp: new Date().toISOString(),
          description: 'Browser scrape failed',
          service_type: 'browser',
          status: 'error',
          model: 'gpt-4o',
          input_tokens: 500,
          output_tokens: 0,
        },
        {
          timestamp: new Date().toISOString(),
          description: 'Voice transcription completed',
          service_type: 'voice',
          status: 'ok',
          model: 'whisper-large',
          input_tokens: 0,
          output_tokens: 300,
        },
      ],
    });
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

  it('filters by status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&status=error')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(
      res.body.items.every((item: Record<string, string>) => item['status'] === 'error'),
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
