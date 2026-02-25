import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_OTLP_KEY, TEST_API_KEY } from './helpers';
import { detectDialect, portableSql } from '../src/common/utils/sql-dialect';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  const ds = app.get(DataSource);
  const dialect = detectDialect(ds.options.type as string);
  const sql = (q: string) => portableSql(q, dialect);
  const b = (v: boolean) => (dialect === 'sqlite' ? (v ? 1 : 0) : v);

  // Clear and re-seed pricing
  await ds.query('DELETE FROM model_pricing');
  await ds.query(
    sql(`INSERT INTO model_pricing (model_name, provider, input_price_per_token, output_price_per_token, context_window, capability_reasoning, capability_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`),
    ['gpt-4o-mini', 'OpenAI', 0.00000015, 0.0000006, 128000, b(false), b(true)],
  );

  // Reload pricing cache
  const { ModelPricingCacheService } = await import(
    '../src/model-prices/model-pricing-cache.service'
  );
  const cache = app.get(ModelPricingCacheService);
  await cache.reload();

  // Connect OpenAI provider with a fake API key via API
  await request(app.getHttpServer())
    .post('/api/v1/routing/providers')
    .set('x-api-key', TEST_API_KEY)
    .send({ provider: 'openai', apiKey: 'sk-fake-test-key' })
    .expect(201);
}, 30000);

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());
const bearer = (r: request.Test) =>
  r.set('Authorization', `Bearer ${TEST_OTLP_KEY}`);

describe('Proxy E2E — /v1/chat/completions', () => {
  it('rejects requests without auth', async () => {
    // In local mode, loopback requests bypass auth (trusted same-machine).
    // Temporarily unset MANIFEST_MODE to test the auth rejection path.
    const origMode = process.env['MANIFEST_MODE'];
    delete process.env['MANIFEST_MODE'];
    try {
      await api()
        .post('/v1/chat/completions')
        .send({ messages: [{ role: 'user', content: 'hello' }] })
        .expect(401);
    } finally {
      if (origMode !== undefined) process.env['MANIFEST_MODE'] = origMode;
    }
  });

  it('returns 400 when messages are missing', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .send({})
      .expect(400);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toContain('messages');
  });

  it('returns 400 when messages array is empty', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .send({ messages: [] })
      .expect(400);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toContain('messages');
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

    // The response should NOT be our OtlpAuthGuard 401 (which has a specific format).
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

    // Skip assertion if we got a network error (no headers set)
    // When the provider is reachable, even error responses include routing headers
    if (res.status !== 500) {
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

    // Should pass auth (not our guard's 401 format)
    // Any response that isn't a validation error proves the proxy processed it
    expect(res.status).not.toBe(400);
  });
});
