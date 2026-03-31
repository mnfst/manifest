import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers';
import { detectDialect, portableSql } from '../src/common/utils/sql-dialect';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  const ds = app.get(DataSource);
  const dialect = detectDialect(ds.options.type as string);
  const sql = (query: string) => portableSql(query, dialect);
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

  await ds.query(
    sql(
      `INSERT INTO agent_messages (id, tenant_id, agent_id, agent_name, user_id, timestamp, input_tokens, output_tokens, model, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    ),
    ['ps-msg-1', 'test-tenant-001', 'test-agent-001', 'test-agent', 'test-user-001', now, 100, 50, 'gpt-4o', 'ok'],
  );
  await ds.query(
    sql(
      `INSERT INTO agent_messages (id, tenant_id, agent_id, agent_name, user_id, timestamp, input_tokens, output_tokens, model, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    ),
    ['ps-msg-2', 'test-tenant-001', 'test-agent-001', 'test-agent', 'test-user-001', now, 200, 100, 'gpt-4o', 'ok'],
  );
  await ds.query(
    sql(
      `INSERT INTO agent_messages (id, tenant_id, agent_id, agent_name, user_id, timestamp, input_tokens, output_tokens, model, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    ),
    ['ps-msg-3', 'test-tenant-001', 'test-agent-001', 'test-agent', 'test-user-001', now, 150, 75, 'claude-opus-4-6', 'ok'],
  );
});

afterAll(async () => {
  await app.close();
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
