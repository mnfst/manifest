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

describe('GET /api/v1/health', () => {
  it('returns healthy status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('uptime_seconds');
    expect(res.body).toHaveProperty('version', '0.1.0');
    expect(typeof res.body.uptime_seconds).toBe('number');
  });
});
