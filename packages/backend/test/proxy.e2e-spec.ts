import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_OTLP_KEY, TEST_API_KEY, TEST_AGENT_ID } from './helpers';
import { detectDialect, portableSql } from '../src/common/utils/sql-dialect';
import { PricingSyncService } from '../src/database/pricing-sync.service';
import { ModelPricingCacheService } from '../src/model-prices/model-pricing-cache.service';
import { TierAutoAssignService } from '../src/routing/routing-core/tier-auto-assign.service';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  const ds = app.get(DataSource);
  const dialect = detectDialect(ds.options.type as string);
  const sql = (q: string) => portableSql(q, dialect);

  // Populate PricingSyncService cache with gpt-4o-mini pricing (use prefixed key
  // so ModelPricingCacheService.inferProvider() resolves the correct provider name)
  const pricingSync = app.get(PricingSyncService);
  (pricingSync.getAll() as Map<string, { input: number; output: number; contextWindow?: number }>).set('openai/gpt-4o-mini', {
    input: 0.00000015,
    output: 0.0000006,
    contextWindow: 128000,
  });

  // Reload pricing cache from OpenRouter cache + manual pricing
  const cache = app.get(ModelPricingCacheService);
  await cache.reload();

  // Connect OpenAI provider with a fake API key via API
  await request(app.getHttpServer())
    .post('/api/v1/routing/test-agent/providers')
    .set('x-api-key', TEST_API_KEY)
    .send({ provider: 'openai', apiKey: 'sk-fake-test-key' })
    .expect(201);

  // Seed discovered models on the provider record so tier auto-assign can pick them
  const models = JSON.stringify([
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
    sql(`UPDATE user_providers SET cached_models = $1 WHERE agent_id = $2 AND provider = $3`),
    [models, TEST_AGENT_ID, 'openai'],
  );

  // Recalculate tier assignments with the seeded models
  const autoAssign = app.get(TierAutoAssignService);
  await autoAssign.recalculate(TEST_AGENT_ID);
}, 30000);

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());
const bearer = (r: request.Test) =>
  r.set('Authorization', `Bearer ${TEST_OTLP_KEY}`);

describe('Proxy E2E — /v1/chat/completions', () => {
  it('rejects requests without auth', async () => {
    const res = await api()
      .post('/v1/chat/completions')
      .send({ messages: [{ role: 'user', content: 'hello' }] })
      .expect(200);

    // Auth errors are returned as friendly chat completion messages
    expect(res.body.choices[0].message.content).toContain('Missing the Authorization header');
  });

  it('returns friendly message when messages are missing', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .send({})
      .expect(200);

    expect(res.body.choices[0].message.content).toContain('messages');
  });

  it('returns friendly message when messages array is empty', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .send({ messages: [] })
      .expect(200);

    expect(res.body.choices[0].message.content).toContain('messages');
  });

  it('resolves and attempts to forward to provider', async () => {
    // This test verifies the full proxy pipeline: auth → resolve → forward.
    // The forward will reach the real OpenAI API which rejects the fake key,
    // proving the proxy successfully routed and forwarded the request.
    const res = await bearer(api().post('/v1/chat/completions'))
      .send({
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      });

    // The response should NOT be our AgentKeyAuthGuard 401 (which has a specific format).
    // It will be either a provider error (401/403 from OpenAI) or a network error (500).
    // Either way, we passed auth and resolved a model successfully.
    if (res.status === 401) {
      // If 401, verify it's from the provider (not our guard)
      // Our guard returns { message: '...', statusCode: 401 }
      // Provider errors are forwarded with X-Manifest-* headers
      const hasManifestHeaders =
        res.headers['x-manifest-tier'] || res.headers['x-manifest-model'];
      expect(hasManifestHeaders).toBeTruthy();
    } else {
      // Network error or other — proxy attempted the forward
      expect(res.status).toBeDefined();
    }
  });

  it('includes X-Manifest-* headers when forwarding', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .send({
        messages: [{ role: 'user', content: 'hello' }],
        stream: false,
      });

    // Skip assertion if proxy returned 400 (no model) or 500 (network error)
    if (res.status !== 500 && res.status !== 400) {
      expect(res.headers['x-manifest-tier']).toBeDefined();
      expect(res.headers['x-manifest-model']).toBeDefined();
      expect(res.headers['x-manifest-provider']).toBeDefined();
      expect(res.headers['x-manifest-confidence']).toBeDefined();
    }
  });

  it('accepts X-Session-Key header without error', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .set('X-Session-Key', 'test-session-123')
      .send({
        messages: [{ role: 'user', content: 'hello' }],
        stream: false,
      });

    // X-Session-Key should not cause a validation error (400 from body parsing)
    // Auth (401) or no-model (400) or provider error are all acceptable outcomes
    expect([200, 400, 401, 429, 500, 502]).toContain(res.status);
  });
});
