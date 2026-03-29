import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import * as express from 'express';
import { AppModule } from './app.module';
import { auth } from './auth/auth.instance';
import { LOCAL_USER_ID, LOCAL_EMAIL } from './common/constants/local-mode.constants';
import { SpaFallbackFilter } from './common/filters/spa-fallback.filter';
import { isAllowedLocalIp } from './common/utils/local-ip';

export async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: new ConsoleLogger({ prefix: 'Manifest' }),
  });
  app.enableShutdownHooks();
  app.useGlobalFilters(new SpaFallbackFilter());

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
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  app.use(compression());

  const isDev = process.env['NODE_ENV'] !== 'production';
  if (isDev) {
    app.enableCors({
      origin: process.env['CORS_ORIGIN'] || /^https?:\/\/(localhost|127\.0\.0\.1):(3000|3001)$/,
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
      if (!isAllowedLocalIp(ip)) {
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
    // Rate limit login attempts (Better Auth runs outside NestJS, so ThrottlerGuard doesn't apply)
    const { default: rateLimit } = await import('express-rate-limit');
    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many login attempts. Try again later.' },
    });
    expressApp.use('/api/auth/sign-in', loginLimiter);

    // Cloud mode: mount Better Auth handler (needs raw body, before express.json)
    const { toNodeHandler } = await import('better-auth/node');
    expressApp.all('/api/auth/*splat', toNodeHandler(auth!));
  }

  // Re-add body parsing for NestJS routes
  expressApp.use(express.json({ limit: '1mb' }));
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
