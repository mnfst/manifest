/**
 * Smoke tests — 9 sequential end-to-end tests covering auth, agent creation,
 * data seeding, routing, proxy, limits, and fallback chains.
 *
 * All tests share state: each builds on the previous.
 * A local mock HTTP server stands in for real LLM providers.
 */
import { INestApplication } from '@nestjs/common';
import * as http from 'http';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';

/* ------------------------------------------------------------------ */
/*  Mock LLM server                                                    */
/* ------------------------------------------------------------------ */
let mockServer: http.Server;
let mockPort: number;
const mockCallLog: Array<{ model: string }> = [];
const mockResponses = new Map<string, { status: number; body: unknown }>();

function startMockServer(): Promise<void> {
  return new Promise((resolve) => {
    mockServer = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        const parsed = JSON.parse(raw) as { model: string };
        mockCallLog.push({ model: parsed.model });

        const entry = mockResponses.get(parsed.model);
        const status = entry?.status ?? 200;
        const body = entry?.body ?? {
          id: 'chatcmpl-mock',
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: parsed.model,
          choices: [
            { index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        };

        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      });
    });
    mockServer.listen(0, '127.0.0.1', () => {
      mockPort = (mockServer.address() as { port: number }).port;
      resolve();
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Shared state                                                       */
/* ------------------------------------------------------------------ */
let app: INestApplication;
let smokeAgentName: string;
let smokeOtlpKey: string;
let customProviderId: string;
let blockRuleId: string;

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);
const smokeBearer = (r: request.Test) =>
  r.set('Authorization', `Bearer ${smokeOtlpKey}`);

async function waitForMessages(
  agentName: string,
  minCount: number,
  timeoutMs = 3000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await auth(api().get(`/api/v1/messages?range=24h&agent_name=${agentName}`));
    if (res.body.total_count >= minCount) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${minCount} messages for ${agentName}`);
}

/* ------------------------------------------------------------------ */
/*  Bootstrap                                                          */
/* ------------------------------------------------------------------ */
beforeAll(async () => {
  await startMockServer();
  app = await createTestApp();

  // Create minimal "user" table (normally managed by Better Auth, absent in tests).
  // The notification cron's resolveUserEmail() queries it.
  const { DataSource } = await import('typeorm');
  const ds = app.get(DataSource);
  await ds.query(
    'CREATE TABLE IF NOT EXISTS "user" (id VARCHAR PRIMARY KEY, email VARCHAR)',
  );
}, 30_000);

afterAll(async () => {
  await app.close();
  mockServer.close();
});

/* ------------------------------------------------------------------ */
/*  ST-01 · Auth is working                                            */
/* ------------------------------------------------------------------ */
describe('ST-01: Auth', () => {
  it('returns 200 with valid API key', async () => {
    const res = await auth(api().get('/api/v1/agents')).expect(200);
    expect(res.body).toHaveProperty('agents');
  });

  it('returns 401 without auth', async () => {
    await api().get('/api/v1/agents').expect(401);
  });
});

/* ------------------------------------------------------------------ */
/*  ST-02 · Create agent                                               */
/* ------------------------------------------------------------------ */
describe('ST-02: Create agent', () => {
  it('creates agent and returns mnfst_* API key', async () => {
    const res = await auth(api().post('/api/v1/agents'))
      .send({ name: 'Smoke Agent' })
      .expect(201);

    expect(res.body.agent.name).toBe('smoke-agent');
    expect(res.body.apiKey).toMatch(/^mnfst_/);

    smokeAgentName = res.body.agent.name;
    smokeOtlpKey = res.body.apiKey;
  });
});

/* ------------------------------------------------------------------ */
/*  ST-03 · Seed agent message data for downstream tests               */
/* ------------------------------------------------------------------ */
describe('ST-03: Seed agent data', () => {
  it('inserts a message row for the smoke agent', async () => {
    const { DataSource } = await import('typeorm');
    const { v4: uuidv4 } = await import('uuid');
    const ds = app.get(DataSource);

    // Look up tenant and agent IDs created by ST-02
    const agents = await ds.query(
      `SELECT id, tenant_id FROM agents WHERE name = $1`,
      [smokeAgentName],
    );
    expect(agents.length).toBe(1);

    const tenantId = agents[0].tenant_id;
    const agentId = agents[0].id;
    // Use a timestamp 60s in the past so period boundary comparisons are safe
    const past = new Date(Date.now() - 60_000).toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

    await ds.query(
      `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, agent_name, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [uuidv4(), tenantId, agentId, past, 'ok', 'test-model', 500, 200, 0, 0, smokeAgentName, 'test-user-001'],
    );

    // Verify message is visible in the API
    const res = await auth(
      api().get(`/api/v1/messages?range=24h&agent_name=${smokeAgentName}`),
    ).expect(200);
    expect(res.body.total_count).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ */
/*  ST-04 · Routing can be enabled                                     */
/* ------------------------------------------------------------------ */
describe('ST-04: Routing enabled', () => {
  it('creates a custom provider and enables routing', async () => {
    const res = await auth(
      api().post(`/api/v1/routing/${smokeAgentName}/custom-providers`),
    )
      .send({
        name: 'Mock Provider',
        base_url: `http://127.0.0.1:${mockPort}`,
        apiKey: 'mock-key',
        models: [
          { model_name: 'model-primary', input_price_per_million_tokens: 0.1, output_price_per_million_tokens: 0.1 },
          { model_name: 'model-a', input_price_per_million_tokens: 0.5, output_price_per_million_tokens: 0.5 },
          { model_name: 'model-b', input_price_per_million_tokens: 1, output_price_per_million_tokens: 1 },
          { model_name: 'model-c', input_price_per_million_tokens: 2, output_price_per_million_tokens: 2 },
        ],
      })
      .expect(201);

    customProviderId = res.body.id;

    const status = await auth(
      api().get(`/api/v1/routing/${smokeAgentName}/status`),
    ).expect(200);
    expect(status.body.enabled).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  ST-05 · Tier-based routing classifies correctly                    */
/* ------------------------------------------------------------------ */
describe('ST-05: Tier routing', () => {
  it('routes "hi" to the simple tier', async () => {
    const res = await smokeBearer(api().post('/api/v1/routing/resolve'))
      .send({ messages: [{ role: 'user', content: 'hi' }] })
      .expect(200);

    expect(res.body.tier).toBe('simple');
    expect(res.body.model).not.toBeNull();
  });

  it('routes a complex prompt to a higher tier', async () => {
    const res = await smokeBearer(api().post('/api/v1/routing/resolve'))
      .send({
        messages: [
          {
            role: 'user',
            content:
              'Write a distributed microservice architecture with Kubernetes, implement OAuth2 authentication middleware, and deploy with a CI/CD pipeline',
          },
        ],
      })
      .expect(200);

    expect(['complex', 'reasoning']).toContain(res.body.tier);
    expect(res.body.model).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  ST-06 · Message is sent through the proxy and recorded             */
/* ------------------------------------------------------------------ */
describe('ST-06: Proxy message recorded', () => {
  it('forwards through mock provider and updates message list', async () => {
    const before = await auth(
      api().get(`/api/v1/messages?range=24h&agent_name=${smokeAgentName}`),
    ).expect(200);
    const baseline = before.body.total_count;

    mockCallLog.length = 0;

    const res = await smokeBearer(api().post('/v1/chat/completions'))
      .send({ messages: [{ role: 'user', content: 'hello' }], stream: false })
      .expect(200);

    expect(res.body.choices).toBeDefined();
    expect(res.body.choices[0].message.content).toBe('OK');
    expect(res.headers['x-manifest-tier']).toBeDefined();
    expect(mockCallLog.length).toBeGreaterThan(0);

    // The proxy records the message asynchronously; poll briefly
    await waitForMessages(smokeAgentName, baseline + 1);
  });
});

/* ------------------------------------------------------------------ */
/*  ST-07 · Soft limit triggers a notification log                     */
/* ------------------------------------------------------------------ */
describe('ST-07: Soft limit notification', () => {
  it('triggers a notification when threshold is exceeded', async () => {
    // Create a notify rule with a threshold below current consumption
    await auth(api().post('/api/v1/notifications'))
      .send({
        agent_name: smokeAgentName,
        metric_type: 'tokens',
        threshold: 1,
        period: 'day',
        action: 'notify',
      })
      .expect(201);

    // Manually trigger the cron check
    const res = await auth(api().post('/api/v1/notifications/trigger-check')).expect(201);
    expect(res.body.triggered).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  ST-08 · Hard limit blocks proxy requests                           */
/* ------------------------------------------------------------------ */
describe('ST-08: Hard limit blocks', () => {
  it('returns friendly limit message when block rule is exceeded', async () => {
    const rule = await auth(api().post('/api/v1/notifications'))
      .send({
        agent_name: smokeAgentName,
        metric_type: 'tokens',
        threshold: 1,
        period: 'day',
        action: 'block',
      })
      .expect(201);
    blockRuleId = rule.body.id;

    mockCallLog.length = 0;

    const res = await smokeBearer(api().post('/v1/chat/completions'))
      .send({ messages: [{ role: 'user', content: 'blocked?' }], stream: false })
      .expect(200);

    // Limit exceeded returns a friendly chat completion message
    expect(res.body.choices[0].message.content).toContain('You hit your tokens limit');
    // Mock server should NOT have been called — blocked before forwarding
    expect(mockCallLog.length).toBe(0);
  });

  afterAll(async () => {
    // Clean up block rule so ST-09 can proceed
    await auth(api().delete(`/api/v1/notifications/${blockRuleId}`)).expect(200);
  });
});

/* ------------------------------------------------------------------ */
/*  ST-09 · Fallback models trigger in the right order                 */
/* ------------------------------------------------------------------ */
describe('ST-09: Fallback chain', () => {
  const provKey = () => `custom:${customProviderId}`;
  const modelKey = (m: string) => `${provKey()}/${m}`;

  beforeAll(async () => {
    // Set tier override so the primary model is model-a
    await auth(api().put(`/api/v1/routing/${smokeAgentName}/tiers/simple`))
      .send({ model: modelKey('model-a') })
      .expect(200);

    // Set fallback chain: model-b → model-c
    await auth(
      api().put(`/api/v1/routing/${smokeAgentName}/tiers/simple/fallbacks`),
    )
      .send({ models: [modelKey('model-b'), modelKey('model-c')] })
      .expect(200);

    // Program mock: model-a → 500, model-b → 500, model-c → 200
    mockResponses.set('model-a', {
      status: 500,
      body: { error: { message: 'fail-a', type: 'server_error' } },
    });
    mockResponses.set('model-b', {
      status: 500,
      body: { error: { message: 'fail-b', type: 'server_error' } },
    });
    mockResponses.delete('model-c'); // default 200
    mockCallLog.length = 0;
  });

  it('tries primary, then fallbacks in order, succeeds on model-c', async () => {
    const res = await smokeBearer(api().post('/v1/chat/completions'))
      .send({ messages: [{ role: 'user', content: 'hi' }], stream: false });

    // Should succeed via fallback model-c
    expect(res.status).toBe(200);
    expect(res.headers['x-manifest-fallback-from']).toBeDefined();

    // Verify call order: model-a (primary) → model-b (fallback 0) → model-c (fallback 1)
    const models = mockCallLog.map((c) => c.model);
    expect(models).toEqual(['model-a', 'model-b', 'model-c']);
  });
});
