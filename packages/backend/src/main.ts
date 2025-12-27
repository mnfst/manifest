import { NestFactory } from '@nestjs/core';
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

  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`\n🚀 Backend server running on http://localhost:${port}`);
  console.log(`📡 API available at http://localhost:${port}/api`);
  console.log(`🔧 MCP servers at http://localhost:${port}/servers/{slug}/mcp\n`);
}

bootstrap();
