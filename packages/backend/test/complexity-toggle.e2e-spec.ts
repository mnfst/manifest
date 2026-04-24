import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
}, 30000);

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);

describe('Complexity toggle endpoints', () => {
  it('GET /complexity reads back the stored flag', async () => {
    const res = await auth(api().get('/api/v1/routing/test-agent/complexity')).expect(200);
    expect(typeof res.body.enabled).toBe('boolean');
  });

  it('POST /complexity/toggle flips the flag both ways and persists', async () => {
    const off = await auth(api().post('/api/v1/routing/test-agent/complexity/toggle'))
      .send({ enabled: false })
      .expect(201);
    expect(off.body).toEqual({ ok: true, enabled: false });

    const readbackOff = await auth(api().get('/api/v1/routing/test-agent/complexity')).expect(
      200,
    );
    expect(readbackOff.body).toEqual({ enabled: false });

    const on = await auth(api().post('/api/v1/routing/test-agent/complexity/toggle'))
      .send({ enabled: true })
      .expect(201);
    expect(on.body).toEqual({ ok: true, enabled: true });

    const readbackOn = await auth(api().get('/api/v1/routing/test-agent/complexity')).expect(200);
    expect(readbackOn.body).toEqual({ enabled: true });
  });

  it('POST /complexity/toggle rejects a non-boolean body', async () => {
    await auth(api().post('/api/v1/routing/test-agent/complexity/toggle'))
      .send({ enabled: 'yes' })
      .expect(400);
  });
});

describe('Default tier CRUD via /tiers/:tier', () => {
  it('GET /tiers includes a default slot', async () => {
    const res = await auth(api().get('/api/v1/routing/test-agent/tiers')).expect(200);
    const slots = (res.body as Array<{ tier: string }>).map((t) => t.tier);
    expect(slots).toEqual(expect.arrayContaining(['simple', 'standard', 'complex', 'reasoning', 'default']));
  });

  it('PUT /tiers/bogus rejects unknown slots', async () => {
    await auth(api().put('/api/v1/routing/test-agent/tiers/bogus'))
      .send({ model: 'whatever' })
      .expect(400);
  });
});
