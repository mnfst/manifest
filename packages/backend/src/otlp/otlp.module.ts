import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';
import { TenantProvider } from '../entities/tenant-provider.entity';
import { ApiKeyGeneratorService } from './services/api-key.service';
import { AgentKeyAuthGuard } from './guards/agent-key-auth.guard';
import { OtlpDeprecatedController } from './otlp-deprecated.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AgentApiKey, Agent, Tenant, TenantProvider])],
  controllers: [OtlpDeprecatedController],
  providers: [ApiKeyGeneratorService, AgentKeyAuthGuard],
  exports: [ApiKeyGeneratorService, AgentKeyAuthGuard, TypeOrmModule],
})
export class OtlpModule {}
