/**
 * End-to-end coverage for the Phase 1 "honest context window advertisement"
 * feature (issues #1617, #1612, #1450). These tests exercise the full
 * request path — bearer-token auth → ContextAdvertisementService → response
 * shape — that clients like OpenClaw, OpenAI SDK, LangChain etc. actually
 * touch when they probe GET /v1/models.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import {
  createTestApp,
  TEST_AGENT_ID,
  TEST_API_KEY,
  TEST_OTLP_KEY,
} from './helpers';
import { PricingSyncService } from '../src/database/pricing-sync.service';
import { ModelPricingCacheService } from '../src/model-prices/model-pricing-cache.service';
import { TierAutoAssignService } from '../src/routing/routing-core/tier-auto-assign.service';
import { RoutingCacheService } from '../src/routing/routing-core/routing-cache.service';

let app: INestApplication;

const api = () => request(app.getHttpServer());
const bearer = (r: request.Test) => r.set('Authorization', `Bearer ${TEST_OTLP_KEY}`);

beforeAll(async () => {
  app = await createTestApp();

  // Seed the OpenRouter pricing cache with two differently-sized models so
  // the min() across routed models is observable from the outside.
  const pricingSync = app.get(PricingSyncService);
  const orCache = pricingSync.getAll() as Map<
    string,
    { input: number; output: number; contextWindow?: number }
  >;
  orCache.set('openai/gpt-4o-mini', {
    input: 0.00000015,
    output: 0.0000006,
    contextWindow: 128_000,
  });
  orCache.set('anthropic/claude-opus-4-6', {
    input: 0.000015,
    output: 0.000075,
    contextWindow: 200_000,
  });
  await app.get(ModelPricingCacheService).reload();

  // Connect openai + anthropic providers and seed discovered models so tier
  // auto-assign actually has something to route to.
  await api()
    .post('/api/v1/routing/test-agent/providers')
    .set('x-api-key', TEST_API_KEY)
    .send({ provider: 'openai', apiKey: 'sk-fake-openai' })
    .expect(201);
  await api()
    .post('/api/v1/routing/test-agent/providers')
    .set('x-api-key', TEST_API_KEY)
    .send({ provider: 'anthropic', apiKey: 'sk-fake-anthropic' })
    .expect(201);

  const ds = app.get(DataSource);
  const openaiModels = JSON.stringify([
    {
      id: 'gpt-4o-mini',
      displayName: 'gpt-4o-mini',
      provider: 'openai',
      contextWindow: 128_000,
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
      contextWindow: 200_000,
      inputPricePerToken: 0.000015,
      outputPricePerToken: 0.000075,
      capabilityReasoning: true,
      capabilityCode: true,
      qualityScore: 5,
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

  // Run tier auto-assign so at least one tier points at each model — this
  // is what makes both 200K and 128K land in the candidate set.
  const autoAssign = app.get(TierAutoAssignService);
  await autoAssign.recalculate(TEST_AGENT_ID);
}, 30000);

afterAll(async () => {
  await app.close();
});

describe('GET /v1/models — honest context window advertisement', () => {
  it('rejects unauthenticated requests with HTTP 401', async () => {
    // Same guard as /v1/chat/completions — clients that forget the bearer
    // must not get a stale / default value.
    const res = await api().get('/v1/models').expect(401);
    expect(res.body.error.type).toBe('auth_error');
  });

  it('returns the minimum context window across all tier primaries and fallbacks', async () => {
    // After auto-assign the tiers include both gpt-4o-mini (128K) and
    // claude-opus-4-6 (200K). The floor is 128K — that's the invariant
    // the feature protects.
    const res = await bearer(api().get('/v1/models')).expect(200);

    expect(res.body.object).toBe('list');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);

    const [model] = res.body.data;
    expect(model.id).toBe('auto');
    expect(model.object).toBe('model');
    expect(model.owned_by).toBe('manifest');
    expect(Number.isInteger(model.context_length)).toBe(true);
    expect(model.context_length).toBeGreaterThan(0);
    expect(model.context_length).toBe(128_000);
    // `created` is a Unix timestamp (seconds). Don't pin the exact number —
    // just verify the shape clients depend on.
    expect(typeof model.created).toBe('number');
    expect(Number.isInteger(model.created)).toBe(true);
    expect(model.created).toBeGreaterThan(0);
  });

  it('honours context_floor_override when the user sets one', async () => {
    // Bypass the DTO/controller so we can pin the column value to something
    // that wouldn't otherwise be computed (50_000 isn't any model's window).
    const ds = app.get(DataSource);
    await ds.query(`UPDATE agents SET context_floor_override = $1 WHERE id = $2`, [
      50_000,
      TEST_AGENT_ID,
    ]);
    // The advertisement service reads tiers via an in-memory cache — flush
    // it so the update takes effect immediately.
    app.get(RoutingCacheService).invalidateAgent(TEST_AGENT_ID);

    try {
      const res = await bearer(api().get('/v1/models')).expect(200);

      expect(res.body.data[0].context_length).toBe(50_000);
    } finally {
      await ds.query(`UPDATE agents SET context_floor_override = NULL WHERE id = $1`, [
        TEST_AGENT_ID,
      ]);
      app.get(RoutingCacheService).invalidateAgent(TEST_AGENT_ID);
    }
  });
});
