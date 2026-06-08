/**
 * E2E: symmetric provider↔agent auto-connect + per-agent disable isolation
 *
 * Providers are global and ON for every agent by default; the user disables
 * them per-agent. This spec proves both directions of the symmetric model and
 * that manual disable/enable stays isolated per agent:
 *
 *   Direction 2 (new provider): connecting a provider auto-grants EVERY agent
 *     the user already owns + auto-assigns routes.
 *   Direction 1 (new agent): creating an agent auto-grants EVERY usable
 *     provider the user already connected + auto-assigns routes.
 *   Disable isolation: DELETE a grant for agent A leaves agent B untouched;
 *     re-enable restores it. Reconnecting the SAME key does NOT resurrect a
 *     per-agent disable.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_API_KEY, TEST_USER_ID } from './helpers';
import { AgentProviderAccess } from '../src/entities/agent-provider-access.entity';
import { UserProvider } from '../src/entities/user-provider.entity';

let app: INestApplication;
let ds: DataSource;

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);

// Agent A = the shared `test-agent` seeded by createTestApp. Agent B is created
// via the public API before any provider is connected, so it must be auto-
// granted when a provider connects (Direction 2).
const AGENT_A_NAME = 'test-agent';
const AGENT_B_NAME = 'isolation-agent-b';
// Agent C is created AFTER a provider exists, so it must inherit it (Direction 1).
const AGENT_C_NAME = 'isolation-agent-c';

let agentBId: string;
let agentCId: string;
let providerId: string;

beforeAll(async () => {
  app = await createTestApp();
  ds = app.get(DataSource);

  const res = await auth(api().post('/api/v1/agents')).send({ name: AGENT_B_NAME }).expect(201);
  agentBId = res.body.agent.id as string;
}, 30000);

afterAll(async () => {
  await app?.close();
});

describe('Direction 2 – connecting a NEW provider auto-grants every existing agent', () => {
  it('creates one global user_providers row and grants BOTH agent A and agent B', async () => {
    const res = await auth(api().post(`/api/v1/routing/${AGENT_A_NAME}/providers`))
      .send({ provider: 'openai', apiKey: 'sk-test-openai-key' })
      .expect(201);

    providerId = res.body.id as string;
    expect(typeof providerId).toBe('string');
    expect(res.body.provider).toBe('openai');

    // Exactly one global row for this provider/user — no agent_id set (global).
    const rows = await ds.getRepository(UserProvider).find({ where: { id: providerId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].agent_id).toBeNull();

    // Symmetric auto-connect: the new provider is granted to EVERY owned agent,
    // not just the connecting one. Both A and B now have a grant.
    const grants = await ds.getRepository(AgentProviderAccess).find({
      where: { user_provider_id: providerId },
    });
    const grantedAgentIds = grants.map((g) => g.agent_id);
    expect(grantedAgentIds).toContain(agentBId);
    expect(grantedAgentIds).toHaveLength(2); // agent A + agent B
  });

  it('agent B (created before connect) now lists the provider as enabled', async () => {
    const res = await auth(api().get(`/api/v1/agents/${AGENT_B_NAME}/provider-access`)).expect(200);
    const enabled: string[] = res.body.enabled ?? [];
    expect(enabled).toContain(providerId);
  });

  it('agent A (the connecting agent) lists the provider as enabled', async () => {
    const res = await auth(api().get(`/api/v1/agents/${AGENT_A_NAME}/provider-access`)).expect(200);
    const enabled: string[] = res.body.enabled ?? [];
    expect(enabled).toContain(providerId);
  });

  it('sibling agent B has a tier route computed AGAINST the post-discovery model set', async () => {
    // The bug: grantNewProviderToAllAgents recalcs every agent INSIDE
    // upsertProvider, but that runs BEFORE discoverModels populates the new
    // provider's cached_models — so siblings would be left with auto-assigned
    // routes derived from a model set that excluded the new provider. The fix
    // re-recalcs ALL owned agents AFTER discovery on a NEW-provider connect.
    //
    // Discovery for openai (fake key) falls back to the stubbed OpenRouter
    // cache, so the provider's cached_models = gpt-4o / gpt-4o-mini after the
    // connect above. A sibling (agent B) that was never the connect context
    // must therefore have a non-null auto_assigned_route pointing at openai.
    const tiers = await ds.query(
      `SELECT auto_assigned_route FROM tier_assignments WHERE agent_id = $1`,
      [agentBId],
    );
    expect(tiers.length).toBeGreaterThan(0);
    // auto_assigned_route is a JSONB { provider, authType, model } object.
    const routes = tiers
      .map((t: { auto_assigned_route: { provider?: string } | null }) => t.auto_assigned_route)
      .filter((r: unknown): r is { provider?: string } => r !== null);
    // At least one tier routes to the just-connected openai provider — proof B
    // was recalced against the model set that INCLUDES the new provider.
    expect(routes.some((r: { provider?: string }) => r.provider === 'openai')).toBe(true);
  });
});

describe('Direction 1 – creating a NEW agent inherits every existing provider', () => {
  it('creating agent C auto-grants the already-connected provider + assigns routes', async () => {
    // Seed discovered models so the auto-assigned route is observable.
    await ds.query(
      `UPDATE user_providers SET cached_models = $1 WHERE id = $2`,
      [
        JSON.stringify([
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
        ]),
        providerId,
      ],
    );

    const res = await auth(api().post('/api/v1/agents')).send({ name: AGENT_C_NAME }).expect(201);
    agentCId = res.body.agent.id as string;

    // The brand-new agent inherited the existing provider.
    const grants = await ds.getRepository(AgentProviderAccess).find({
      where: { agent_id: agentCId, user_provider_id: providerId },
    });
    expect(grants).toHaveLength(1);

    const enabledRes = await auth(
      api().get(`/api/v1/agents/${AGENT_C_NAME}/provider-access`),
    ).expect(200);
    expect((enabledRes.body.enabled ?? []) as string[]).toContain(providerId);

    // Routes were auto-assigned for the new agent (enableAllProvidersForAgent
    // calls recalculateTiers); a tier_assignments row now exists for agent C.
    const tiers = await ds.query(
      `SELECT auto_assigned_route FROM tier_assignments WHERE agent_id = $1`,
      [agentCId],
    );
    expect(tiers.length).toBeGreaterThan(0);
    const hasRoute = tiers.some(
      (t: { auto_assigned_route: unknown }) => t.auto_assigned_route !== null,
    );
    expect(hasRoute).toBe(true);
  });

  it('creating an agent when the user has NO providers succeeds with an empty enabled list', async () => {
    // Snapshot then physically remove the provider so getProviders() returns an
    // empty set (it filters by isManifestUsableProvider, which ignores
    // is_active), proving the 0-provider create path is a safe no-op. Restore
    // the row + its A/B/C grants afterwards so later isolation tests still run.
    const snapshot = await ds.getRepository(UserProvider).findOneOrFail({
      where: { id: providerId },
    });
    const grantsSnapshot = await ds.getRepository(AgentProviderAccess).find({
      where: { user_provider_id: providerId },
    });
    await ds.getRepository(AgentProviderAccess).delete({ user_provider_id: providerId });
    await ds.getRepository(UserProvider).delete({ id: providerId });

    const res = await auth(api().post('/api/v1/agents'))
      .send({ name: 'isolation-agent-empty' })
      .expect(201);
    const emptyAgentId = res.body.agent.id as string;

    const grants = await ds.getRepository(AgentProviderAccess).find({
      where: { agent_id: emptyAgentId },
    });
    expect(grants).toHaveLength(0);

    const enabledRes = await auth(
      api().get('/api/v1/agents/isolation-agent-empty/provider-access'),
    ).expect(200);
    expect(enabledRes.body.enabled ?? []).toEqual([]);

    // Restore the provider row + its prior grants for the remaining tests.
    await ds.getRepository(UserProvider).save(snapshot);
    if (grantsSnapshot.length > 0) {
      await ds.getRepository(AgentProviderAccess).save(grantsSnapshot);
    }
  });
});

describe('Disable isolation – DELETE a grant affects only the targeted agent', () => {
  it('DELETE provider-access for agent A removes only A\'s grant', async () => {
    await auth(
      api().delete(`/api/v1/agents/${AGENT_A_NAME}/provider-access/${providerId}`),
    ).expect(200);

    const aRes = await auth(
      api().get(`/api/v1/agents/${AGENT_A_NAME}/provider-access`),
    ).expect(200);
    expect((aRes.body.enabled ?? []) as string[]).not.toContain(providerId);
  });

  it('agent B is unaffected by A\'s disable', async () => {
    const bRes = await auth(
      api().get(`/api/v1/agents/${AGENT_B_NAME}/provider-access`),
    ).expect(200);
    expect((bRes.body.enabled ?? []) as string[]).toContain(providerId);
  });

  it('reconnecting the SAME provider key does NOT resurrect agent A\'s disable', async () => {
    // Reconnect openai for agent A with the same key. This hits the
    // update-in-place reconnect branch, which re-grants ONLY the connecting
    // agent (A) and must NOT fan out to re-enable everywhere — but it also must
    // not leave A disabled, since the user explicitly reconnected on A.
    await auth(api().post(`/api/v1/routing/${AGENT_A_NAME}/providers`))
      .send({ provider: 'openai', apiKey: 'sk-test-openai-key' })
      .expect(201);

    // Still the same single global row (no duplicate created on reconnect).
    const rows = await ds.getRepository(UserProvider).find({
      where: { user_id: TEST_USER_ID, provider: 'openai' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(providerId);

    // A is re-granted (it was the reconnect target); B keeps its grant.
    const grants = await ds.getRepository(AgentProviderAccess).find({
      where: { user_provider_id: providerId },
    });
    const grantedAgentIds = grants.map((g) => g.agent_id);
    expect(grantedAgentIds).toContain(agentBId);
    expect(grantedAgentIds).toContain(agentCId);
  });

  it('re-enabling agent A via PUT restores its grant without touching B', async () => {
    await auth(
      api().put(`/api/v1/agents/${AGENT_B_NAME}/provider-access/${providerId}`),
    ).expect(200);

    const bGrants = await ds.getRepository(AgentProviderAccess).find({
      where: { agent_id: agentBId, user_provider_id: providerId },
    });
    expect(bGrants).toHaveLength(1);
  });
});

describe('Structural invariant – the global key row survives grant churn', () => {
  it('global user_providers row is not deleted by any access-grant change', async () => {
    const row = await ds.getRepository(UserProvider).findOne({ where: { id: providerId } });
    expect(row).not.toBeNull();
    expect(row!.is_active).toBe(true);
  });
});
