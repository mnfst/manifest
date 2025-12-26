import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlowEntity } from './flow.entity';
import { FlowService } from './flow.service';
import { FlowController } from './flow.controller';
import { ViewModule } from '../view/view.module';
import { AgentModule } from '../agent/agent.module';

/**
 * Flow module for managing MCP tools
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([FlowEntity]),
    forwardRef(() => ViewModule),
    forwardRef(() => AgentModule),
  ],
  controllers: [FlowController],
  providers: [FlowService],
  exports: [FlowService],
})
export class FlowModule {}
