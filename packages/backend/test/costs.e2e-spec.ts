import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_API_KEY, TEST_USER_ID, TEST_TENANT_ID } from './helpers';
import { sqlNow } from '../src/common/utils/sql-dialect';
import { v4 as uuid } from 'uuid';
import { PricingSyncService } from '../src/database/pricing-sync.service';
import { ModelPricingCacheService } from '../src/model-prices/model-pricing-cache.service';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  const ds = app.get(DataSource);
  const now = sqlNow();

  // Populate PricingSyncService cache with gpt-4o pricing
  const pricingSync = app.get(PricingSyncService);
  (pricingSync.getAll() as Map<string, { input: number; output: number; contextWindow?: number }>).set('openai/gpt-4o', {
    input: 0.0000025,
    output: 0.00001,
    contextWindow: 128000,
  });

  // Reload pricing cache from OpenRouter cache + manual pricing
  await app.get(ModelPricingCacheService).reload();

  // Seed agent_messages directly (with pre-calculated cost_usd) using the same
  // timestamp format as sqlNow() so that date comparisons work in both PG & sql.js.
  const costUsd1 = 5000 * 0.0000025 + 2000 * 0.00001; // 0.0325
  const costUsd2 = 3000 * 0.0000025 + 1000 * 0.00001; // 0.0175
  await ds.query(
    `INSERT INTO agent_messages (id, timestamp, description, service_type, status, model, input_tokens, output_tokens, cost_usd, user_id, tenant_id, agent_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [uuid(), now, 'Cost query 1', 'agent', 'ok', 'gpt-4o', 5000, 2000, costUsd1, TEST_USER_ID, TEST_TENANT_ID, null],
  );
  await ds.query(
    `INSERT INTO agent_messages (id, timestamp, description, service_type, status, model, input_tokens, output_tokens, cost_usd, user_id, tenant_id, agent_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [uuid(), now, 'Cost query 2', 'agent', 'ok', 'gpt-4o', 3000, 1000, costUsd2, TEST_USER_ID, TEST_TENANT_ID, null],
  );
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
