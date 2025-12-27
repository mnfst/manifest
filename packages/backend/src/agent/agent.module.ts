import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';

/**
 * Agent module for LangChain-powered app generation and customization
 * Well-separated from other backend modules
 */
@Module({
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
