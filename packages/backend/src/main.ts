import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
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

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`\n🚀 Backend server running on http://localhost:${port}`);
  console.log(`📡 API available at http://localhost:${port}/api`);
  console.log(`🔧 MCP servers at http://localhost:${port}/servers/{slug}/mcp`);
  console.log(`🌐 Frontend running on http://localhost:5173\n`);
}

bootstrap();
