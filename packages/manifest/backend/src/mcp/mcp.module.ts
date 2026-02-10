import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpToolService } from './mcp.tool';
import { McpServerFactory } from './mcp-server.factory';
import { McpTemplateService } from './mcp-template.service';
import { McpController } from './mcp.controller';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { AppService } from '../app/app.service';
import { FlowExecutionModule } from '../flow-execution/flow-execution.module';
import { AuthModule } from '../auth/auth.module';
import { SecretModule } from '../secret/secret.module';

/**
 * MCP module for Model Context Protocol server functionality
 * Exposes published apps as MCP tools that can be invoked by AI assistants
 * Each flow in an app becomes an MCP tool
 *
 * Uses @modelcontextprotocol/sdk for protocol handling and
 * @modelcontextprotocol/ext-apps for UI widget support
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AppEntity, FlowEntity]),
    FlowExecutionModule,
    AuthModule,
    SecretModule,
  ],
  controllers: [McpController],
  providers: [McpToolService, McpServerFactory, McpTemplateService, AppService],
  exports: [McpToolService],
})
export class McpModule {}
