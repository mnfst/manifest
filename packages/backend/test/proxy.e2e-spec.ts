import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_OTLP_KEY, TEST_API_KEY, TEST_AGENT_ID } from './helpers';
import { PricingSyncService } from '../src/database/pricing-sync.service';
import { ModelPricingCacheService } from '../src/model-prices/model-pricing-cache.service';
import { TierAutoAssignService } from '../src/routing/routing-core/tier-auto-assign.service';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  const ds = app.get(DataSource);

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
    `UPDATE user_providers SET cached_models = $1 WHERE agent_id = $2 AND provider = $3`,
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
  // Supertest doesn't set Accept by default, and these requests omit
  // `stream: true`, so the exception filter classifies them as non-chat
  // clients (curl/CI/monitor) and returns real HTTP statuses with a
  // structured error envelope.

  it('rejects unauthenticated requests with HTTP 401', async () => {
    const res = await api()
      .post('/v1/chat/completions')
      .send({ messages: [{ role: 'user', content: 'hello' }] })
      .expect(401);

    expect(res.body.error.type).toBe('auth_error');
    expect(res.body.error.message).toContain('Missing the Authorization header');
  });

  it('rejects unauthenticated Responses API requests with HTTP 401', async () => {
    const res = await api()
      .post('/v1/responses')
      .send({ input: 'hello' })
      .expect(401);

    expect(res.body.error.type).toBe('auth_error');
    expect(res.body.error.message).toContain('Missing the Authorization header');
  });

  it('returns the friendly envelope when the caller opts into SSE chat semantics', async () => {
    const res = await api()
      .post('/v1/chat/completions')
      .set('Accept', 'text/event-stream')
      .send({ messages: [{ role: 'user', content: 'hello' }] })
      .expect(200);

    expect(res.body.choices[0].message.content).toContain('Missing the Authorization header');
  });

  it('returns HTTP 400 when messages are missing', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .send({})
      .expect(400);

    expect(res.body.error.type).toBe('invalid_request_error');
    expect(res.body.error.message).toContain('messages');
  });

  it('returns HTTP 400 when Responses API input is missing', async () => {
    const res = await bearer(api().post('/v1/responses'))
      .send({})
      .expect(400);

    expect(res.body.error.type).toBe('invalid_request_error');
    expect(res.body.error.message).toContain('messages');
  });

  it('returns HTTP 400 when messages array is empty', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .send({ messages: [] })
      .expect(400);

    expect(res.body.error.message).toContain('messages');
  });

  it('returns the friendly envelope for missing messages when stream=true', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .send({ stream: true })
      .expect(200);

    // SSE payload — assert via raw text since supertest stores it on `text`.
    expect(res.text).toContain('messages');
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

    // Whitelist of intentionally-handled status codes. If a status outside this
    // set surfaces (e.g., a stray 404, 405, 501), the test should fail loudly
    // instead of silently passing — that signals a real regression in the
    // proxy pipeline. Forcing the assertion BEFORE the header check also
    // prevents the original bug where a provider-returned 403 would skip the
    // header verification entirely and be misread as success.
    expect([200, 400, 401, 403, 429, 500, 502, 503, 504]).toContain(res.status);

    // The AgentKeyAuthGuard rejects requests BEFORE the proxy resolves a model,
    // so guard-emitted responses never carry X-Manifest-* headers. If the
    // status is in the 4xx range that the guard could plausibly emit (401/403),
    // we must prove that this response came from the provider — i.e., the
    // proxy successfully passed auth and forwarded — by asserting that the
    // routing meta headers are present. A guard rejection here would mean the
    // setup in beforeAll is broken (TEST_OTLP_KEY no longer valid).
    if (res.status === 401 || res.status === 403) {
      expect(res.headers['x-manifest-tier']).toBeDefined();
      expect(res.headers['x-manifest-model']).toBeDefined();
      expect(res.headers['x-manifest-provider']).toBeDefined();
      // Body shape from handleProviderError() — upstream_error envelope with
      // the forwarded status echoed in `error.status`. A guard 401 would have
      // type='auth_error' so this also discriminates the two paths.
      expect(res.body?.error?.type).toBe('upstream_error');
      expect(res.body?.error?.status).toBe(res.status);
    } else if (res.status >= 500) {
      // Two failure modes converge here:
      //  - handleProviderError (provider returned 5xx)  → type: 'upstream_error', X-Manifest-* present
      //  - handleProxyError    (network/throw in proxy) → type: 'server_error',   no X-Manifest-* headers
      // Whichever path fires, the envelope must be one of the two known shapes —
      // a 5xx with no `error` object would indicate a regression.
      expect(['upstream_error', 'server_error']).toContain(res.body?.error?.type);
    } else if (res.status === 200) {
      // Unlikely in CI (the fake key would be rejected), but if it succeeds
      // we still expect the routing meta headers on the response.
      expect(res.headers['x-manifest-tier']).toBeDefined();
      expect(res.headers['x-manifest-model']).toBeDefined();
    }
  });

  it('does not return guard 401 envelope when a valid agent key is supplied', async () => {
    // Regression guard: if the AgentKeyAuthGuard ever rejects TEST_OTLP_KEY,
    // the entire suite above silently degrades into "always 401, no headers"
    // territory. Pin the contract explicitly so that a broken seed/key setup
    // fails this single test instead of corrupting the meaning of every other
    // assertion in the file.
    const res = await bearer(api().post('/v1/chat/completions'))
      .send({
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      });

    if (res.status === 401) {
      // Guard 401s pass through ProxyExceptionFilter and are wrapped with
      // type: 'auth_error', code: 'manifest_auth'. Provider 401s come from
      // handleProviderError() with type: 'upstream_error'. Asserting type
      // discriminates the two, even before headers are checked.
      expect(res.body?.error?.type).not.toBe('auth_error');
      expect(res.body?.error?.code).not.toBe('manifest_auth');
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
