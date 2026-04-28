import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import type { Server } from 'http';

// Mirrors the helmet config in src/main.ts. If the two drift, this test
// stops guarding the real deployment — keep them in sync.
function buildApp() {
  const app = express();
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: process.env['FRAME_ANCESTORS']
            ? process.env['FRAME_ANCESTORS']
                .split(',')
                .map((v) => v.trim())
                .filter((v) => v !== '*')
            : ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.get('/', (_req, res) => res.status(200).send('ok'));
  return app;
}

describe('CSP header', () => {
  let server: Server;

  beforeAll(() => {
    server = buildApp().listen(0);
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('does NOT include upgrade-insecure-requests (breaks LAN deployments over HTTP)', async () => {
    const res = await request(server).get('/').expect(200);
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('still emits the self-only CSP directives', async () => {
    const res = await request(server).get('/').expect(200);
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
