import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';

let app: INestApplication;
const AGENT_NAME = 'limits-test-agent';

beforeAll(async () => {
  app = await createTestApp();

  await request(app.getHttpServer())
    .post('/api/v1/agents')
    .set('x-api-key', TEST_API_KEY)
    .send({ name: AGENT_NAME });
});

afterAll(async () => {
  await app.close();
});

describe('Limits API', () => {
  let blockRuleId: string;

  it('POST /api/v1/notifications creates a block rule', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/notifications')
      .set('x-api-key', TEST_API_KEY)
      .send({
        agent_name: AGENT_NAME,
        metric_type: 'tokens',
        threshold: 100,
        period: 'day',
        action: 'block',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.action).toBe('block');
    expect(Number(res.body.threshold)).toBe(100);
    blockRuleId = res.body.id;
  });

  it('GET /api/v1/notifications lists both notify and block rules', async () => {
    // Create a notify rule too
    await request(app.getHttpServer())
      .post('/api/v1/notifications')
      .set('x-api-key', TEST_API_KEY)
      .send({
        agent_name: AGENT_NAME,
        metric_type: 'cost',
        threshold: 10,
        period: 'month',
        action: 'notify',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/notifications?agent_name=${AGENT_NAME}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(2);
    const actions = res.body.map((r: { action: string }) => r.action);
    expect(actions).toContain('block');
    expect(actions).toContain('notify');
  });

  it('PATCH /api/v1/notifications/:id updates action field', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${blockRuleId}`)
      .set('x-api-key', TEST_API_KEY)
      .send({ action: 'notify' })
      .expect(200);

    expect(res.body.action).toBe('notify');

    // Revert to block
    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${blockRuleId}`)
      .set('x-api-key', TEST_API_KEY)
      .send({ action: 'block' })
      .expect(200);
  });

  it('POST /api/v1/notifications defaults action to notify', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/notifications')
      .set('x-api-key', TEST_API_KEY)
      .send({
        agent_name: AGENT_NAME,
        metric_type: 'tokens',
        threshold: 50000,
        period: 'day',
      })
      .expect(201);

    expect(res.body.action).toBe('notify');
  });

  it('GET /api/v1/routing/status returns routing status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/routing/status')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('enabled');
    expect(typeof res.body.enabled).toBe('boolean');
  });
});
