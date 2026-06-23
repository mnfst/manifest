import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../entities/agent.entity';
import { AgentHealingEnabled } from '../entities/agent-healing-enabled.entity';
import { AgentHealingController } from './agent-healing.controller';
import { HealingService } from './healing.service';

/**
 * Request healing: the per-agent activation API + the advisory client the proxy
 * uses on a request-side 4xx. Exports HealingService for ProxyModule to inject.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AgentHealingEnabled, Agent])],
  controllers: [AgentHealingController],
  providers: [HealingService],
  exports: [HealingService],
})
export class HealingModule {}
