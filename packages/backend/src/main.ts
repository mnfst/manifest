import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { toNodeHandler } from 'better-auth/node';
import * as express from 'express';
import { AppModule } from './app.module';
import { auth } from './auth/auth.instance';

export async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableShutdownHooks();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
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
  if (!isDev) {
    expressApp.set('trust proxy', 1);
  }

  // Mount Better Auth handler (needs raw body, before express.json)
  expressApp.all('/api/auth/*splat', toNodeHandler(auth));

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

// Only auto-start when run directly (not imported by manifest-server)
if (!process.env['MANIFEST_EMBEDDED']) {
  bootstrap();
}
