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

describe('GET /api/v1/public-stats', () => {
  it('returns total messages and enriched top models without auth', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public-stats')
      .expect(200);

    expect(res.body).toHaveProperty('total_messages');
    expect(res.body.total_messages).toBeGreaterThanOrEqual(3);
    expect(res.body).toHaveProperty('top_models');
    expect(res.body).toHaveProperty('cached_at');

    const topModels = res.body.top_models;
    expect(topModels.length).toBeGreaterThan(0);
    expect(topModels[0]).toHaveProperty('model');
    expect(topModels[0]).toHaveProperty('provider');
    expect(topModels[0]).toHaveProperty('tokens_7d');
    expect(topModels[0]).toHaveProperty('usage_rank');
    expect(typeof topModels[0].tokens_7d).toBe('number');
  });
});

describe('GET /api/v1/public-stats/models', () => {
  it('returns free model catalog without auth', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public-stats/models')
      .expect(200);

    expect(res.body).toHaveProperty('models');
    expect(Array.isArray(res.body.models)).toBe(true);
    expect(res.body).toHaveProperty('total_models');
    expect(res.body).toHaveProperty('cached_at');
  });

  it('includes expected fields in each free model', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public-stats/models')
      .expect(200);

    if (res.body.models.length > 0) {
      const model = res.body.models[0];
      expect(model).toHaveProperty('model_name');
      expect(model).toHaveProperty('provider');
      expect(model).toHaveProperty('tokens_7d');
    }
  });
});
