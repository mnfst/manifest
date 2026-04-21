/**
 * End-to-end test validating:
 * 1. Routing DISABLED → resolve returns null model (OpenClaw falls back to Gemini)
 * 2. Routing ENABLED  → scorer picks tier based on query complexity and returns a model
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_AGENT_ID, TEST_API_KEY, TEST_OTLP_KEY, TEST_USER_ID } from './helpers';
import { PricingSyncService } from '../src/database/pricing-sync.service';
import { ModelPricingCacheService } from '../src/model-prices/model-pricing-cache.service';
import { TierAutoAssignService } from '../src/routing/routing-core/tier-auto-assign.service';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  // Populate PricingSyncService cache with test models (use prefixed keys
  // so ModelPricingCacheService.inferProvider() resolves the correct provider name)
  const pricingSync = app.get(PricingSyncService);
  const orCache = pricingSync.getAll() as Map<string, { input: number; output: number; contextWindow?: number }>;
  orCache.set('openai/gpt-4o-mini', {
    input: 0.00000015,
    output: 0.0000006,
    contextWindow: 128000,
  });
  orCache.set('anthropic/claude-opus-4-6', {
    input: 0.000015,
    output: 0.000075,
    contextWindow: 200000,
  });
  orCache.set('anthropic/claude-sonnet-4', {
    input: 0.000003,
    output: 0.000015,
    contextWindow: 200000,
  });

  // Reload pricing cache from OpenRouter cache + manual pricing
  await app.get(ModelPricingCacheService).reload();
}, 30000);

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);
const bearer = (r: request.Test) =>
  r.set('Authorization', `Bearer ${TEST_OTLP_KEY}`);

describe('Routing disabled → null model (OpenClaw uses Gemini default)', () => {
  it('resolve returns null model/provider when no providers connected', async () => {
    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({ messages: [{ role: 'user', content: 'hello' }] })
      .expect(200);

    expect(res.body.model).toBeNull();
    expect(res.body.provider).toBeNull();
    expect(res.body.tier).toBeDefined();
    expect(res.body.score).toBeDefined();
  });

  it('resolve returns null for complex queries too when disabled', async () => {
    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({
        messages: [
          {
            role: 'user',
            content:
              'Write a distributed microservice architecture with Kubernetes, implement authentication middleware with OAuth2, and deploy with a CI/CD pipeline',
          },
        ],
      })
      .expect(200);

    // Scorer still runs and classifies complexity correctly...
    expect(['complex', 'reasoning']).toContain(res.body.tier);
    // ...but no model is assigned because routing is disabled
    expect(res.body.model).toBeNull();
    expect(res.body.provider).toBeNull();
  });
});

describe('Routing enabled → scorer routes by query complexity', () => {
  beforeAll(async () => {
    await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai' })
      .expect(201);
    await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'anthropic' })
      .expect(201);

    // Seed discovered models on provider records so tier auto-assign can pick them
    const ds = app.get(DataSource);

    const openaiModels = JSON.stringify([
      {
        id: 'gpt-4o-mini',
        displayName: 'gpt-4o-mini',
        provider: 'openai',
        contextWindow: 128000,
        inputPricePerToken: 0.00000015,
        outputPricePerToken: 0.0000006,
        capabilityReasoning: false,
        capabilityCode: true,
        qualityScore: 2,
      },
    ]);
    const anthropicModels = JSON.stringify([
      {
        id: 'claude-opus-4-6',
        displayName: 'claude-opus-4-6',
        provider: 'anthropic',
        contextWindow: 200000,
        inputPricePerToken: 0.000015,
        outputPricePerToken: 0.000075,
        capabilityReasoning: true,
        capabilityCode: true,
        qualityScore: 5,
      },
      {
        id: 'claude-sonnet-4',
        displayName: 'claude-sonnet-4',
        provider: 'anthropic',
        contextWindow: 200000,
        inputPricePerToken: 0.000003,
        outputPricePerToken: 0.000015,
        capabilityReasoning: false,
        capabilityCode: true,
        qualityScore: 4,
      },
    ]);
    await ds.query(
      `UPDATE user_providers SET cached_models = $1 WHERE agent_id = $2 AND provider = $3`,
      [openaiModels, TEST_AGENT_ID, 'openai'],
    );
    await ds.query(
      `UPDATE user_providers SET cached_models = $1 WHERE agent_id = $2 AND provider = $3`,
      [anthropicModels, TEST_AGENT_ID, 'anthropic'],
    );

    // Recalculate tier assignments with the seeded models
    const autoAssign = app.get(TierAutoAssignService);
    await autoAssign.recalculate(TEST_AGENT_ID);
  });

  it('routes "hi" → simple tier with cheapest model', async () => {
    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({ messages: [{ role: 'user', content: 'hi' }] })
      .expect(200);

    expect(res.body.tier).toBe('simple');
    expect(res.body.model).toBe('gpt-4o-mini');
    expect(res.body.provider.toLowerCase()).toContain('open');
    expect(res.body.confidence).toBeGreaterThan(0.8);
  });

  it('routes "thanks" → simple tier', async () => {
    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({ messages: [{ role: 'user', content: 'thanks' }] })
      .expect(200);

    expect(res.body.tier).toBe('simple');
    expect(res.body.model).not.toBeNull();
  });

  it('routes "what is a dog" → simple tier', async () => {
    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({ messages: [{ role: 'user', content: 'what is a dog' }] })
      .expect(200);

    expect(res.body.tier).toBe('simple');
    expect(res.body.model).not.toBeNull();
  });

  it('routes complex React request → complex tier with high-quality model', async () => {
    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({
        messages: [
          {
            role: 'user',
            content:
              'Write a React component that fetches user data from an API, handles loading states with a skeleton UI, implements pagination with infinite scroll, and renders a sortable table with filtering',
          },
        ],
      })
      .expect(200);

    expect(['complex', 'reasoning']).toContain(res.body.tier);
    expect(res.body.model).not.toBeNull();
    expect(res.body.provider).not.toBeNull();
    // Complex tier should pick a high-quality model (not gpt-4o-mini)
    expect(res.body.model).not.toBe('gpt-4o-mini');
  });

  it('routes math proof → reasoning tier with reasoning-capable model', async () => {
    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({
        messages: [
          {
            role: 'user',
            content:
              'Prove by induction that the sum of first n naturals equals n(n+1)/2, then derive the closed form',
          },
        ],
      })
      .expect(200);

    expect(res.body.tier).toBe('reasoning');
    expect(res.body.model).toBe('claude-opus-4-6');
    expect(res.body.provider.toLowerCase()).toContain('anthropic');
    expect(res.body.confidence).toBeGreaterThan(0.9);
  });

  it('routes multi-step security audit → complex tier', async () => {
    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({
        messages: [
          {
            role: 'user',
            content:
              'First, scan all repositories for security vulnerabilities. Then, triage the findings by severity. After that, create a report with remediation steps. Finally, schedule a review meeting.',
          },
        ],
      })
      .expect(200);

    expect(['complex', 'reasoning']).toContain(res.body.tier);
    expect(res.body.model).not.toBeNull();
  });

  it('tools floor query to at least standard tier', async () => {
    // Long enough to bypass the short-message fast path so the tools-floor
    // branch in applyTierFloors is the thing being exercised.
    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({
        messages: [
          {
            role: 'user',
            content: 'Search the web for recent news about cats and summarise the top results.',
          },
        ],
        tools: [{ name: 'web_search' }],
        tool_choice: 'auto',
      })
      .expect(200);

    expect(res.body.tier).not.toBe('simple');
    expect(res.body.model).not.toBeNull();
  });

  it('system messages do not inflate scoring', async () => {
    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({
        messages: [
          {
            role: 'system',
            content:
              'You are an expert at proving theorems and formal logic with induction and deduction.',
          },
          { role: 'user', content: 'hi there' },
        ],
      })
      .expect(200);

    // "hi there" alone is simple — system prompt keywords shouldn't push it up
    expect(res.body.tier).toBe('simple');
  });
});

describe('Subscription providers respect supported capabilities', () => {
  beforeAll(async () => {
    // Start fresh: deactivate all, then register via subscription endpoint
    await auth(api().post('/api/v1/routing/test-agent/providers/deactivate-all'))
      .expect(201);
  });

  it('registers only supported subscription providers as active', async () => {
    const res = await bearer(api().post('/api/v1/routing/subscription-providers'))
      .send({ providers: [{ provider: 'deepseek' }, { provider: 'anthropic' }] })
      .expect(200);

    expect(res.body.registered).toBe(1);

    // Verify only supported subscription providers are active
    const providers = await auth(api().get('/api/v1/routing/test-agent/providers'))
      .expect(200);
    const subs = providers.body.filter(
      (p: { auth_type: string }) => p.auth_type === 'subscription',
    );
    expect(subs).toHaveLength(1);
    expect(subs[0].provider).toBe('anthropic');
    expect(subs.every((p: { is_active: boolean }) => p.is_active)).toBe(true);
  });

  it('removes a supported subscription provider → deactivated', async () => {
    await auth(
      api().delete('/api/v1/routing/test-agent/providers/anthropic?authType=subscription'),
    ).expect(200);

    const providers = await auth(api().get('/api/v1/routing/test-agent/providers'))
      .expect(200);
    const anthropic = providers.body.find(
      (p: { provider: string; auth_type: string }) =>
        p.provider === 'anthropic' && p.auth_type === 'subscription',
    );
    expect(anthropic.is_active).toBe(false);
  });

  it('re-registering same providers does not re-activate removed or unsupported ones', async () => {
    const res = await bearer(api().post('/api/v1/routing/subscription-providers'))
      .send({ providers: [{ provider: 'deepseek' }, { provider: 'anthropic' }] })
      .expect(200);

    // deepseek is unsupported and anthropic already exists but was deactivated by the user
    expect(res.body.registered).toBe(0);

    // deepseek subscription should not exist in Manifest at all
    const providers = await auth(api().get('/api/v1/routing/test-agent/providers'))
      .expect(200);
    const deepseek = providers.body.find(
      (p: { provider: string; auth_type: string }) =>
        p.provider === 'deepseek' && p.auth_type === 'subscription',
    );
    expect(deepseek).toBeUndefined();

    // anthropic subscription should still be inactive
    const anthropic = providers.body.find(
      (p: { provider: string; auth_type: string }) =>
        p.provider === 'anthropic' && p.auth_type === 'subscription',
    );
    expect(anthropic.is_active).toBe(false);
  });
});

describe('Persisted unsupported subscriptions are cleaned up on read', () => {
  it('deactivates a stale unsupported subscription when loading providers', async () => {
    await auth(api().post('/api/v1/routing/test-agent/providers/deactivate-all'))
      .expect(201);

    const ds = app.get(DataSource);
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

    await ds.query(
      `DELETE FROM user_providers WHERE agent_id = $1 AND provider = $2 AND auth_type = $3`,
      [TEST_AGENT_ID, 'deepseek', 'subscription'],
    );
    await ds.query(
      `INSERT INTO user_providers (id, user_id, agent_id, provider, api_key_encrypted, key_prefix, auth_type, is_active, connected_at, updated_at)
           VALUES ($1, $2, $3, $4, NULL, NULL, $5, true, $6, $7)`,
      ['stale-deepseek-sub', TEST_USER_ID, TEST_AGENT_ID, 'deepseek', 'subscription', now, now],
    );

    const providers = await auth(api().get('/api/v1/routing/test-agent/providers'))
      .expect(200);
    const deepseek = providers.body.find(
      (p: { provider: string; auth_type: string }) =>
        p.provider === 'deepseek' && p.auth_type === 'subscription',
    );
    expect(deepseek).toBeUndefined();

    const rows = await ds.query(
      `SELECT is_active FROM user_providers WHERE id = $1`,
      ['stale-deepseek-sub'],
    );
    const isActive = rows[0]?.is_active === true || rows[0]?.is_active === 1;
    expect(isActive).toBe(false);
  });
});

describe('Routing disabled after deactivation → falls back to null', () => {
  it('deactivating all providers removes model assignments', async () => {
    await auth(api().post('/api/v1/routing/test-agent/providers/deactivate-all'))
      .expect(201);

    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({ messages: [{ role: 'user', content: 'hello' }] })
      .expect(200);

    expect(res.body.model).toBeNull();
    expect(res.body.provider).toBeNull();
    // Tier is still determined by the scorer
    expect(res.body.tier).toBeDefined();
  });

  it('re-enabling providers restores model routing', async () => {
    await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai' })
      .expect(201);

    // Re-seed cached_models on the re-activated provider
    const ds = app.get(DataSource);
    const openaiModels = JSON.stringify([
      {
        id: 'gpt-4o-mini',
        displayName: 'gpt-4o-mini',
        provider: 'openai',
        contextWindow: 128000,
        inputPricePerToken: 0.00000015,
        outputPricePerToken: 0.0000006,
        capabilityReasoning: false,
        capabilityCode: true,
        qualityScore: 2,
      },
    ]);
    await ds.query(
      `UPDATE user_providers SET cached_models = $1 WHERE agent_id = $2 AND provider = $3`,
      [openaiModels, TEST_AGENT_ID, 'openai'],
    );
    await app.get(TierAutoAssignService).recalculate(TEST_AGENT_ID);

    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({ messages: [{ role: 'user', content: 'hi' }] })
      .expect(200);

    expect(res.body.model).not.toBeNull();
    expect(res.body.tier).toBe('simple');
  });
});
