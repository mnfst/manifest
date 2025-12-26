import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpToolService } from './mcp.tool';
import { UiController } from './ui.controller';
import { AppEntity } from '../entities/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { ViewEntity } from '../view/view.entity';

/**
 * MCP module for Model Context Protocol server functionality
 * Exposes published apps as MCP tools that can be invoked by AI assistants
 * Each flow in an app becomes an MCP tool
 *
 * POC Note: Using simplified HTTP endpoints instead of full MCP-Nest integration
 * In production, would use @rekog/mcp-nest for full MCP protocol support
 */
@Module({
  imports: [TypeOrmModule.forFeature([AppEntity, FlowEntity, ViewEntity])],
  controllers: [UiController],
  providers: [McpToolService],
  exports: [McpToolService],
})
export class McpModule {}
