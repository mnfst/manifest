import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';

const STATE = 'e2e-state-abcdef1234567890';

describe('CLI browser login (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  async function authorize(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/cli/authorize')
      .set('x-api-key', TEST_API_KEY)
      .send({ state: STATE })
      .expect(201);
    expect(typeof res.body.code).toBe('string');
    return res.body.code as string;
  }

  async function countCliKeys(): Promise<number> {
    const rows: Array<{ n: string }> = await ds.query(
      `SELECT count(*)::text AS n FROM api_keys WHERE name = 'cli'`,
    );
    return Number(rows[0].n);
  }

  it('authorize → exchange mints a working expiring cli PAT', async () => {
    const code = await authorize();
    const res = await request(app.getHttpServer())
      .post('/api/v1/cli/token')
      .send({ code, state: STATE })
      .expect(200);
    expect(res.body.token).toMatch(/^mnfst_pat_/);
    expect(typeof res.body.expiresAt).toBe('string');

    const rows = await ds.query(
      `SELECT name, expires_at, key FROM api_keys WHERE name = 'cli' ORDER BY created_at DESC LIMIT 1`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBeNull();
    expect(rows[0].expires_at).not.toBeNull();
  });

  it('a code is single-use', async () => {
    const code = await authorize();
    await request(app.getHttpServer())
      .post('/api/v1/cli/token')
      .send({ code, state: STATE })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/cli/token')
      .send({ code, state: STATE })
      .expect(400);
  });

  it('a wrong state is rejected and does not consume the code', async () => {
    const code = await authorize();
    await request(app.getHttpServer())
      .post('/api/v1/cli/token')
      .send({ code, state: 'wrong-state-1234567890' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/cli/token')
      .send({ code, state: STATE })
      .expect(200);
  });

  it('an expired code is rejected', async () => {
    const code = await authorize();
    await ds.query(`UPDATE cli_auth_codes SET expires_at = now() - interval '1 minute'`);
    await request(app.getHttpServer())
      .post('/api/v1/cli/token')
      .send({ code, state: STATE })
      .expect(400);
  });

  it('API-key auth cannot mint a code', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cli/authorize')
      .set('x-api-key', TEST_API_KEY)
      .set('x-test-auth-method', 'api_key')
      .send({ state: STATE })
      .expect(403);
  });

  it('malformed state/code are rejected by validation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cli/authorize')
      .set('x-api-key', TEST_API_KEY)
      .send({ state: 'no spaces allowed!' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/cli/token')
      .send({ code: 'short', state: STATE })
      .expect(400);
  });

  it('DELETE /cli/token revokes the minted PAT', async () => {
    const code = await authorize();
    const res = await request(app.getHttpServer())
      .post('/api/v1/cli/token')
      .send({ code, state: STATE })
      .expect(200);
    const token = res.body.token as string;
    const before = await countCliKeys();

    const del = await request(app.getHttpServer())
      .delete('/api/v1/cli/token')
      .set('x-api-key', token)
      .expect(200);
    expect(del.body).toEqual({ revoked: true });

    // Exactly the PAT we just revoked disappeared — earlier tests' PATs stay.
    expect(await countCliKeys()).toBe(before - 1);
  });
});
