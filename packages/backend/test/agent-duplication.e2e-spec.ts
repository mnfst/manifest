import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, TEST_API_KEY, TEST_AGENT_ID, TEST_TENANT_ID } from './helpers';
import { UserProvider } from '../src/entities/user-provider.entity';
import { CustomProvider } from '../src/entities/custom-provider.entity';
import { TierAssignment } from '../src/entities/tier-assignment.entity';
import { SpecificityAssignment } from '../src/entities/specificity-assignment.entity';
import { Agent } from '../src/entities/agent.entity';
import { AgentApiKey } from '../src/entities/agent-api-key.entity';
import { AgentModelParams } from '../src/entities/agent-model-params.entity';

describe('Agent Duplication (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const headers = { 'x-api-key': TEST_API_KEY };
  const sourceAgent = 'test-agent';

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);

    const now = new Date().toISOString();
    await ds.getRepository(UserProvider).insert({
      id: 'up-e2e-1',
      user_id: 'test-user-001',
      provider: 'anthropic',
      api_key_encrypted: 'enc-value',
      key_prefix: 'sk-ant',
      auth_type: 'api_key',
      label: 'Research key',
      priority: 2,
      region: null,
      is_active: true,
      connected_at: now,
      updated_at: now,
      cached_models: null,
      models_fetched_at: null,
    });
    await ds.getRepository(CustomProvider).insert({
      id: 'cp-e2e-1',
      user_id: 'test-user-001',
      name: 'custom-groq',
      base_url: 'https://api.groq.com/openai/v1',
      models: [{ model_name: 'llama-3.1-70b' }],
      created_at: now,
    });
    await ds.getRepository(TierAssignment).insert({
      id: 'ta-e2e-1',
      user_id: 'test-user-001',
      agent_id: TEST_AGENT_ID,
      tier: 'standard',
      override_route: {
        provider: 'anthropic',
        authType: 'api_key',
        model: 'anthropic/claude-opus-4-6',
      },
      auto_assigned_route: null,
      fallback_routes: [
        { provider: 'openai', authType: 'api_key', model: 'openai/gpt-4o-mini' },
      ],
      updated_at: now,
    });
    await ds.getRepository(SpecificityAssignment).insert({
      id: 'sa-e2e-1',
      user_id: 'test-user-001',
      agent_id: TEST_AGENT_ID,
      category: 'coding',
      is_active: true,
      override_route: {
        provider: 'anthropic',
        authType: 'api_key',
        model: 'anthropic/claude-opus-4-6',
      },
      auto_assigned_route: null,
      fallback_routes: null,
      updated_at: now,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /agents/:name/duplicate-preview returns counts + suggested name', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/agents/${sourceAgent}/duplicate-preview`)
      .set(headers)
      .expect(200);

    // Providers and custom providers are user-global — not counted per agent.
    expect(res.body.copied).toEqual({
      providers: 0,
      tierAssignments: 1,
      specificityAssignments: 1,
      modelParams: 0,
    });
    expect(res.body.suggested_name).toBe('test-agent-copy');
  });

  it('GET /agents/:name/duplicate-preview returns 404 for missing source', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/agents/does-not-exist/duplicate-preview')
      .set(headers)
      .expect(404);
  });

  it('POST /agents/:name/duplicate copies all config to a new agent', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/agents/${sourceAgent}/duplicate`)
      .set(headers)
      .send({ name: 'test-agent-copy' })
      .expect(201);

    expect(res.body.agent.name).toBe('test-agent-copy');
    expect(res.body.apiKey).toMatch(/^mnfst_/);
    expect(res.body.copied).toEqual({
      providers: 0,
      tierAssignments: 1,
      specificityAssignments: 1,
      modelParams: 0,
    });

    const newAgent = await ds.getRepository(Agent).findOne({
      where: { id: res.body.agent.id },
    });
    expect(newAgent).toBeTruthy();
    expect(newAgent!.tenant_id).toBe(TEST_TENANT_ID);
    expect(newAgent!.name).toBe('test-agent-copy');

    const apiKey = await ds.getRepository(AgentApiKey).findOne({
      where: { agent_id: res.body.agent.id },
    });
    expect(apiKey).toBeTruthy();
    expect(apiKey!.agent_id).not.toBe(TEST_AGENT_ID);

    // Providers and custom providers are user-global, shared by the duplicate
    // — they are not cloned per agent.
    const newTiers = await ds
      .getRepository(TierAssignment)
      .find({ where: { agent_id: res.body.agent.id } });
    expect(newTiers).toHaveLength(1);
    expect(newTiers[0].tier).toBe('standard');
    expect(newTiers[0].override_route?.model).toBe('anthropic/claude-opus-4-6');

    const newSpec = await ds
      .getRepository(SpecificityAssignment)
      .find({ where: { agent_id: res.body.agent.id } });
    expect(newSpec).toHaveLength(1);
    expect(newSpec[0].category).toBe('coding');
  });

  it('POST /agents/:name/duplicate shares user-global custom providers (no clone, keeps custom:<id> refs verbatim)', async () => {
    const now = new Date().toISOString();
    const srcAgentId = 'src-remap-agent';
    await ds.getRepository(Agent).insert({
      id: srcAgentId,
      name: 'remap-source',
      display_name: 'Remap Source',
      is_active: true,
      tenant_id: TEST_TENANT_ID,
    });
    await ds.getRepository(AgentApiKey).insert({
      id: 'ak-remap',
      key: 'enc-placeholder',
      key_hash: 'hash-remap',
      key_prefix: 'mnfst_remap',
      label: 'remap key',
      tenant_id: TEST_TENANT_ID,
      agent_id: srcAgentId,
      is_active: true,
    });

    // A user-global custom provider, shared by every agent.
    await ds.getRepository(CustomProvider).insert({
      id: 'cp-lmstudio-e2e',
      user_id: 'test-user-001',
      name: 'LM Studio',
      base_url: 'http://localhost:1234/v1',
      api_kind: 'openai',
      models: [{ model_name: 'nvidia/nemotron' }],
      created_at: now,
    });

    // A per-route model-params row that references the shared custom provider.
    // Inserted via raw SQL to avoid TypeORM deep type inference on the jsonb
    // params column.
    await ds.query(
      `INSERT INTO "agent_model_params"
       ("id","user_id","agent_id","scope_key","provider","auth_type","model_name","params","created_at","updated_at")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        'mp-remap-e2e',
        'test-user-001',
        srcAgentId,
        'tier:default',
        'custom:cp-lmstudio-e2e',
        'local',
        'nvidia/nemotron',
        JSON.stringify({ thinking: { type: 'enabled' } }),
        now,
        now,
      ],
    );

    const customBefore = await ds.getRepository(CustomProvider).count();

    const res = await request(app.getHttpServer())
      .post('/api/v1/agents/remap-source/duplicate')
      .set(headers)
      .send({ name: 'remap-copy' })
      .expect(201);

    const newAgentId = res.body.agent.id;

    // Custom providers are user-global — no new row was created for the copy.
    const customAfter = await ds.getRepository(CustomProvider).count();
    expect(customAfter).toBe(customBefore);

    // The model-params row was copied to the new agent with its custom:<id>
    // reference kept verbatim (the provider is shared, so no remap).
    const newParams = await ds
      .getRepository(AgentModelParams)
      .find({ where: { agent_id: newAgentId } });
    expect(newParams).toHaveLength(1);
    expect(newParams[0].provider).toBe('custom:cp-lmstudio-e2e');
    expect(newParams[0].id).not.toBe('mp-remap-e2e');
  });

  it('POST /agents/:name/duplicate returns 409 when target name already exists', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/agents/${sourceAgent}/duplicate`)
      .set(headers)
      .send({ name: 'test-agent-copy' })
      .expect(409);
  });

  it('POST /agents/:name/duplicate returns 404 when source does not exist', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/agents/missing/duplicate')
      .set(headers)
      .send({ name: 'anything' })
      .expect(404);
  });

  it('POST /agents/:name/duplicate rejects invalid names', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/agents/${sourceAgent}/duplicate`)
      .set(headers)
      .send({ name: '!!!' })
      .expect(400);
  });
});
