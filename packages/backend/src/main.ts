import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app/app.module';

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const warnings: string[] = [];

  // Check for OpenAI API key (required for agent functionality)
  if (!process.env.OPENAI_API_KEY) {
    warnings.push(
      'OPENAI_API_KEY is not set. Agent functionality will use mock responses.'
    );
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

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for frontend (allow all localhost ports in dev)
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      // Allow any localhost origin in development
      if (origin.match(/^http:\/\/localhost:\d+$/)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Serve uploaded files from /uploads path
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  // In production (Docker), serve frontend static files
  // The frontend dist is expected at /app/frontend when running in Docker
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
      // For all other routes, serve index.html (SPA routing)
      const indexPath = join(frontendPath, 'index.html');
      if (existsSync(indexPath) && !req.path.includes('.')) {
        return res.sendFile(indexPath);
      }
      next();
    });
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`\n🚀 Backend server running on http://localhost:${port}`);
  console.log(`📡 API available at http://localhost:${port}/api`);
  console.log(`🔧 MCP servers at http://localhost:${port}/servers/{slug}/mcp\n`);
}

bootstrap();
