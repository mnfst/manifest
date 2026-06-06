/**
 * Verifies the multi-key-per-provider HTTP surface end to end:
 *
 *  - POST /providers with `label` adds an extra key (cap = 5)
 *  - PATCH /providers/:provider/keys/:label renames a key
 *  - PUT /providers/:provider/keys/order rewrites priorities by index
 *  - DELETE /providers/:provider?label=… removes one key from the chain
 *    while leaving the provider connected (and renumbers priorities)
 *  - DELETE /providers/:provider with no label keeps legacy whole-provider
 *    teardown semantics
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_AGENT_ID, TEST_API_KEY, TEST_USER_ID } from './helpers';
import { RoutingCacheService } from '../src/routing/routing-core/routing-cache.service';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
}, 30000);

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);

async function listProviders(): Promise<
  Array<{
    provider: string;
    auth_type: string;
    label: string;
    priority: number;
    is_active: boolean;
  }>
> {
  const res = await auth(api().get('/api/v1/routing/test-agent/providers')).expect(200);
  return res.body;
}

async function listActiveOpenAi() {
  const all = await listProviders();
  return all
    .filter((r) => r.provider === 'openai' && r.auth_type === 'api_key' && r.is_active)
    .sort((a, b) => a.priority - b.priority);
}

describe('Multi-key per provider — HTTP', () => {
  beforeEach(async () => {
    // Each test starts from a clean OpenAI provider state. Providers are
    // user-global now, so inactive same-key rows from earlier tests would be
    // resurrected with their old labels if we only deactivated them.
    const ds = app.get(DataSource);
    await ds.query(`DELETE FROM user_providers WHERE user_id = $1 AND provider = $2`, [
      TEST_USER_ID,
      'openai',
    ]);
    const cache = app.get(RoutingCacheService);
    cache.invalidateAgent(TEST_AGENT_ID);
    cache.invalidateUser(TEST_USER_ID);
  });

  it('initial connect (no label) creates a row labeled "Default" with priority 0', async () => {
    await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai', apiKey: 'sk-personal' })
      .expect(201);

    const rows = await listActiveOpenAi();
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Default');
    expect(rows[0].priority).toBe(0);
  });

  it('connecting a second key with a label appends to the chain at next priority', async () => {
    await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai', apiKey: 'sk-personal' })
      .expect(201);
    await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai', apiKey: 'sk-work', label: 'Work' })
      .expect(201);

    const rows = await listActiveOpenAi();
    expect(rows).toHaveLength(2);
    expect(rows[0].label).toBe('Default');
    expect(rows[1].label).toBe('Work');
    expect(rows[1].priority).toBeGreaterThan(rows[0].priority);
  });

  it('rejects connecting a 6th key for the same (provider, auth_type)', async () => {
    for (let i = 1; i <= 5; i++) {
      await auth(api().post('/api/v1/routing/test-agent/providers'))
        .send({ provider: 'openai', apiKey: `sk-${i}`, label: `Key ${i}` })
        .expect(201);
    }
    const res = await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai', apiKey: 'sk-6', label: 'Key 6' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at most 5/i);
  });

  it('accepts custom labels for subscription auth_type', async () => {
    const res = await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'anthropic', apiKey: 'sub-token', authType: 'subscription', label: 'Pro' });
    // Multi-key chains apply to subscription too — multiple Anthropic Pro
    // tokens, multiple ChatGPT Plus accounts, etc.
    expect(res.status).toBe(201);
    expect(res.body.label).toBe('Pro');
    expect(res.body.auth_type).toBe('subscription');
  });

  it('PATCH /providers/:provider/keys/:label renames a key', async () => {
    await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai', apiKey: 'sk-personal' })
      .expect(201);
    await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai', apiKey: 'sk-work', label: 'Work' })
      .expect(201);

    const res = await auth(
      api().patch('/api/v1/routing/test-agent/providers/openai/keys/Work'),
    )
      .send({ newLabel: 'Office' })
      .expect(200);
    expect(res.body.label).toBe('Office');

    const rows = await listActiveOpenAi();
    expect(rows.find((r) => r.label === 'Office')).toBeDefined();
    expect(rows.find((r) => r.label === 'Work')).toBeUndefined();
  });

  it('PUT /providers/:provider/keys/order writes priority by index', async () => {
    await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai', apiKey: 'sk-personal' })
      .expect(201);
    await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai', apiKey: 'sk-work', label: 'Work' })
      .expect(201);

    const res = await auth(api().put('/api/v1/routing/test-agent/providers/openai/keys/order'))
      .send({ labels: ['Work', 'Default'] })
      .expect(200);
    expect(res.body[0].label).toBe('Work');
    expect(res.body[0].priority).toBe(0);
    expect(res.body[1].label).toBe('Default');
    expect(res.body[1].priority).toBe(1);
  });

  it('DELETE /providers/:provider?label=… removes one key and renumbers priorities', async () => {
    await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai', apiKey: 'sk-personal' })
      .expect(201);
    await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai', apiKey: 'sk-work', label: 'Work' })
      .expect(201);

    await auth(api().delete('/api/v1/routing/test-agent/providers/openai?label=Default'))
      .expect(200);

    const rows = await listActiveOpenAi();
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Work');
    expect(rows[0].priority).toBe(0);
  });

  it('DELETE /providers/:provider without label keeps legacy whole-provider teardown', async () => {
    await auth(api().post('/api/v1/routing/test-agent/providers'))
      .send({ provider: 'openai', apiKey: 'sk-personal' })
      .expect(201);

    await auth(api().delete('/api/v1/routing/test-agent/providers/openai')).expect(200);
    // Legacy semantics: whole-provider deactivation. The active set drops the
    // Default key entirely (any leftover rows from earlier tests are still
    // inactive after the beforeEach `deactivate-all`).
    const active = await listActiveOpenAi();
    expect(active).toHaveLength(0);
  });
});
