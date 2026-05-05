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
    // Default to a single origin (the Vite dev server). Operators that need
    // a different origin must set CORS_ORIGIN explicitly. Previously the
    // fallback regex allowed http+https on both 3000 and 3001 with
    // credentials, letting any locally-bound process on those ports read
    // session cookies cross-origin.
    app.enableCors({
      origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
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
  //
  // Restrict the trust to loopback / link-local / private subnets so a
  // remote attacker cannot forge an X-Forwarded-For value to make Express
  // think the request originated from a trusted IP. Operators with proxies
  // outside these ranges should set TRUST_PROXY explicitly.
  if (!isDev) {
    // Env values are always strings, but Express's `trust proxy` treats
    // numbers (hop count) and booleans differently from their string
    // equivalents — `"1"` is parsed as a CIDR / IP literal, not "trust
    // first hop". Coerce numeric and bool-shaped values explicitly.
    const rawTrustProxy = process.env['TRUST_PROXY'] ?? 'loopback, linklocal, uniquelocal';
    const trustProxy: string | number | boolean = /^\d+$/.test(rawTrustProxy)
      ? Number(rawTrustProxy)
      : rawTrustProxy === 'true'
        ? true
        : rawTrustProxy === 'false'
          ? false
          : rawTrustProxy;
    expressApp.set('trust proxy', trustProxy);
  }

  // Rate limit auth endpoints (Better Auth runs outside NestJS, so
  // ThrottlerGuard doesn't apply). Each endpoint gets its own limiter so
  // sign-in attempts don't share a budget with sign-up / password-reset.
  const { default: rateLimit } = await import('express-rate-limit');
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again later.' },
  });
  const signupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many sign-up attempts. Try again later.' },
  });
  // forget-password is the worst offender: each request sends an email and
  // can be used for account enumeration via timing differences. Tight cap.
  const forgetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many password reset requests. Try again later.' },
  });
  const verifyEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many verification requests. Try again later.' },
  });
  expressApp.use('/api/auth/sign-in', loginLimiter);
  expressApp.use('/api/auth/sign-up', signupLimiter);
  expressApp.use('/api/auth/forget-password', forgetPasswordLimiter);
  expressApp.use('/api/auth/forgot-password', forgetPasswordLimiter);
  expressApp.use('/api/auth/reset-password', forgetPasswordLimiter);
  expressApp.use('/api/auth/verify-email', verifyEmailLimiter);
  expressApp.use('/api/auth/send-verification-email', verifyEmailLimiter);

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

  // Warn loudly when HSTS is silently disabled in production. Operators
  // running behind an HTTPS reverse proxy without setting BETTER_AUTH_URL
  // (or with an http:// value) will otherwise lose HSTS protection
  // without realizing it.
  if (
    !isDev &&
    !hstsEnabled &&
    host !== '127.0.0.1' &&
    host !== 'localhost' &&
    host !== '::1' &&
    process.env['MANIFEST_DISABLE_HSTS'] !== '1'
  ) {
    logger.warn(
      'HSTS is disabled. Set BETTER_AUTH_URL to your https:// origin to enable it, or set ' +
        'MANIFEST_DISABLE_HSTS=1 to silence this warning for HTTP-only LAN deployments.',
    );
  }

  return app;
}

// Only auto-start when run directly (not when embedded)
if (!process.env['MANIFEST_EMBEDDED']) {
  bootstrap();
}
