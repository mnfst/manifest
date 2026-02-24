import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';
import { detectDialect, portableSql, sqlNow } from '../src/common/utils/sql-dialect';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  // Seed model pricing data (delete first to replace rows seeded by helpers.ts)
  const ds = app.get(DataSource);
  const dialect = detectDialect(ds.options.type as string);
  const sql = (q: string) => portableSql(q, dialect);
  const now = sqlNow();
  const b = (v: boolean) => (dialect === 'sqlite' ? (v ? 1 : 0) : v);
  await ds.query('DELETE FROM model_pricing');
  await ds.query(
    sql(`INSERT INTO model_pricing (model_name, provider, input_price_per_token, output_price_per_token, context_window, capability_reasoning, capability_code, quality_score, updated_at)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9),
       ($10, $11, $12, $13, $14, $15, $16, $17, $18),
       ($19, $20, $21, $22, $23, $24, $25, $26, NULL)`),
    [
      'gpt-4o', 'OpenAI', 0.0000025, 0.00001, 128000, b(false), b(true), 3, now,
      'claude-opus-4-6', 'Anthropic', 0.000015, 0.000075, 200000, b(true), b(true), 5, now,
      'grok-3', 'xAI', 0.000003, 0.000015, 131072, b(true), b(true), 4,
    ],
  );
}, 30000);

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);

describe('GET /api/v1/model-prices', () => {
  it('should return models array with per-million pricing', async () => {
    const res = await auth(api().get('/api/v1/model-prices')).expect(200);

    expect(res.body).toHaveProperty('models');
    expect(res.body).toHaveProperty('lastSyncedAt');
    expect(Array.isArray(res.body.models)).toBe(true);
    expect(res.body.models.length).toBeGreaterThanOrEqual(3);
  });

  it('should include per-million pricing fields', async () => {
    const res = await auth(api().get('/api/v1/model-prices')).expect(200);

    const gpt4o = res.body.models.find(
      (m: { model_name: string }) => m.model_name === 'gpt-4o',
    );
    expect(gpt4o).toBeDefined();
    expect(gpt4o.provider).toBe('OpenAI');
    expect(gpt4o.input_price_per_million).toBeCloseTo(2.5, 1);
    expect(gpt4o.output_price_per_million).toBeCloseTo(10, 1);
  });

  it('should include models from all providers', async () => {
    const res = await auth(api().get('/api/v1/model-prices')).expect(200);

    const providers = new Set(
      res.body.models.map((m: { provider: string }) => m.provider),
    );
    expect(providers.has('OpenAI')).toBe(true);
    expect(providers.has('Anthropic')).toBe(true);
    expect(providers.has('xAI')).toBe(true);
  });

  it('should return a lastSyncedAt date for models with updated_at', async () => {
    const res = await auth(api().get('/api/v1/model-prices')).expect(200);

    // At least some models have updated_at set, so lastSyncedAt should be non-null
    expect(res.body.lastSyncedAt).not.toBeNull();
  });

  it('should reject request without auth with 401', async () => {
    await api().get('/api/v1/model-prices').expect(401);
  });
});
