import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  // Seed model pricing so costs can be calculated
  const ds = app.get(DataSource);
  await ds.query(
    `INSERT INTO model_pricing (model_name, provider, input_price_per_token, output_price_per_token, context_window)
     VALUES ($1, $2, $3, $4, $5)`,
    ['gpt-4o', 'OpenAI', 0.0000025, 0.00001, 128000],
  );

  // Reload pricing cache so telemetry can calculate cost_usd
  const { ModelPricingCacheService } = await import(
    '../src/model-prices/model-pricing-cache.service'
  );
  await app.get(ModelPricingCacheService).reload();

  // Seed agent_messages for cost data (use telemetry API like other E2E tests)
  await request(app.getHttpServer())
    .post('/api/v1/telemetry')
    .set('x-api-key', TEST_API_KEY)
    .send({
      events: [
        {
          timestamp: new Date().toISOString(),
          description: 'Cost query 1',
          service_type: 'agent',
          status: 'ok',
          model: 'gpt-4o',
          input_tokens: 5000,
          output_tokens: 2000,
        },
        {
          timestamp: new Date().toISOString(),
          description: 'Cost query 2',
          service_type: 'agent',
          status: 'ok',
          model: 'gpt-4o',
          input_tokens: 3000,
          output_tokens: 1000,
        },
      ],
    });
}, 30000);

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);

describe('GET /api/v1/costs', () => {
  it('should return cost data with all sections', async () => {
    const res = await auth(api().get('/api/v1/costs?range=24h')).expect(200);

    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('weekly_cost');
    expect(res.body).toHaveProperty('daily');
    expect(res.body).toHaveProperty('hourly');
    expect(res.body).toHaveProperty('by_model');
    expect(Array.isArray(res.body.daily)).toBe(true);
    expect(Array.isArray(res.body.hourly)).toBe(true);
    expect(Array.isArray(res.body.by_model)).toBe(true);
  });

  it('should return non-zero cost from seeded data', async () => {
    const res = await auth(api().get('/api/v1/costs?range=24h')).expect(200);

    const totalCost = Number(res.body.summary.weekly_cost.value);
    expect(totalCost).toBeGreaterThan(0);
  });

  it('should accept different range values', async () => {
    for (const range of ['1h', '6h', '24h', '7d', '30d']) {
      const res = await auth(
        api().get(`/api/v1/costs?range=${range}`),
      ).expect(200);
      expect(res.body).toHaveProperty('summary');
    }
  });

  it('should filter by agent_name', async () => {
    const res = await auth(
      api().get('/api/v1/costs?range=24h&agent_name=test-agent'),
    ).expect(200);

    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary.weekly_cost).toHaveProperty('value');
  });

  it('should return zero cost for unknown agent', async () => {
    const res = await auth(
      api().get('/api/v1/costs?range=24h&agent_name=nonexistent'),
    ).expect(200);

    const totalCost = Number(res.body.summary.weekly_cost.value);
    expect(totalCost).toBe(0);
  });

  it('should default to 7d range when not specified', async () => {
    const res = await auth(api().get('/api/v1/costs')).expect(200);
    expect(res.body).toHaveProperty('summary');
  });

  it('should reject invalid range value', async () => {
    await auth(api().get('/api/v1/costs?range=99d')).expect(400);
  });

  it('should reject request without auth with 401', async () => {
    await api().get('/api/v1/costs?range=24h').expect(401);
  });
});
