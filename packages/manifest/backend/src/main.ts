import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import helmet from 'helmet';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app/app.module';
import { auth, runAuthMigrations } from './auth/auth';

/**
 * Validate required environment variables
 * Throws an error for critical missing vars in production
 */
function validateEnvironment() {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // SECURITY: Auth secret is required in production
  if (!process.env.BETTER_AUTH_SECRET) {
    if (isProduction) {
      errors.push(
        'BETTER_AUTH_SECRET is required in production. Generate with: openssl rand -base64 32'
      );
    } else {
      warnings.push(
        'BETTER_AUTH_SECRET is not set. Using insecure default for development.'
      );
    }
  }

  // Check for OpenAI API key (required for agent functionality)
  if (!process.env.OPENAI_API_KEY) {
    warnings.push(
      'OPENAI_API_KEY is not set. Agent functionality will use mock responses.'
    );
  }

  // Fail fast on critical errors in production
  if (errors.length > 0) {
    console.error('\n❌ Environment Configuration Errors:');
    errors.forEach((e) => console.error(`   - ${e}`));
    console.error('');
    process.exit(1);
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment Warnings:');
    warnings.forEach((w) => console.warn(`   - ${w}`));
    console.warn('');
  }
}

async function bootstrap() {
  // Validate environment on startup
  validateEnvironment();

  // Run Better Auth database migrations (creates user, session, account, verification tables)
  console.log('🔄 Running Better Auth database migrations...');
  await runAuthMigrations();
  console.log('✅ Better Auth migrations complete');

  // Configure log levels based on environment
  // In production: only log warnings and errors to reduce noise and prevent info leakage
  // In development: log everything for debugging
  const logLevels: ('log' | 'error' | 'warn' | 'debug' | 'verbose')[] =
    process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['log', 'error', 'warn', 'debug', 'verbose'];

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // Required for better-auth to handle raw body
    logger: logLevels,
  });
  console.log(`📋 Log level: ${process.env.NODE_ENV === 'production' ? 'warn+error only' : 'all'}`);

  // Enable CORS with strict origin validation
  // SECURITY: Explicit allowlist instead of permissive wildcards
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin, mobile apps, curl)
      if (!origin) return callback(null, true);

      // Allow localhost on any port in development
      // Also allow in production when no explicit ALLOWED_ORIGINS is set
      // (self-hosted Docker with port mapping, e.g. -p 3847:3001)
      if (origin.match(/^http:\/\/localhost:\d+$/)) {
        if (process.env.NODE_ENV !== 'production' || allowedOrigins.length === 0) {
          return callback(null, true);
        }
      }

      // Check against explicit allowlist (from ALLOWED_ORIGINS env var)
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Production: allow same-origin requests and common deployment patterns
      if (process.env.NODE_ENV === 'production') {
        // Allow Railway domains
        if (origin.match(/^https:\/\/[\w-]+\.up\.railway\.app$/) ||
            origin.match(/^https:\/\/[\w-]+\.railway\.app$/)) {
          return callback(null, true);
        }

        // Allow if origin matches BETTER_AUTH_URL (custom domain configured)
        const authUrl = process.env.BETTER_AUTH_URL;
        if (authUrl && origin === authUrl.replace(/\/$/, '')) {
          return callback(null, true);
        }

        // Allow HTTPS origins when no explicit allowlist (for custom domains)
        // This is safe because cookies have SameSite=Lax protection
        if (allowedOrigins.length === 0 && origin.startsWith('https://')) {
          return callback(null, true);
        }
      }

      // Reject all other origins
      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Security headers via helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://unpkg.com'], // React + CDN libs
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // Inline styles + Google Fonts
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'], // Google Fonts
          connectSrc: ["'self'", 'https:', 'wss:'],
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false, // Required for loading external resources
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin resource loading
    })
  );
  console.log('🛡️  Security headers enabled via helmet');

  // Register better-auth handler manually (Express 4 compatible)
  // The @thallesp/nestjs-better-auth module uses /*path pattern which requires Express 5
  const expressApp = app.getHttpAdapter().getInstance();
  const authHandler = toNodeHandler(auth);
  expressApp.all('/api/auth/*', (req, res) => authHandler(req, res));
  console.log('🔐 Better Auth handler registered on /api/auth/*');

  // Enable body parsing for non-auth routes (auth routes handle their own parsing)
  // Use NestJS's built-in body parser methods
  // Increase limit for large payloads (e.g., registry components with embedded file content)
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '10mb' });

  // Global validation pipe for input validation on all DTOs
  // SECURITY: Validates and sanitizes incoming request data
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error for unknown properties
      transform: true,           // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert primitive types
      },
    })
  );
  console.log('✅ Global validation pipe enabled');

  // Serve uploaded files from /uploads path
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  // In production (Docker), serve frontend static files
  // The frontend dist is expected at /app/packages/frontend/dist when running in Docker (via FRONTEND_DIST_PATH)
  const frontendPath = process.env.FRONTEND_DIST_PATH || join(__dirname, '..', '..', '..', 'frontend', 'dist');
  if (existsSync(frontendPath)) {
    console.log(`📦 Serving frontend static files from ${frontendPath}`);
    app.useStaticAssets(frontendPath);
    // Serve index.html for SPA routing (all non-API routes)
    app.use((req, res, next) => {
      // Skip API routes, uploads, and MCP server routes
      if (req.path.startsWith('/api') ||
          req.path.startsWith('/uploads') ||
          req.path.startsWith('/servers')) {
        return next();
      }
      // If the requested path maps to an existing static file, let the static assets middleware handle it
      const relativePath = req.path.replace(/^\/+/, '');
      const requestedFilePath = join(frontendPath, relativePath);
      if (existsSync(requestedFilePath)) {
        return next();
      }
      // Otherwise, fall back to index.html for SPA routes
      const indexPath = join(frontendPath, 'index.html');
      if (existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      next();
    });
  }

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`\n🚀 Backend server running on http://0.0.0.0:${port}`);
  console.log(`📡 API available at http://localhost:${port}/api`);
  console.log(`🔧 MCP servers at http://localhost:${port}/servers/{slug}/mcp`);
  console.log(`🌐 Frontend running on http://localhost:5173\n`);
}

bootstrap();
