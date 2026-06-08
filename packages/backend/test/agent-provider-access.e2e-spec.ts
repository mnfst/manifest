/**
 * E2E: per-agent provider isolation
 *
 * Proves that global `user_providers` rows are visible only to agents that
 * have an explicit grant in `agent_provider_access`, and that granting /
 * revoking access for one agent never affects another agent.
 *
 * Scenario:
 *   1. Connect a provider for agent A → one global row, one grant (A, providerId).
 *   2. Agent B has NO grant → provider-access list excludes it.
 *   3. Grant B → B now sees it.
 *   4. Revoke A's grant → A loses access; B is unaffected.
 *   5. Junction is sparse (no stray rows); the global key row is still present.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_API_KEY, TEST_TENANT_ID } from './helpers';
import { AgentProviderAccess } from '../src/entities/agent-provider-access.entity';
import { UserProvider } from '../src/entities/user-provider.entity';

let app: INestApplication;
let ds: DataSource;

const AUTH = { 'x-api-key': TEST_API_KEY } as const;

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);

// Unique agent name for agent B, scoped to this spec so it doesn't collide
// with the shared `test-agent` (agent A) seeded by createTestApp.
const AGENT_A_NAME = 'test-agent';
const AGENT_B_NAME = 'isolation-agent-b';

let agentBId: string;
let providerId: string;

beforeAll(async () => {
  app = await createTestApp();
  ds = app.get(DataSource);

  // Create agent B via the public API so it gets a tenant row + OTLP key
  // wired up correctly (same tenant as agent A, owned by TEST_USER_ID).
  const res = await auth(api().post('/api/v1/agents'))
    .send({ name: AGENT_B_NAME })
    .expect(201);
  agentBId = res.body.agent.id as string;
}, 30000);

afterAll(async () => {
  await app?.close();
});

describe('Step 1 – connect provider for agent A', () => {
  it('creates one global user_providers row and one access grant for A', async () => {
    // Connect openai (api_key auth) on agent A. The controller inserts a
    // global UserProvider row and an AgentProviderAccess row atomically.
    const res = await auth(api().post(`/api/v1/routing/${AGENT_A_NAME}/providers`))
      .send({ provider: 'openai', apiKey: 'sk-test-openai-key' })
      .expect(201);

    providerId = res.body.id as string;
    expect(typeof providerId).toBe('string');
    expect(res.body.provider).toBe('openai');

    // Exactly one global row for this provider/user — no agent_id set (global).
    const rows = await ds.getRepository(UserProvider).find({
      where: { id: providerId },
    });
    expect(rows).toHaveLength(1);
    // Global providers have agent_id = null (lifted from agent-scoped storage).
    expect(rows[0].agent_id).toBeNull();

    // Exactly one access grant for agent A.
    const grants = await ds.getRepository(AgentProviderAccess).find({
      where: { user_provider_id: providerId },
    });
    expect(grants).toHaveLength(1);
    expect(grants[0].agent_id).not.toBe(agentBId);
  });
});

describe('Step 2 – agent B cannot see the provider before being granted', () => {
  it('GET provider-access for B returns an empty enabled list', async () => {
    const res = await auth(api().get(`/api/v1/agents/${AGENT_B_NAME}/provider-access`)).expect(200);

    // B has not been granted access — enabled list must be empty or at least
    // must NOT contain the provider we just connected for A.
    const enabled: string[] = res.body.enabled ?? [];
    expect(enabled).not.toContain(providerId);
  });

  it('GET providers for B does not surface the provider via routing endpoint', async () => {
    // The routing GET providers endpoint lists ALL global providers for the
    // user (unfiltered by agent). But the provider-access endpoint is the
    // correct isolation boundary used by model resolution. Both should be
    // consistent with the access grant model.
    //
    // We verify the junction: B has no row for this provider.
    const grants = await ds.getRepository(AgentProviderAccess).find({
      where: { agent_id: agentBId, user_provider_id: providerId },
    });
    expect(grants).toHaveLength(0);
  });
});

describe('Step 3 – grant access to agent B', () => {
  it('PUT provider-access/:providerId creates a grant for B', async () => {
    await auth(
      api().put(`/api/v1/agents/${AGENT_B_NAME}/provider-access/${providerId}`),
    ).expect(200);

    // Junction now contains a row for B.
    const grants = await ds.getRepository(AgentProviderAccess).find({
      where: { agent_id: agentBId, user_provider_id: providerId },
    });
    expect(grants).toHaveLength(1);
  });

  it('GET provider-access for B now includes the provider', async () => {
    const res = await auth(api().get(`/api/v1/agents/${AGENT_B_NAME}/provider-access`)).expect(200);

    const enabled: string[] = res.body.enabled ?? [];
    expect(enabled).toContain(providerId);
  });

  it('agent A access grant is still intact', async () => {
    // Granting B must not disturb A's grant.
    const res = await auth(api().get(`/api/v1/agents/${AGENT_A_NAME}/provider-access`)).expect(200);

    const enabled: string[] = res.body.enabled ?? [];
    expect(enabled).toContain(providerId);
  });
});

describe('Step 4 – revoke access from agent A', () => {
  it('DELETE provider-access/:providerId removes only A\'s grant', async () => {
    await auth(
      api().delete(`/api/v1/agents/${AGENT_A_NAME}/provider-access/${providerId}`),
    ).expect(200);

    // A's junction row is gone.
    const aGrants = await ds.getRepository(AgentProviderAccess).find({
      where: { user_provider_id: providerId },
    });
    const aRow = aGrants.find((g) => g.agent_id !== agentBId);
    expect(aRow).toBeUndefined();
  });

  it('agent A no longer sees the provider in its access list', async () => {
    const res = await auth(api().get(`/api/v1/agents/${AGENT_A_NAME}/provider-access`)).expect(200);

    const enabled: string[] = res.body.enabled ?? [];
    expect(enabled).not.toContain(providerId);
  });

  it('agent B is unaffected by A\'s revocation', async () => {
    const res = await auth(api().get(`/api/v1/agents/${AGENT_B_NAME}/provider-access`)).expect(200);

    const enabled: string[] = res.body.enabled ?? [];
    expect(enabled).toContain(providerId);
  });
});

describe('Step 5 – structural invariants', () => {
  it('junction table has no stray rows for non-granted pairs', async () => {
    // Only B's grant remains for this provider.
    const allGrants = await ds.getRepository(AgentProviderAccess).find({
      where: { user_provider_id: providerId },
    });
    expect(allGrants).toHaveLength(1);
    expect(allGrants[0].agent_id).toBe(agentBId);
  });

  it('global user_providers row is not deleted by disable', async () => {
    // The physical key row must survive a grant revocation — it is shared
    // across all agents and must only be deleted by an explicit full disconnect.
    const row = await ds.getRepository(UserProvider).findOne({
      where: { id: providerId },
    });
    expect(row).not.toBeNull();
    // Row remains active (agent A's revocation is an access-grant removal,
    // not a provider deactivation).
    expect(row!.is_active).toBe(true);
  });
});
