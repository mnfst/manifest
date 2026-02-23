import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('Telemetry ingest-then-query round-trip', () => {
  beforeAll(async () => {
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .set('x-api-key', TEST_API_KEY)
      .send({
        events: [
          {
            timestamp: new Date().toISOString(),
            description: 'Roundtrip test query',
            service_type: 'agent',
            status: 'ok',
            model: 'claude-opus-4-6',
            input_tokens: 1500,
            output_tokens: 800,
          },
        ],
      })
      .expect(202);
  });

  it('overview reflects ingested data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/overview?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body.has_data).toBe(true);
    expect(res.body.summary.tokens_today.value).toBeGreaterThan(0);
    expect(res.body.summary.messages.value).toBeGreaterThan(0);
  });

  it('tokens endpoint reflects ingested data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tokens?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body.summary.total_tokens.value).toBeGreaterThan(0);
  });
});

describe('Clock skew tolerance', () => {
  beforeAll(async () => {
    // Post telemetry with a timestamp 30s in the future
    const futureTs = new Date(Date.now() + 30_000).toISOString();
    await request(app.getHttpServer())
      .post('/api/v1/telemetry')
      .set('x-api-key', TEST_API_KEY)
      .send({
        events: [
          {
            timestamp: futureTs,
            description: 'Clock skew test',
            service_type: 'agent',
            status: 'ok',
            model: 'gpt-4o',
            input_tokens: 500,
            output_tokens: 200,
          },
        ],
      })
      .expect(202);
  });

  it('future-timestamped data is visible in overview', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/overview?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    // Future-timestamped data must not be filtered out (catches timestamp <= :now bug)
    expect(res.body.has_data).toBe(true);
    expect(res.body.summary.messages.value).toBeGreaterThan(0);
  });
});
