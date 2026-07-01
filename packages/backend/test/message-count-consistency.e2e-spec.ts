import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import request from 'supertest';
import { createTestApp, TEST_API_KEY, TEST_TENANT_ID, TEST_AGENT_ID } from './helpers';

// Regression guard for F1: the "messages" KPI must mean the same thing on every
// surface. Overview's summary card and the agent grid's message_count once used
// different definitions (unfiltered COUNT(*) vs. one that excluded errors), so
// the headline total diverged from the per-agent sums by the whole error rate.
// All KPI counts now funnel through query-helpers.sqlCountMessages(), which
// excludes ['error','fallback_error','rate_limited']. The Messages *log* total
// stays unfiltered because it is a complete event listing.

const OK_COUNT = 5;
const ERROR_STATUSES = ['error', 'fallback_error', 'rate_limited'] as const;

let app: INestApplication;

async function insertMessage(ds: DataSource, status: string) {
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
  await ds.query(
    `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, description, service_type, agent_name, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      uuid(),
      TEST_TENANT_ID,
      TEST_AGENT_ID,
      now,
      status,
      'gpt-4o',
      100,
      50,
      0,
      0,
      'consistency probe',
      'agent',
      'test-agent',
      'test-user-001',
    ],
  );
}

beforeAll(async () => {
  app = await createTestApp();
  const ds = app.get(DataSource);
  // 5 real messages…
  for (let i = 0; i < OK_COUNT; i++) await insertMessage(ds, 'ok');
  // …plus one of every error status, which must NOT inflate the KPI counts.
  for (const status of ERROR_STATUSES) await insertMessage(ds, status);
});

afterAll(async () => {
  await app.close();
});

describe('message-count consistency (F1)', () => {
  it('Overview summary card counts only non-error messages', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/overview?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body.summary.messages.value).toBe(OK_COUNT);
  });

  it('Agent grid message_count equals the Overview card', async () => {
    const [overview, agents] = await Promise.all([
      request(app.getHttpServer())
        .get('/api/v1/overview?range=24h')
        .set('x-api-key', TEST_API_KEY)
        .expect(200),
      request(app.getHttpServer())
        .get('/api/v1/agents?range=24h')
        .set('x-api-key', TEST_API_KEY)
        .expect(200),
    ]);
    const agent = agents.body.agents.find(
      (a: { agent_name: string }) => a.agent_name === 'test-agent',
    );
    expect(agent.message_count).toBe(OK_COUNT);
    expect(agent.message_count).toBe(overview.body.summary.messages.value);
  });

  it('Messages log total still includes error rows (complete event listing)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&agent_name=test-agent&include_total=true&limit=50')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    expect(res.body.total_count).toBe(OK_COUNT + ERROR_STATUSES.length);
  });
});
