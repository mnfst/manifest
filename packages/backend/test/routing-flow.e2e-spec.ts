/**
 * End-to-end test validating:
 * 1. Routing DISABLED → resolve returns null model (OpenClaw falls back to Gemini)
 * 2. Routing ENABLED  → scorer picks tier based on query complexity and returns a model
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_API_KEY, TEST_OTLP_KEY } from './helpers';
import { detectDialect, portableSql } from '../src/common/utils/sql-dialect';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  const ds = app.get(DataSource);
  const dialect = detectDialect(ds.options.type as string);
  const sql = (q: string) => portableSql(q, dialect);
  const b = (v: boolean) => (dialect === 'sqlite' ? (v ? 1 : 0) : v);

  await ds.query('DELETE FROM model_pricing');
  await ds.query(
    sql(`INSERT INTO model_pricing (model_name, provider, input_price_per_token, output_price_per_token, context_window, capability_reasoning, capability_code, quality_score)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8),
       ($9, $10, $11, $12, $13, $14, $15, $16),
       ($17, $18, $19, $20, $21, $22, $23, $24)`),
    [
      'gpt-4o-mini', 'OpenAI', 0.00000015, 0.0000006, 128000, b(false), b(true), 2,
      'claude-opus-4-6', 'Anthropic', 0.000015, 0.000075, 200000, b(true), b(true), 5,
      'claude-sonnet-4', 'Anthropic', 0.000003, 0.000015, 200000, b(false), b(true), 4,
    ],
  );

  const { ModelPricingCacheService } = await import(
    '../src/model-prices/model-pricing-cache.service'
  );
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
    await auth(api().post('/api/v1/routing/providers'))
      .send({ provider: 'openai' })
      .expect(201);
    await auth(api().post('/api/v1/routing/providers'))
      .send({ provider: 'anthropic' })
      .expect(201);
  });

  it('routes "hi" → simple tier with cheapest model', async () => {
    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({ messages: [{ role: 'user', content: 'hi' }] })
      .expect(200);

    expect(res.body.tier).toBe('simple');
    expect(res.body.model).toBe('gpt-4o-mini');
    expect(res.body.provider).toBe('OpenAI');
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
    expect(res.body.provider).toBe('Anthropic');
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
    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({
        messages: [{ role: 'user', content: 'search for cats' }],
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

describe('Routing disabled after deactivation → falls back to null', () => {
  it('deactivating all providers removes model assignments', async () => {
    await auth(api().post('/api/v1/routing/providers/deactivate-all'))
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
    await auth(api().post('/api/v1/routing/providers'))
      .send({ provider: 'openai' })
      .expect(201);

    const res = await bearer(api().post('/api/v1/routing/resolve'))
      .send({ messages: [{ role: 'user', content: 'hi' }] })
      .expect(200);

    expect(res.body.model).not.toBeNull();
    expect(res.body.tier).toBe('simple');
  });
});
