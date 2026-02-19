import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  // Seed security events via telemetry
  await request(app.getHttpServer())
    .post('/api/v1/telemetry')
    .set('x-api-key', TEST_API_KEY)
    .send({
      events: [
        {
          timestamp: new Date().toISOString(),
          description: 'Agent turn with security issue',
          service_type: 'agent',
          status: 'ok',
          security_event: {
            severity: 'critical',
            category: 'prompt_injection',
            description: 'Detected prompt injection attempt',
          },
        },
        {
          timestamp: new Date().toISOString(),
          description: 'Normal agent turn',
          service_type: 'agent',
          status: 'ok',
          security_event: {
            severity: 'info',
            category: 'audit',
            description: 'API key rotated',
          },
        },
      ],
    });
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
