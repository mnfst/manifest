/**
 * Global (user-level) provider connections — the key end-to-end proof.
 *
 * Provider connections are now USER-scoped: connecting a provider to ONE agent
 * writes a user-scoped `user_providers` row (agent_id NULL), and every agent of
 * that user reads the shared global pool. This spec proves the headline promise:
 *
 *   connect a provider once via agentA  →  a DIFFERENT agent (agentB) of the
 *   same user sees that provider's models.
 *
 * The connect API stays agent-scoped (`POST /api/v1/routing/:agentA/providers`),
 * but the backend lifts the row to the global pool. We then assert:
 *   1. GET /api/v1/providers (the slim user-scoped list) returns the connection.
 *   2. GET /api/v1/routing/:agentB/available-models includes the provider's
 *      models — proving the global pool reaches an agent that was NOT used to
 *      connect.
 *   3. The persisted user_providers row has user_id set and agent_id NULL.
 *
 * Network determinism: the OpenAI native /models endpoint is stubbed (returns
 * the two GPT-4o ids), layered on top of the OpenRouter pricing fixture already
 * stubbed by the shared test harness. No real network is required.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_API_KEY, TEST_USER_ID } from './helpers';

const OPENAI_MODELS_URL = 'https://api.openai.com/v1/models';
const OPENAI_MODELS_FIXTURE = {
  object: 'list',
  data: [
    { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
    { id: 'gpt-4o-mini', object: 'model', owned_by: 'openai' },
  ],
};

let app: INestApplication;
let restoreFetch: () => void;

function stubOpenAiModelsFetch(): () => void {
  const originalFetch = global.fetch;
  global.fetch = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === OPENAI_MODELS_URL) {
      return new Response(JSON.stringify(OPENAI_MODELS_FIXTURE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  return () => {
    global.fetch = originalFetch;
  };
}

beforeAll(async () => {
  // Stub the OpenAI native /models endpoint before the app boots so provider
  // discovery is fully offline and deterministic.
  restoreFetch = stubOpenAiModelsFetch();
  app = await createTestApp();
}, 30000);

afterAll(async () => {
  await app?.close();
  restoreFetch?.();
});

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);

describe('Global provider connections (e2e)', () => {
  // agentA is the pre-seeded agent from the harness; agentB is a second agent
  // of the SAME user, created below. Both live in the same tenant.
  const agentA = 'test-agent';
  let agentB = '';

  it('creates a second agent (agentB) for the same user', async () => {
    const res = await auth(api().post('/api/v1/agents'))
      .send({ name: 'Second Agent' })
      .expect(201);
    expect(res.body.agent.name).toBeTruthy();
    agentB = res.body.agent.name;
    expect(agentB).not.toBe(agentA);
  });

  it('connects an OpenAI API-key provider via agentA', async () => {
    const res = await auth(api().post(`/api/v1/routing/${agentA}/providers`))
      .send({ provider: 'openai', apiKey: 'sk-global-test-key' })
      .expect(201);

    expect(res.body.provider).toBe('openai');
    expect(res.body.auth_type).toBe('api_key');
    expect(res.body.is_active).toBe(true);
  });

  it('GET /api/v1/providers returns the connection (user-scoped list)', async () => {
    const res = await auth(api().get('/api/v1/providers')).expect(200);

    const openai = res.body.find((p: { provider: string }) => p.provider === 'openai');
    expect(openai).toBeDefined();
    expect(openai.auth_type).toBe('api_key');
    expect(openai.is_active).toBe(true);
    expect(openai.has_api_key).toBe(true);
    // Discovery ran on connect; the OpenAI native /models stub + OpenRouter
    // pricing fixture together yield cached models for this connection.
    expect(openai.cached_model_count).toBeGreaterThan(0);
  });

  it('GET /:agentB/available-models includes the provider models — global pool reaches a DIFFERENT agent', async () => {
    const res = await auth(api().get(`/api/v1/routing/${agentB}/available-models`)).expect(200);

    const openaiModels = res.body.filter((m: { provider: string }) => m.provider === 'openai');
    expect(openaiModels.length).toBeGreaterThan(0);

    // The two GPT-4o ids come from the OpenAI native /models stub, enriched with
    // pricing from the OpenRouter fixture. They are visible on agentB even though
    // the provider was connected through agentA — that is the global pool proof.
    const ids = openaiModels.map((m: { model_name: string }) => m.model_name);
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('gpt-4o-mini');
  });

  it('persists a user-scoped (global) user_providers row: user_id set, agent_id NULL', async () => {
    const ds = app.get(DataSource);
    const rows: Array<{ user_id: string | null; agent_id: string | null; is_active: boolean }> =
      await ds.query(
        `SELECT user_id, agent_id, is_active FROM user_providers WHERE provider = 'openai' AND auth_type = 'api_key'`,
      );

    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0];
    expect(row.user_id).toBe(TEST_USER_ID);
    // Global connection: not pinned to the agent it was connected through.
    expect(row.agent_id).toBeNull();
    expect(row.is_active).toBe(true);
  });
});
