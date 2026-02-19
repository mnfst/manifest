import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/v1/telemetry', () => {
  it('accepts valid telemetry batch and returns 202', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .set('x-api-key', 'test-api-key-001')
      .send({
        events: [
          {
            timestamp: '2026-02-16T10:00:00Z',
            description: 'Agent processed user request',
            service_type: 'agent',
            status: 'ok',
            model: 'claude-opus-4-6',
            input_tokens: 1500,
            output_tokens: 800,
          },
        ],
      })
      .expect(202);

    expect(res.body.accepted).toBe(1);
    expect(res.body.rejected).toBe(0);
  });

  it('rejects empty events array with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .set('x-api-key', 'test-api-key-001')
      .send({ events: [] })
      .expect(400);
  });

  it('rejects events missing required fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .set('x-api-key', 'test-api-key-001')
      .send({
        events: [
          {
            description: 'Missing timestamp and status',
            service_type: 'agent',
          },
        ],
      })
      .expect(400);
  });

  it('rejects request without API key with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .send({
        events: [
          {
            timestamp: '2026-02-16T10:00:00Z',
            description: 'Test',
            service_type: 'agent',
            status: 'ok',
          },
        ],
      })
      .expect(401);
  });

  it('accepts batch with multiple events', async () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      timestamp: `2026-02-16T10:0${i}:00Z`,
      description: `Event ${i}`,
      service_type: 'agent' as const,
      status: 'ok' as const,
      input_tokens: 100 * (i + 1),
      output_tokens: 50 * (i + 1),
    }));

    const res = await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .set('x-api-key', 'test-api-key-001')
      .send({ events })
      .expect(202);

    expect(res.body.accepted).toBe(5);
  });

  it('includes security events when present', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .set('x-api-key', 'test-api-key-001')
      .send({
        events: [
          {
            timestamp: '2026-02-16T11:00:00Z',
            description: 'Suspicious prompt detected',
            service_type: 'agent',
            status: 'ok',
            security_event: {
              severity: 'warning',
              category: 'prompt_injection',
              description: 'Potential prompt injection attempt',
            },
          },
        ],
      })
      .expect(202);

    expect(res.body.accepted).toBe(1);
  });
});
