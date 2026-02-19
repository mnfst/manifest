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
          description: 'Query 1',
          service_type: 'agent',
          status: 'ok',
          model: 'claude-opus-4-6',
          input_tokens: 3000,
          output_tokens: 1500,
        },
        {
          timestamp: new Date().toISOString(),
          description: 'Query 2',
          service_type: 'agent',
          status: 'ok',
          model: 'gpt-4o',
          input_tokens: 1000,
          output_tokens: 500,
        },
      ],
    });
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
    expect(res.body.summary.total_tokens).toHaveProperty('value');
  });

  it('returns hourly breakdown', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tokens?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('hourly');
    expect(Array.isArray(res.body.hourly)).toBe(true);
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
