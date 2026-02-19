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
          description: 'User query processed',
          service_type: 'agent',
          status: 'ok',
          model: 'claude-opus-4-6',
          input_tokens: 2000,
          output_tokens: 1000,
        },
        {
          timestamp: new Date().toISOString(),
          description: 'Browser task completed',
          service_type: 'browser',
          status: 'ok',
          model: 'gpt-4o',
          input_tokens: 500,
          output_tokens: 300,
        },
      ],
    });
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
    expect(typeof res.body.has_data).toBe('boolean');
  });

  it('returns cost by model', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/overview?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('cost_by_model');
    expect(Array.isArray(res.body.cost_by_model)).toBe(true);
  });

  it('returns recent activity', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/overview?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('recent_activity');
    expect(Array.isArray(res.body.recent_activity)).toBe(true);
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
