import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpToolService } from './mcp.tool';
import { McpJsonRpcService } from './mcp-jsonrpc.service';
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
 * Updated to use new unified node architecture:
 * - Flow.nodes JSON column contains Interface, Return, and CallFlow nodes
 * - Flow.connections JSON column contains node connections
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AppEntity, FlowEntity]),
    FlowExecutionModule,
    AuthModule,
    SecretModule,
  ],
  controllers: [McpController],
  providers: [McpToolService, McpJsonRpcService, McpTemplateService, AppService],
  exports: [McpToolService],
})
export class McpModule {}
