import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import request from 'supertest';
import {
  createTestApp,
  TEST_API_KEY,
  TEST_TENANT_ID,
  TEST_AGENT_ID,
  TEST_USER_ID,
} from './helpers';

let app: INestApplication;
let connectionId: string;
let workConnectionId: string;
let personalConnectionId: string;

beforeAll(async () => {
  app = await createTestApp();
  const ds = app.get(DataSource);
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

  // A user-global OpenAI connection (agent_id NULL = global under the new schema).
  connectionId = uuid();
  await ds.query(
    `INSERT INTO user_providers (id, user_id, agent_id, provider, key_prefix, auth_type, label, is_active, connected_at, updated_at, cached_models)
     VALUES ($1,$2,NULL,$3,$4,$5,$6,true,$7,$7,$8)`,
    [
      connectionId,
      TEST_USER_ID,
      'openai',
      'sk-abc',
      'subscription',
      'My OpenAI',
      now,
      JSON.stringify([{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }]),
    ],
  );

  // Subscription-auth messages on openai for the test agent, tagged with the
  // connection's label so they belong to the 'My OpenAI' connection detail.
  for (const [model, inTok, outTok] of [
    ['gpt-4o', 1000, 500],
    ['gpt-4o-mini', 200, 100],
  ] as Array<[string, number, number]>) {
    await ds.query(
      `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, provider, auth_type, provider_key_label, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd, description, service_type, agent_name, user_id)
       VALUES ($1,$2,$3,$4,'ok',$5,'openai','subscription','My OpenAI',$6,$7,0,0,$8,'msg','agent','test-agent',$9)`,
      [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, now, model, inTok, outTok, 0.01, TEST_USER_ID],
    );
  }

  // Finding 1 (join duplication): a SOFT-DELETED agent that reuses the live
  // agent's slug `test-agent` in the same tenant. A name-based agents join
  // (a.name = at.agent_name) would match BOTH this row and the live agent for
  // every `test-agent` message, doubling every per-agent SUM. The id-based
  // join (a.id = at.agent_id) matches only the live agent, so totals stay exact.
  const ghostAgentId = uuid();
  await ds.query(
    `INSERT INTO agents (id, name, display_name, description, is_active, complexity_routing_enabled, tenant_id, created_at, updated_at, deleted_at)
     VALUES ($1,'test-agent','Old Test Agent','recreated slug',false,true,$2,$3,$3,$3)`,
    [ghostAgentId, TEST_TENANT_ID, now],
  );

  // Finding 1: a reserved Playground (is_system) agent whose usage must NOT
  // pollute provider analytics aggregates or the connection breakdown.
  const playgroundAgentId = uuid();
  await ds.query(
    `INSERT INTO agents (id, name, display_name, description, is_active, is_system, complexity_routing_enabled, tenant_id, created_at, updated_at)
     VALUES ($1,'Playground','Playground','reserved',true,true,true,$2,$3,$3)`,
    [playgroundAgentId, TEST_TENANT_ID, now],
  );
  await ds.query(
    `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, provider, auth_type, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd, description, service_type, agent_name, user_id)
     VALUES ($1,$2,$3,$4,'ok','gpt-4o','openai','subscription',9000,9000,0,0,0.99,'msg','agent','Playground',$5)`,
    [uuid(), TEST_TENANT_ID, playgroundAgentId, now, TEST_USER_ID],
  );

  // P2 leak case: an ORPHAN Playground message with a NULL agent_id but
  // agent_name = 'Playground'. The previous id-only exclusion join left this
  // row's `is_system` NULL and wrongly INCLUDED it. The NOT EXISTS semi-join
  // matches the reserved Playground agent by NAME too, so this row is excluded
  // from every aggregate, timeseries and the connection breakdown.
  await ds.query(
    `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, provider, auth_type, provider_key_label, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd, description, service_type, agent_name, user_id)
     VALUES ($1,$2,NULL,$3,'ok','gpt-4o','openai','subscription','My OpenAI',7000,7000,0,0,0.77,'msg','agent','Playground',$4)`,
    [uuid(), TEST_TENANT_ID, now, TEST_USER_ID],
  );

  // Finding 2: two connections sharing provider+auth_type but differing by
  // label. Each has one message tagged with its provider_key_label; the
  // connection-detail endpoint must keep their usage separate.
  workConnectionId = uuid();
  personalConnectionId = uuid();
  for (const [id, label] of [
    [workConnectionId, 'Work'],
    [personalConnectionId, 'Personal'],
  ] as Array<[string, string]>) {
    await ds.query(
      `INSERT INTO user_providers (id, user_id, agent_id, provider, key_prefix, auth_type, label, is_active, connected_at, updated_at, cached_models)
       VALUES ($1,$2,NULL,'anthropic',$3,'api_key',$4,true,$5,$5,$6)`,
      [id, TEST_USER_ID, `sk-${label}`, label, now, JSON.stringify([{ id: 'claude' }])],
    );
    await ds.query(
      `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, provider, auth_type, provider_key_label, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd, description, service_type, agent_name, user_id)
       VALUES ($1,$2,$3,$4,'ok','claude','anthropic','api_key',$5,$6,$6,0,0,0.02,'msg','agent','test-agent',$7)`,
      [
        uuid(),
        TEST_TENANT_ID,
        TEST_AGENT_ID,
        now,
        label,
        label === 'Work' ? 111 : 222,
        TEST_USER_ID,
      ],
    );
  }
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/v1/provider-analytics', () => {
  it('returns summary + token/message usage for subscription auth', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/provider-analytics?auth_type=subscription&range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('token_usage');
    expect(res.body).toHaveProperty('message_usage');
    expect(res.body.summary.messages.value).toBeGreaterThan(0);
  });

  it('excludes the reserved Playground (is_system) agent from summary aggregates', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/provider-analytics?auth_type=subscription&provider=openai&range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    // Real openai subscription usage is 2 messages / 1800 tokens. Both the
    // Playground message with a matching agent_id (18000 tokens) AND the orphan
    // Playground message with a NULL agent_id but agent_name 'Playground'
    // (14000 tokens) must be excluded, so the summary reflects only the
    // non-system rows. The orphan is the P2 leak case the name-based NOT EXISTS
    // exclusion fixes — an id-only join would have counted it.
    expect(res.body.summary.messages.value).toBe(2);
    expect(res.body.summary.tokens.value).toBe(1800);
  });

  it('excludes an orphan Playground row (NULL agent_id, name only) from per-agent timeseries (P2)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/provider-analytics/per-agent-timeseries?auth_type=subscription&provider=openai')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    // The orphan carries agent_name 'Playground'; the id-or-name semi-join drops
    // it, so no 'Playground' column appears and test-agent stays at 1800.
    expect(res.body.agents).not.toContain('Playground');
    const total = res.body.timeseries.reduce(
      (sum: number, row: Record<string, number>) => sum + (row['test-agent'] ?? 0),
      0,
    );
    expect(total).toBe(1800);
  });

  it('supports the agents endpoint', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/provider-analytics/agents?auth_type=subscription')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.agents).toContain('test-agent');
  });

  it('returns per-agent token timeseries pivots', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/provider-analytics/per-agent-timeseries?auth_type=subscription&provider=openai')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body).toHaveProperty('agents');
    expect(res.body).toHaveProperty('timeseries');
    expect(res.body.agents).toContain('test-agent');
  });

  it('does not double-count when a soft-deleted agent shares a slug (Finding 1)', async () => {
    // Real openai subscription usage for `test-agent` is exactly 1800 tokens
    // (1500 + 300). A soft-deleted agent reuses the same slug+tenant, so a
    // name-based join would report 3600. The id-based join keeps it at 1800.
    const res = await request(app.getHttpServer())
      .get('/api/v1/provider-analytics/per-agent-timeseries?auth_type=subscription&provider=openai')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    const total = res.body.timeseries.reduce(
      (sum: number, row: Record<string, number>) => sum + (row['test-agent'] ?? 0),
      0,
    );
    expect(total).toBe(1800);
  });

  it('returns per-agent message + cost timeseries', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/v1/provider-analytics/per-agent-message-timeseries?auth_type=subscription&provider=openai',
      )
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    await request(app.getHttpServer())
      .get(
        '/api/v1/provider-analytics/per-agent-cost-timeseries?auth_type=subscription&provider=openai&range=7d',
      )
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
  });

  it('scopes per-agent timeseries to a single connection label (P2)', async () => {
    // Work and Personal share provider=anthropic, auth_type=api_key. Without the
    // label filter the per-agent chart for either connection would merge both
    // (666 tokens). With it, Work sees only its 222 tokens.
    const merged = await request(app.getHttpServer())
      .get('/api/v1/provider-analytics/per-agent-timeseries?auth_type=api_key&provider=anthropic')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    const mergedTotal = merged.body.timeseries.reduce(
      (sum: number, row: Record<string, number>) => sum + (row['test-agent'] ?? 0),
      0,
    );
    expect(mergedTotal).toBe(666);

    const work = await request(app.getHttpServer())
      .get(
        '/api/v1/provider-analytics/per-agent-timeseries?auth_type=api_key&provider=anthropic&label=Work',
      )
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    const workTotal = work.body.timeseries.reduce(
      (sum: number, row: Record<string, number>) => sum + (row['test-agent'] ?? 0),
      0,
    );
    expect(workTotal).toBe(222);
  });

  it('scopes the summary + message timeseries to a connection label (P2)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/provider-analytics?auth_type=api_key&provider=anthropic&label=Personal&range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    // Personal key: one message, 444 tokens — Work's 222 must not leak in.
    expect(res.body.summary.messages.value).toBe(1);
    expect(res.body.summary.tokens.value).toBe(444);

    const msg = await request(app.getHttpServer())
      .get(
        '/api/v1/provider-analytics/per-agent-message-timeseries?auth_type=api_key&provider=anthropic&label=Personal',
      )
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    const personalMessages = msg.body.timeseries.reduce(
      (sum: number, row: Record<string, number>) => sum + (row['test-agent'] ?? 0),
      0,
    );
    expect(personalMessages).toBe(1);

    const cost = await request(app.getHttpServer())
      .get(
        '/api/v1/provider-analytics/per-agent-cost-timeseries?auth_type=api_key&provider=anthropic&label=Work',
      )
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(cost.body.agents).toContain('test-agent');
  });

  it('returns connection detail for an owned connection', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/provider-analytics/connection-detail?connection_id=${connectionId}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body.connection).toMatchObject({
      id: connectionId,
      provider: 'openai',
      auth_type: 'subscription',
      cached_model_count: 2,
    });
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.agents.some((a: { agent_name: string }) => a.agent_name === 'test-agent')).toBe(
      true,
    );
    expect(Array.isArray(res.body.model_usage)).toBe(true);
    expect(res.body.model_usage.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.recent_messages)).toBe(true);
    // The agent breakdown joins agents by id, not name, so the soft-deleted
    // agent reusing the 'test-agent' slug cannot double-count it. Both the agent
    // and model breakdowns cover the same messages, so their token sums must be
    // equal; a name-based join would inflate the agent side to twice the model side.
    const agentTokens = res.body.agents.reduce(
      (s: number, a: { tokens_30d: number }) => s + Number(a.tokens_30d),
      0,
    );
    const modelTokens = res.body.model_usage.reduce(
      (s: number, m: { tokens: number }) => s + Number(m.tokens),
      0,
    );
    expect(agentTokens).toBe(modelTokens);
    // P2 leak guard: the orphan Playground row (NULL agent_id, name 'Playground',
    // label 'My OpenAI') also carries this connection's label, so without the
    // name-based exclusion it would inflate both breakdowns by 14000 tokens and
    // push a 'Playground' agent row into the list. Real usage is 1800 tokens.
    expect(agentTokens).toBe(1800);
    expect(modelTokens).toBe(1800);
    expect(
      res.body.agents.some((a: { agent_name: string }) => a.agent_name === 'Playground'),
    ).toBe(false);
    // The orphan also must not surface in recent messages.
    expect(
      res.body.recent_messages.some(
        (m: { agent_name: string }) => m.agent_name === 'Playground',
      ),
    ).toBe(false);
  });

  it('keeps same-provider/auth connections separate by label in connection-detail', async () => {
    // Work key: one message, 222 tokens (111 in + 111 out). Personal key: one
    // message, 444 tokens. They share provider=anthropic, auth_type=api_key, so
    // without the label filter each detail would report the other's usage too.
    const work = await request(app.getHttpServer())
      .get(`/api/v1/provider-analytics/connection-detail?connection_id=${workConnectionId}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    const personal = await request(app.getHttpServer())
      .get(`/api/v1/provider-analytics/connection-detail?connection_id=${personalConnectionId}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    const workTokens = work.body.model_usage.reduce(
      (s: number, m: { tokens: number }) => s + m.tokens,
      0,
    );
    const personalTokens = personal.body.model_usage.reduce(
      (s: number, m: { tokens: number }) => s + m.tokens,
      0,
    );
    expect(work.body.connection.label).toBe('Work');
    expect(personal.body.connection.label).toBe('Personal');
    // Each connection sees only its own usage (222 vs 444), not the merged 666.
    expect(workTokens).toBe(222);
    expect(personalTokens).toBe(444);
    expect(work.body.recent_messages).toHaveLength(1);
    expect(personal.body.recent_messages).toHaveLength(1);
  });

  it('returns an empty shape for a missing connection_id', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/provider-analytics/connection-detail')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body).toEqual({ connection: null, agents: [], recent_messages: [] });
  });

  it('returns an empty shape for a connection that does not belong to the user', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/provider-analytics/connection-detail?connection_id=${uuid()}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body.connection).toBeNull();
  });
});

