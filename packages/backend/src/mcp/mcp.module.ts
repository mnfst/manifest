import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpToolService } from './mcp.tool';
import { UiController } from './ui.controller';
import { AppEntity } from '../entities/app.entity';

/**
 * MCP module for Model Context Protocol server functionality
 * Exposes published apps as MCP tools that can be invoked by AI assistants
 *
 * POC Note: Using simplified HTTP endpoints instead of full MCP-Nest integration
 * In production, would use @rekog/mcp-nest for full MCP protocol support
 */
@Module({
  imports: [TypeOrmModule.forFeature([AppEntity])],
  controllers: [UiController],
  providers: [McpToolService],
  exports: [McpToolService],
})
export class McpModule {}
