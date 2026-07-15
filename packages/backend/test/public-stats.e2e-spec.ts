import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  // Enable the public stats endpoints for the existing test suite.
  // A separate describe block below asserts the default (off) behavior.
  process.env['MANIFEST_PUBLIC_STATS'] = 'true';
  app = await createTestApp();

  const ds = app.get(DataSource);
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

  await ds.query(
    `INSERT INTO provider_attempts (id, tenant_id, agent_id, agent_name, user_id, timestamp, input_tokens, output_tokens, model, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    ['ps-msg-1', 'test-tenant-001', 'test-agent-001', 'test-agent', 'test-user-001', now, 100, 50, 'gpt-4o', 'ok'],
  );
  await ds.query(
    `INSERT INTO provider_attempts (id, tenant_id, agent_id, agent_name, user_id, timestamp, input_tokens, output_tokens, model, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    ['ps-msg-2', 'test-tenant-001', 'test-agent-001', 'test-agent', 'test-user-001', now, 200, 100, 'gpt-4o', 'ok'],
  );
  await ds.query(
    `INSERT INTO provider_attempts (id, tenant_id, agent_id, agent_name, user_id, timestamp, input_tokens, output_tokens, model, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    ['ps-msg-3', 'test-tenant-001', 'test-agent-001', 'test-agent', 'test-user-001', now, 150, 75, 'claude-opus-4-6', 'ok'],
  );
  await ds.query(
    `INSERT INTO provider_attempts (id, tenant_id, agent_id, agent_name, user_id, timestamp, input_tokens, output_tokens, model, provider, auth_type, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      'ps-msg-6',
      'test-tenant-001',
      'test-agent-001',
      'test-agent',
      'test-user-001',
      now,
      800,
      400,
      'gpt-5.5',
      'openai',
      'subscription',
      'ok',
    ],
  );

  // Custom-endpoint traffic: two tenant-scoped provider refs from one tenant,
  // exercising the Custom grouping + k-anonymity fold on real SQL.
  await ds.query(
    `INSERT INTO provider_attempts (id, tenant_id, agent_id, agent_name, user_id, timestamp, input_tokens, output_tokens, model, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    ['ps-msg-4', 'test-tenant-001', 'test-agent-001', 'test-agent', 'test-user-001', now, 400, 200, 'custom:d0c5ce41-0000-4000-8000-000000000001/private-model', 'ok'],
  );
  await ds.query(
    `INSERT INTO provider_attempts (id, tenant_id, agent_id, agent_name, user_id, timestamp, input_tokens, output_tokens, model, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    ['ps-msg-5', 'test-tenant-001', 'test-agent-001', 'test-agent', 'test-user-001', now, 200, 100, 'custom:d0c5ce41-0000-4000-8000-000000000002/other-private-model', 'ok'],
  );

  // Tag the seeded agent so the agent-tokens endpoint has a recognised
  // (category, platform) pair to aggregate the seeded messages under.
  await ds.query(
    `UPDATE agents SET agent_category = $1, agent_platform = $2 WHERE id = $3`,
    ['personal', 'openclaw', 'test-agent-001'],
  );
});

afterAll(async () => {
  await app.close();
  delete process.env['MANIFEST_PUBLIC_STATS'];
});

describe('GET /api/v1/public/usage', () => {
  it('returns total messages and top models without auth', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/usage')
      .expect(200);

    expect(res.body).toHaveProperty('total_messages');
    expect(res.body.total_messages).toBeGreaterThanOrEqual(3);
    expect(res.body).toHaveProperty('top_models');
    expect(res.body).toHaveProperty('cached_at');
  });

  it('includes expected fields in top models', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/usage')
      .expect(200);

    expect(res.body.top_models.length).toBeGreaterThan(0);
    const m = res.body.top_models[0];
    expect(m).toHaveProperty('model');
    expect(m).toHaveProperty('provider');
    expect(m).toHaveProperty('tokens_7d');
    expect(m).toHaveProperty('usage_rank');
  });
});

describe('GET /api/v1/public/free-models', () => {
  it('returns free models without auth', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/free-models')
      .expect(200);

    expect(res.body).toHaveProperty('models');
    expect(Array.isArray(res.body.models)).toBe(true);
    expect(res.body).toHaveProperty('total_models');
    expect(res.body).toHaveProperty('cached_at');
  });
});

describe('GET /api/v1/public/provider-tokens', () => {
  it('groups custom-endpoint traffic under one Custom provider without leaking refs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/provider-tokens')
      .expect(200);

    expect(Array.isArray(res.body.providers)).toBe(true);
    const custom = res.body.providers.find(
      (p: { provider: string }) => p.provider === 'Custom',
    );
    expect(custom).toBeDefined();
    // A single tenant sits below the k-anonymity floor, so both seeded model
    // names fold into the aggregate bucket while the totals stay exact.
    expect(custom.models).toEqual([
      expect.objectContaining({ model: 'other-custom-models', total_tokens: 900 }),
    ]);
    expect(custom.total_tokens).toBe(900);
    // The tenant-scoped provider refs must never appear anywhere in the payload.
    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain('d0c5ce41');
    expect(payload).not.toContain('private-model');
  });

  it('attributes ChatGPT subscription GPT rows to OpenAI, not OpenCode Zen', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/provider-tokens')
      .expect(200);

    const openai = res.body.providers.find((p: { provider: string }) => p.provider === 'OpenAI');
    expect(openai).toBeDefined();
    expect(openai.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          model: 'gpt-5.5',
          auth_type: 'subscription',
          total_tokens: expect.any(Number),
        }),
      ]),
    );
    const gpt = openai.models.find(
      (m: { model: string; auth_type: string | null }) =>
        m.model === 'gpt-5.5' && m.auth_type === 'subscription',
    );
    expect(gpt.total_tokens).toBeGreaterThanOrEqual(1200);

    const zen = res.body.providers.find(
      (p: { provider: string }) => p.provider === 'OpenCode Zen',
    );
    expect(
      zen?.models.some(
        (m: { model: string; auth_type: string | null }) =>
          m.model === 'gpt-5.5' && m.auth_type === 'subscription',
      ),
    ).not.toBe(true);
  });
});

describe('GET /api/v1/public/agent-tokens', () => {
  it('aggregates tokens by (category, platform) without auth', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/agent-tokens')
      .expect(200);

    expect(res.body).toHaveProperty('agents');
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body).toHaveProperty('cached_at');

    const group = res.body.agents.find(
      (g: { agent_category: string; agent_platform: string }) =>
        g.agent_category === 'personal' && g.agent_platform === 'openclaw',
    );
    expect(group).toBeDefined();
    expect(group.category_label).toBe('AI agents');
    expect(group.platform_label).toBe('OpenClaw');
    // seeded messages: 150 + 300 + 225 = 675 tokens across two models
    expect(group.total_tokens).toBeGreaterThanOrEqual(675);
    expect(Array.isArray(group.models)).toBe(true);
    expect(group.models.length).toBeGreaterThanOrEqual(2);

    const modelNames = group.models.map((m: { model: string }) => m.model);
    expect(modelNames).toContain('gpt-4o');
    expect(modelNames).toContain('claude-opus-4-6');

    for (const m of group.models) {
      expect(m).toHaveProperty('total_tokens');
      expect(m).toHaveProperty('daily');
      expect(Array.isArray(m.daily)).toBe(true);
    }
  });
});