describe('GET /api/v1/overview/per-* timeseries', () => {
  it('exposes per-agent, per-provider and per-model overview timeseries', async () => {
    const paths = [
      'per-agent-timeseries',
      'per-agent-message-timeseries',
      'per-agent-cost-timeseries',
      'per-provider-timeseries',
      'per-provider-message-timeseries',
      'per-provider-cost-timeseries',
      'per-model-timeseries',
      'per-model-message-timeseries',
      'per-model-cost-timeseries',
    ];
    for (const p of paths) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/overview/${p}?range=24h`)
        .set('x-api-key', TEST_API_KEY)
        .expect(200);
      expect(res.body).toHaveProperty('agents');
      expect(res.body).toHaveProperty('timeseries');
    }
  });

  it('excludes the Playground (is_system) agent from per-provider and per-model timeseries (Finding 2)', async () => {
    // The Playground agent logged 18000 openai/gpt-4o tokens (agent_id set), and
    // an orphan Playground row logged 14000 more (NULL agent_id, name only).
    // Real openai usage is 1800 tokens (gpt-4o 1500 + gpt-4o-mini 300). Before
    // the fix these endpoints either had no is_system filter or used an id-only
    // join that missed the orphan. After the name-based NOT EXISTS exclusion
    // BOTH Playground rows are dropped from every per-* timeseries.
    const sumKey = (rows: Array<Record<string, number>>, key: string): number =>
      rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);

    const provider = await request(app.getHttpServer())
      .get('/api/v1/overview/per-provider-timeseries?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(sumKey(provider.body.timeseries, 'openai')).toBe(1800);

    const model = await request(app.getHttpServer())
      .get('/api/v1/overview/per-model-timeseries?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(sumKey(model.body.timeseries, 'gpt-4o')).toBe(1500);
  });
});

describe('GET /api/v1/rate-limits', () => {
  it('returns an empty providers list when nothing has been captured', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/rate-limits')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body).toHaveProperty('providers');
    expect(Array.isArray(res.body.providers)).toBe(true);
  });
});
