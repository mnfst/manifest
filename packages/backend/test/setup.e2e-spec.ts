import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  // Better Auth migrations don't run in these E2E tests, so the "user"
  // table doesn't exist by default. Create a minimal stub so SetupService
  // queries resolve. The happy path (real Better Auth signUpEmail) is
  // covered by the unit tests in setup.service.spec.ts.
  const ds = app.get(DataSource);
  await ds.query(
    `CREATE TABLE IF NOT EXISTS "user" (
       id VARCHAR PRIMARY KEY,
       email VARCHAR,
       "emailVerified" BOOLEAN
     )`,
  );
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // Reset the user table between tests so needsSetup swings back to true.
  const ds = app.get(DataSource);
  await ds.query(`DELETE FROM "user"`);
});

describe('First-run setup wizard', () => {
  describe('GET /api/v1/setup/status', () => {
    it('returns needsSetup=true when user table is empty', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/setup/status').expect(200);
      expect(res.body).toMatchObject({ needsSetup: true });
      expect(res.body).toHaveProperty('socialProviders');
      expect(res.body).toHaveProperty('isLocalMode');
      expect(res.body).toHaveProperty('ollamaAvailable');
    });

    it('returns needsSetup=false after a user has been inserted', async () => {
      const ds = app.get(DataSource);
      await ds.query(
        `INSERT INTO "user" (id, email, "emailVerified") VALUES ($1, $2, true)`,
        ['test-user-id', 'founder@example.com'],
      );

      const res = await request(app.getHttpServer()).get('/api/v1/setup/status').expect(200);
      expect(res.body).toMatchObject({ needsSetup: false });
    });

    it('is a public endpoint (no auth required)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/setup/status');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/setup/admin', () => {
    it('rejects with 409 when a user already exists', async () => {
      const ds = app.get(DataSource);
      await ds.query(
        `INSERT INTO "user" (id, email, "emailVerified") VALUES ($1, $2, true)`,
        ['existing-admin', 'admin@example.com'],
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/setup/admin')
        .send({
          email: 'founder@example.com',
          name: 'Founder',
          password: 'secret-password',
        });

      expect(res.status).toBe(409);
    });

    it('rejects when email is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/setup/admin')
        .send({ name: 'Founder', password: 'secret-password' })
        .expect(400);
      expect(res.body.message).toBeDefined();
    });

    it('rejects when password is too short', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/setup/admin')
        .send({ email: 'founder@example.com', name: 'Founder', password: 'short' })
        .expect(400);
      expect(res.body.message).toBeDefined();
    });

    it('rejects when email is not a valid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/setup/admin')
        .send({ email: 'not-an-email', name: 'Founder', password: 'secret-password' })
        .expect(400);
      expect(res.body.message).toBeDefined();
    });

    it('rejects when name is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/setup/admin')
        .send({ email: 'founder@example.com', password: 'secret-password' })
        .expect(400);
      expect(res.body.message).toBeDefined();
    });
  });
});
