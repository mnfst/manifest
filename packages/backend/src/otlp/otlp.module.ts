import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { Agent } from '../entities/agent.entity';
import { Tenant } from '../entities/tenant.entity';
import { UserProvider } from '../entities/user-provider.entity';
import { ApiKeyGeneratorService } from './services/api-key.service';
import { AgentKeyAuthGuard } from './guards/agent-key-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([AgentApiKey, Agent, Tenant, UserProvider])],
  providers: [ApiKeyGeneratorService, AgentKeyAuthGuard],
  exports: [ApiKeyGeneratorService, AgentKeyAuthGuard, TypeOrmModule],
})
export class OtlpModule {}
