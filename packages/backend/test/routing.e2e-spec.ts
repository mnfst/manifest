import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';
import { detectDialect, portableSql } from '../src/common/utils/sql-dialect';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  // Seed model pricing data so the auto-assign scoring has something to work with
  const ds = app.get(DataSource);
  const dialect = detectDialect(ds.options.type as string);
  const sql = (q: string) => portableSql(q, dialect);
  const b = (v: boolean) => (dialect === 'sqlite' ? (v ? 1 : 0) : v);
  await ds.query(
    sql(`INSERT INTO model_pricing (model_name, provider, input_price_per_token, output_price_per_token, context_window, capability_reasoning, capability_code)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7),
       ($8, $9, $10, $11, $12, $13, $14),
       ($15, $16, $17, $18, $19, $20, $21)`),
    [
      // Cheap OpenAI model
      'gpt-4o-mini', 'OpenAI', 0.00000015, 0.0000006, 128000, b(false), b(true),
      // Expensive Anthropic reasoning model
      'claude-opus-4-6', 'Anthropic', 0.000015, 0.000075, 200000, b(true), b(true),
      // Mid-range Anthropic model
      'claude-sonnet-4', 'Anthropic', 0.000003, 0.000015, 200000, b(false), b(true),
    ],
  );

  // Reload pricing cache so the service picks up the seeded data
  const { ModelPricingCacheService } = await import(
    '../src/model-prices/model-pricing-cache.service'
  );
  const cache = app.get(ModelPricingCacheService);
  await cache.reload();
}, 30000);

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);

