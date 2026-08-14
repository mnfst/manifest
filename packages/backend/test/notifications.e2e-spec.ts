import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';

let app: INestApplication;
const AGENT_NAME = 'notif-test-agent';

beforeAll(async () => {
  app = await createTestApp();

  // Create agent via API so tenant.name = user.id (production behavior)
  await request(app.getHttpServer())
    .post('/api/v1/agents')
    .set('x-api-key', TEST_API_KEY)
    .send({ name: AGENT_NAME });
});

afterAll(async () => {
  await app.close();
});

describe('Notifications API', () => {
  let ruleId: string;

  it('POST /api/v1/notifications creates a rule', async () => {
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

    expect(res.body).toHaveProperty('id');
    expect(res.body.metric_type).toBe('tokens');
    expect(Number(res.body.threshold)).toBe(50000);
    expect(res.body.period).toBe('day');
    ruleId = res.body.id;
  });

  it('GET /api/v1/notifications lists rules', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/notifications?agent_name=${AGENT_NAME}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('metric_type');
  });

  it('PATCH /api/v1/notifications/:id updates a rule', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${ruleId}`)
      .set('x-api-key', TEST_API_KEY)
      .send({ threshold: 100000, is_active: false })
      .expect(200);

    expect(Number(res.body.threshold)).toBe(100000);
  });

  it('DELETE /api/v1/notifications/:id deletes a rule', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/notifications/${ruleId}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/notifications?agent_name=${AGENT_NAME}`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    const found = res.body.find((r: { id: string }) => r.id === ruleId);
    expect(found).toBeUndefined();
  });

  it('rejects request without auth with 401', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/notifications?agent_name=${AGENT_NAME}`)
      .expect(401);
  });
});
