import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  // Seed security events via direct DB inserts
  const ds = app.get(DataSource);
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

  await ds.query(
    `INSERT INTO security_event (id, timestamp, severity, category, description, user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuid(), now, 'critical', 'prompt_injection', 'Detected prompt injection attempt', 'test-user-001'],
  );

  await ds.query(
    `INSERT INTO security_event (id, timestamp, severity, category, description, user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuid(), now, 'info', 'audit', 'API key rotated', 'test-user-001'],
  );
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/v1/security', () => {
  it('returns security overview with score', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/security?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('score');
    expect(res.body.score).toHaveProperty('value');
    expect(res.body.score).toHaveProperty('risk_level');
    expect(typeof res.body.score.value).toBe('number');
  });

  it('returns critical events count', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/security?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('critical_events_count');
    expect(res.body.critical_events_count).toBeGreaterThanOrEqual(1);
  });

  it('returns security events feed', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/security?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('events');
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events.length).toBeGreaterThan(0);

    const evt = res.body.events[0];
    expect(evt).toHaveProperty('id');
    expect(evt).toHaveProperty('timestamp');
    expect(evt).toHaveProperty('severity');
    expect(evt).toHaveProperty('category');
    expect(evt).toHaveProperty('description');
  });

  it('returns sandbox mode', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/security?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('sandbox_mode');
  });
});
