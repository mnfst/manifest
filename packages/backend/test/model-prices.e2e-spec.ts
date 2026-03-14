import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';
import { PricingSyncService } from '../src/database/pricing-sync.service';
import { ModelPricingCacheService } from '../src/model-prices/model-pricing-cache.service';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  // Populate PricingSyncService cache with test models using prefixed keys
  // (provider/model format) so ModelPricingCacheService.inferProvider() works
  const pricingSync = app.get(PricingSyncService);
  const orCache = pricingSync.getAll();
  orCache.set('openai/gpt-4o', { input: 0.0000025, output: 0.00001, contextWindow: 128000 });
  orCache.set('anthropic/claude-opus-4-6', { input: 0.000015, output: 0.000075, contextWindow: 200000 });
  orCache.set('xai/grok-3', { input: 0.000003, output: 0.000015, contextWindow: 131072 });

  // Reload pricing cache from OpenRouter cache + manual pricing
  await app.get(ModelPricingCacheService).reload();
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
      (m: { model_name: string }) => m.model_name === 'openai/gpt-4o',
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

  it('should return lastSyncedAt field (null when cache populated manually)', async () => {
    const res = await auth(api().get('/api/v1/model-prices')).expect(200);

    // lastSyncedAt is null when models come from manually seeded cache (no OpenRouter sync)
    expect(res.body).toHaveProperty('lastSyncedAt');
  });

  it('should reject request without auth with 401', async () => {
    await api().get('/api/v1/model-prices').expect(401);
  });
});
