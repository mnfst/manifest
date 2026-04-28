import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import * as express from 'express';
import { AppModule } from './app.module';
import { auth } from './auth/auth.instance';
import { SpaFallbackFilter } from './common/filters/spa-fallback.filter';
import { httpErrorLogger } from './common/middleware/http-error-logger.middleware';

export async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: new ConsoleLogger({ prefix: 'Manifest' }),
  });
  app.enableShutdownHooks();
  app.useGlobalFilters(new SpaFallbackFilter(process.env['BETTER_AUTH_URL']));

  const betterAuthUrl = process.env['BETTER_AUTH_URL'] || '';
  const hstsEnabled = /^https:\/\//i.test(betterAuthUrl);

  app.use(
    helmet({
      hsts: hstsEnabled,
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
          // Disable helmet's default `upgrade-insecure-requests`: it breaks
          // HTTP-only LAN deployments (10.x / 192.168.x / 172.16-31.x) where
          // browsers don't treat the origin as trustworthy and rewrite
          // `/assets/*.js` to https://, which the server doesn't serve.
          // HTTPS deployments should enforce upgrades via HSTS at the proxy.
          upgradeInsecureRequests: null,
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
    }),
  );

  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.use(httpErrorLogger);

  // Trust reverse proxy (Railway, Render, Traefik, Nginx, etc.) so Express
  // sees the real client IP from X-Forwarded-For headers. Enabled in
  // production deployments only — dev runs on loopback with no proxy.
  if (!isDev) {
    expressApp.set('trust proxy', 1);
  }

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

  // Mount Better Auth handler (needs raw body, before express.json)
  const { toNodeHandler } = await import('better-auth/node');
  expressApp.all('/api/auth/*splat', toNodeHandler(auth));

  // Re-add body parsing for NestJS routes
  expressApp.use(express.json({ limit: '1mb' }));
  expressApp.use(express.urlencoded({ extended: true, limit: '1mb' }));

  const port = Number(process.env['PORT'] ?? 3001);
  const host = process.env['BIND_ADDRESS'] ?? '127.0.0.1';
  await app.listen(port, host);
  logger.log(`Server running on http://${host}:${port}`);

  if (isDev && host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
    logger.warn(
      `Development mode with BIND_ADDRESS=${host} — auth guards are relaxed for loopback IPs. ` +
        'Ensure this server is not exposed to untrusted networks.',
    );
  }

  return app;
}

// Only auto-start when run directly (not when embedded)
if (!process.env['MANIFEST_EMBEDDED']) {
  bootstrap();
}
