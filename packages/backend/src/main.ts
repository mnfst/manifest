import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import * as express from 'express';
import { AppModule } from './app.module';
import { auth } from './auth/auth.instance';
import { SpaFallbackFilter } from './common/filters/spa-fallback.filter';
import { httpErrorLogger } from './common/middleware/http-error-logger.middleware';
import {
  applyPrivateNetworkAllow,
  buildDevAllowedOrigins,
  buildFrameSrc,
  createCorsOriginHandler,
} from './cors-csp-config';
import { shouldCompress } from './routing/proxy/compression-filter';

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
  const isDev = process.env['NODE_ENV'] !== 'production';

  // The Wingman drawer is a dev-only affordance — `frame-src` only loosens
  // up when NODE_ENV !== 'production' to allow the hosted Wingman SPA
  // (https://wingman.manifest.build) and locally-running Wingman builds
  // at `WINGMAN_PORT` (defaults to backend port + 1). Docker / cloud
  // builds keep the strict 'self'-only frame policy.
  const backendPort = Number(process.env['PORT']) || 3001;
  const wingmanPort = Number(process.env['WINGMAN_PORT']) || backendPort + 1;
  const frameSrc = buildFrameSrc({ isDev, wingmanPort });

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
          frameSrc,
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

  // Exclude SSE (`text/event-stream`) from compression: gzip buffering holds
  // tokens and wrecks streaming time-to-first-token. All other responses use
  // the package's default content-type filter.
  app.use(compression({ filter: shouldCompress }));

  // CORS is enabled only in dev so the Vite frontend on :3000, the local
  // Wingman build at `WINGMAN_PORT`, and the hosted Wingman SPA can hit
  // the backend cross-origin. Production never enables CORS — the
  // dashboard is same-origin and the Wingman drawer is dead-code-
  // eliminated, so there are no legitimate cross-origin callers.
  //
  // `credentials: false` is deliberate — Wingman uses bearer keys, never
  // cookies, and keeping credentials off the cross-origin path means a
  // misconfigured allow-list can't leak session cookies. We omit
  // `allowedHeaders` on purpose so the cors middleware reflects the
  // request's `Access-Control-Request-Headers`: Wingman replays real SDK
  // fingerprints (e.g. the OpenAI/Stainless `X-Stainless-*` family), and a
  // fixed allow-list silently fails those preflights.
  if (isDev) {
    const configuredOrigin = process.env['CORS_ORIGIN'] || 'http://localhost:3000';
    const allowedOrigins = buildDevAllowedOrigins({
      configuredOrigin,
      wingmanPort,
    });
    // PNA preflight must answer before the cors middleware ends the
    // OPTIONS response. Registering this `app.use` first puts it ahead
    // of the cors handler in the express middleware chain.
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      applyPrivateNetworkAllow(req, allowedOrigins, (name, value) => res.setHeader(name, value));
      next();
    });
    app.enableCors({
      origin: createCorsOriginHandler(allowedOrigins),
      credentials: false,
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
