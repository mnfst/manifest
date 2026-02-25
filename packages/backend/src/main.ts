import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';
import { auth } from './auth/auth.instance';
import { LOCAL_USER_ID, LOCAL_EMAIL } from './common/constants/local-mode.constants';
import { SpaFallbackFilter } from './common/filters/spa-fallback.filter';

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableShutdownHooks();
  app.useGlobalFilters(new SpaFallbackFilter());

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https://eu.i.posthog.com"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }));

  const isDev = process.env['NODE_ENV'] !== 'production';
  if (isDev) {
    app.enableCors({
      origin: process.env['CORS_ORIGIN'] || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
      credentials: true,
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const expressApp = app.getHttpAdapter().getInstance();

  // Trust reverse proxy (Railway, Render, etc.) so Express sees the real protocol/IP
  // Disabled in local mode — loopback-only, no reverse proxy
  if (!isDev && process.env['MANIFEST_MODE'] !== 'local') {
    expressApp.set('trust proxy', 1);
  }

  // Mount auth handlers
  if (process.env['MANIFEST_MODE'] === 'local') {
    // Local mode: simple session endpoints (no Better Auth needed)
    const localSessionHandler = (req: express.Request, res: express.Response) => {
      const ip = req.ip ?? '';
      if (!LOOPBACK_IPS.has(ip)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      res.json(buildLocalSessionResponse());
    };
    expressApp.get('/api/auth/get-session', localSessionHandler);
    expressApp.get('/api/auth/local-session', localSessionHandler);
    expressApp.all('/api/auth/*splat', (_req: express.Request, res: express.Response) => {
      res.status(404).json({ error: 'Not available in local mode' });
    });
  } else {
    // Cloud mode: mount Better Auth handler (needs raw body, before express.json)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { toNodeHandler } = require('better-auth/node');
    expressApp.all('/api/auth/*splat', toNodeHandler(auth!));
  }

  // Re-add body parsing for NestJS routes, with rawBody capture for OTLP protobuf
  expressApp.use(express.json({
    limit: '1mb',
    verify: (req: express.Request & { rawBody?: Buffer }, _res: express.Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  }));
  expressApp.use(express.raw({
    type: 'application/x-protobuf',
    limit: '5mb',
    verify: (req: express.Request & { rawBody?: Buffer }, _res: express.Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  }));
  expressApp.use(express.urlencoded({ extended: true, limit: '1mb' }));

  const port = Number(process.env['PORT'] ?? 3001);
  const host = process.env['BIND_ADDRESS'] ?? '127.0.0.1';
  await app.listen(port, host);
  logger.log(`Server running on http://${host}:${port}`);
  return app;
}

function buildLocalSessionResponse() {
  const now = new Date().toISOString();
  const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  return {
    session: {
      id: 'local-session',
      userId: LOCAL_USER_ID,
      token: 'local-token',
      expiresAt: farFuture,
      createdAt: now,
      updatedAt: now,
    },
    user: {
      id: LOCAL_USER_ID,
      name: 'Local User',
      email: LOCAL_EMAIL,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    },
  };
}

// Only auto-start when run directly (not when embedded)
if (!process.env['MANIFEST_EMBEDDED']) {
  bootstrap();
}
