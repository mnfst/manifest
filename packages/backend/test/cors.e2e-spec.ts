import { Controller, Get, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import {
  HOSTED_WINGMAN_ORIGIN,
  applyPrivateNetworkAllow,
  buildDevAllowedOrigins,
  createCorsOriginHandler,
} from '../src/cors-csp-config';

@Controller()
class CorsTestController {
  @Get('/api/v1/health')
  health() {
    return { status: 'healthy' };
  }

  @Post('/v1/chat/completions')
  chat() {
    return { ok: true };
  }
}

@Module({ controllers: [CorsTestController] })
class CorsTestModule {}

// Boots a minimal NestJS app and calls `enableCors()` with the exact same
// inputs main.ts uses in dev. CORS is only enabled when NODE_ENV !==
// 'production' — production never reaches `enableCors`, so there's
// nothing to test there.
async function buildDevApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [CorsTestModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  const allowedOrigins = buildDevAllowedOrigins({
    configuredOrigin: 'http://localhost:3000',
    wingmanPort: 3002,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    applyPrivateNetworkAllow(req, allowedOrigins, (name, value) => res.setHeader(name, value));
    next();
  });
  app.enableCors({
    origin: createCorsOriginHandler(allowedOrigins),
    credentials: false,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-API-Key'],
  });
  await app.init();
  return app;
}

describe('CORS — development', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildDevApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows the configured Vite frontend origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('allows the local Wingman dev server', async () => {
    const res = await request(app.getHttpServer())
      .options('/v1/chat/completions')
      .set('Origin', 'http://localhost:3002')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3002');
  });

  it('allows preflight from the hosted Wingman origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/v1/chat/completions')
      .set('Origin', HOSTED_WINGMAN_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.headers['access-control-allow-origin']).toBe(HOSTED_WINGMAN_ORIGIN);
    const allowHeaders = (res.headers['access-control-allow-headers'] ?? '').toLowerCase();
    expect(allowHeaders).toContain('authorization');
    expect(allowHeaders).toContain('content-type');
  });

  it('does not echo Access-Control-Allow-Credentials (no cookies cross-origin)', async () => {
    const res = await request(app.getHttpServer())
      .options('/v1/chat/completions')
      .set('Origin', HOSTED_WINGMAN_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('rejects unknown origins (no Allow-Origin header echoed)', async () => {
    const res = await request(app.getHttpServer())
      .options('/v1/chat/completions')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('echoes Access-Control-Allow-Private-Network for PNA preflight from a listed origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', HOSTED_WINGMAN_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Private-Network', 'true');
    expect(res.headers['access-control-allow-private-network']).toBe('true');
  });

  it('does not echo Allow-Private-Network when the request header is missing', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', HOSTED_WINGMAN_ORIGIN)
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-private-network']).toBeUndefined();
  });
});
