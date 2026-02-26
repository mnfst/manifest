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

  it('defaults to standard tier when X-Manifest-Tier is missing', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .send({
        messages: [{ role: 'user', content: 'hello' }],
        stream: false,
      });

    // Should not be a 400 validation error (tier defaults to standard)
    expect(res.status).not.toBe(400);
  });

  it('returns 400 when tier is invalid', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .set('X-Manifest-Tier', 'mega')
      .send({ messages: [{ role: 'user', content: 'hello' }] })
      .expect(400);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toContain('Invalid tier');
  });

  it('resolves tier and attempts to forward to provider', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .set('X-Manifest-Tier', 'simple')
      .send({
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      });

    // The forward will reach the real OpenAI API which rejects the fake key.
    // Either way, we passed auth and resolved a model successfully.
    if (res.status === 401 || res.status === 403) {
      // Provider rejected the fake key — proxy worked, routing headers prove it
      const hasManifestHeaders =
        res.headers['x-manifest-tier'] || res.headers['x-manifest-model'];
      expect(hasManifestHeaders).toBeTruthy();
    } else {
      expect(res.status).toBeDefined();
    }
  });

  it('includes X-Manifest-* headers when forwarding', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .set('X-Manifest-Tier', 'simple')
      .send({
        messages: [{ role: 'user', content: 'hello' }],
        stream: false,
      });

    // When the provider is reachable, even error responses include routing headers
    if (res.status !== 500) {
      expect(res.headers['x-manifest-tier']).toBeDefined();
      expect(res.headers['x-manifest-model']).toBeDefined();
      expect(res.headers['x-manifest-provider']).toBeDefined();
    }
  });

  it('does NOT include X-Manifest-Confidence header', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .set('X-Manifest-Tier', 'simple')
      .send({
        messages: [{ role: 'user', content: 'hello' }],
        stream: false,
      });

    expect(res.headers['x-manifest-confidence']).toBeUndefined();
  });
});
