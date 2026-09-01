import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  const ds = app.get(DataSource);
  await ds.query(`DELETE FROM waitlist_claims`);
});

describe('POST /api/v1/waitlist/pivot/claim', () => {
  it('stores a claim with a normalized email and pivot source', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/waitlist/pivot/claim')
      .send({ email: '  Jane@Example.COM ' })
      .expect(200)
      .expect({ ok: true });

    const ds = app.get(DataSource);
    const rows = await ds.query(`SELECT email, source FROM waitlist_claims`);
    expect(rows).toEqual([{ email: 'jane@example.com', source: 'pivot' }]);
  });

  it('dedupes by email on a second claim', async () => {
    const server = app.getHttpServer();
    await request(server).post('/api/v1/waitlist/pivot/claim').send({ email: 'a@b.co' });
    await request(server).post('/api/v1/waitlist/pivot/claim').send({ email: 'A@b.co' });

    const ds = app.get(DataSource);
    const rows = await ds.query(`SELECT email FROM waitlist_claims`);
    expect(rows).toHaveLength(1);
  });

  it('rejects an invalid email with 400 and stores nothing', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/waitlist/pivot/claim')
      .send({ email: 'not-an-email' })
      .expect(400);

    const ds = app.get(DataSource);
    const rows = await ds.query(`SELECT email FROM waitlist_claims`);
    expect(rows).toHaveLength(0);
  });

  it('rejects unknown fields with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/waitlist/pivot/claim')
      .send({ email: 'a@b.co', newsletter: true })
      .expect(400);
  });

  it('keeps the legacy autofix claim as a storing-nothing no-op', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/waitlist/autofix/claim')
      .send({ email: 'a@b.co' })
      .expect(200)
      .expect({ ok: true });

    const ds = app.get(DataSource);
    const rows = await ds.query(`SELECT email FROM waitlist_claims`);
    expect(rows).toHaveLength(0);
  });
});