describe('Routing E2E', () => {
  describe('Connect a provider → tiers are auto-assigned', () => {
    it('should connect OpenAI provider', async () => {
      const res = await auth(
        api().post('/api/v1/routing/providers'),
      )
        .send({ provider: 'openai', apiKey: 'sk-test-key' })
        .expect(201);

      expect(res.body.provider).toBe('openai');
      expect(res.body.is_active).toBe(true);
    });

    it('should have auto-assigned gpt-4o-mini to all tiers', async () => {
      const res = await auth(api().get('/api/v1/routing/tiers')).expect(200);

      expect(res.body).toHaveLength(4);
      for (const tier of res.body) {
        expect(tier.auto_assigned_model).toBe('gpt-4o-mini');
        expect(tier.override_model).toBeNull();
      }
    });
  });

  describe('Override a tier → stays stable on recalculation', () => {
    it('should set override on complex tier', async () => {
      const res = await auth(
        api().put('/api/v1/routing/tiers/complex'),
      )
        .send({ model: 'gpt-4o-mini' })
        .expect(200);

      expect(res.body.tier).toBe('complex');
      expect(res.body.override_model).toBe('gpt-4o-mini');
    });

    it('should keep override after adding another provider', async () => {
      // Connect Anthropic
      await auth(api().post('/api/v1/routing/providers'))
        .send({ provider: 'anthropic', apiKey: 'sk-ant-test' })
        .expect(201);

      // Override on complex should remain
      const res = await auth(api().get('/api/v1/routing/tiers')).expect(200);
      const complex = res.body.find(
        (t: { tier: string }) => t.tier === 'complex',
      );
      expect(complex.override_model).toBe('gpt-4o-mini');

      // Auto-assigned may have changed for other tiers
      // (cheapest model is still gpt-4o-mini in simple/standard)
    });
  });

  describe('Disconnect provider with override → revert to auto + notification', () => {
    it('should override complex tier with an Anthropic model', async () => {
      await auth(api().put('/api/v1/routing/tiers/complex'))
        .send({ model: 'claude-opus-4-6' })
        .expect(200);

      // Verify override is set
      const res = await auth(api().get('/api/v1/routing/tiers')).expect(200);
      const complex = res.body.find(
        (t: { tier: string }) => t.tier === 'complex',
      );
      expect(complex.override_model).toBe('claude-opus-4-6');
    });

    it('should return notification when disconnecting Anthropic', async () => {
      const res = await auth(
        api().delete('/api/v1/routing/providers/anthropic'),
      ).expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.notifications).toHaveLength(1);
      expect(res.body.notifications[0]).toContain('claude-opus-4-6');
      expect(res.body.notifications[0]).toContain('Complex');
      expect(res.body.notifications[0]).toContain('automatic mode');
    });

    it('should have cleared the override and reverted to auto', async () => {
      const res = await auth(api().get('/api/v1/routing/tiers')).expect(200);
      const complex = res.body.find(
        (t: { tier: string }) => t.tier === 'complex',
      );
      expect(complex.override_model).toBeNull();
      // auto should now be gpt-4o-mini (only openai left)
      expect(complex.auto_assigned_model).toBe('gpt-4o-mini');
    });
  });

  describe('Full cycle: connect → override → disconnect → reconnect', () => {
    it('should reconnect Anthropic', async () => {
      await auth(api().post('/api/v1/routing/providers'))
        .send({ provider: 'anthropic', apiKey: 'sk-ant-new' })
        .expect(201);
    });

    it('should have auto-assigned models from both providers', async () => {
      const res = await auth(api().get('/api/v1/routing/tiers')).expect(200);

      // All tiers should have some auto-assigned model
      for (const tier of res.body) {
        expect(tier.auto_assigned_model).not.toBeNull();
      }
    });

    it('should override reasoning tier', async () => {
      await auth(api().put('/api/v1/routing/tiers/reasoning'))
        .send({ model: 'claude-opus-4-6' })
        .expect(200);
    });

    it('should clear the override with reset', async () => {
      await auth(api().delete('/api/v1/routing/tiers/reasoning')).expect(200);

      const res = await auth(api().get('/api/v1/routing/tiers')).expect(200);
      const reasoning = res.body.find(
        (t: { tier: string }) => t.tier === 'reasoning',
      );
      expect(reasoning.override_model).toBeNull();
      expect(reasoning.auto_assigned_model).not.toBeNull();
    });

    it('should reset all overrides at once', async () => {
      // Set multiple overrides
      await auth(api().put('/api/v1/routing/tiers/simple'))
        .send({ model: 'gpt-4o-mini' })
        .expect(200);
      await auth(api().put('/api/v1/routing/tiers/complex'))
        .send({ model: 'claude-opus-4-6' })
        .expect(200);

      // Reset all
      await auth(api().post('/api/v1/routing/tiers/reset-all')).expect(201);

      const res = await auth(api().get('/api/v1/routing/tiers')).expect(200);
      for (const tier of res.body) {
        expect(tier.override_model).toBeNull();
      }
    });
  });

  describe('Available models endpoint', () => {
    it('should return all seeded models', async () => {
      const res = await auth(
        api().get('/api/v1/routing/available-models'),
      ).expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(3);
      const names = res.body.map((m: { model_name: string }) => m.model_name);
      expect(names).toContain('gpt-4o-mini');
      expect(names).toContain('claude-opus-4-6');
    });

    it('should include capability fields', async () => {
      const res = await auth(
        api().get('/api/v1/routing/available-models'),
      ).expect(200);

      const opus = res.body.find(
        (m: { model_name: string }) => m.model_name === 'claude-opus-4-6',
      );
      expect(opus.capability_reasoning).toBe(true);
      expect(opus.capability_code).toBe(true);
      expect(opus.context_window).toBe(200000);
    });
  });

  describe('Providers list', () => {
    it('should list connected providers without API keys', async () => {
      const res = await auth(
        api().get('/api/v1/routing/providers'),
      ).expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const openai = res.body.find(
        (p: { provider: string }) => p.provider === 'openai',
      );
      expect(openai).toBeDefined();
      expect(openai.is_active).toBe(true);
      // Should NOT expose the API key
      expect(openai.api_key_encrypted).toBeUndefined();
    });
  });
});
