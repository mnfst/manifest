import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { FlowEntity } from '../flow/flow.entity';
import { AppEntity } from '../app/app.entity';
import { McpModule } from '../mcp/mcp.module';
import { FlowExecutionModule } from '../flow-execution/flow-execution.module';

/**
 * Chat module for LLM preview functionality
 * Provides endpoints for chat streaming and API key validation
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([FlowEntity, AppEntity]),
    McpModule,
    FlowExecutionModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
