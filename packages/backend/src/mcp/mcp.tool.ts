import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppEntity } from '../entities/app.entity';
import type { McpToolResponse, App } from '@chatgpt-app-builder/shared';

/**
 * Service for handling MCP tool calls for published apps
 * Implements ChatGPT Apps SDK response format
 */
@Injectable()
export class McpToolService {
  constructor(
    @InjectRepository(AppEntity)
    private readonly appRepository: Repository<AppEntity>
  ) {}

  /**
   * Get app by MCP slug
   */
  async getAppBySlug(mcpSlug: string): Promise<App | null> {
    const entity = await this.appRepository.findOne({
      where: { mcpSlug, status: 'published' },
    });
    return entity ? this.entityToApp(entity) : null;
  }

  /**
   * Execute an MCP tool call for a published app
   * Returns ChatGPT Apps SDK formatted response
   */
  async executeTool(mcpSlug: string, input: { message: string }): Promise<McpToolResponse> {
    const app = await this.getAppBySlug(mcpSlug);
    if (!app) {
      throw new NotFoundException(`No published app found for slug: ${mcpSlug}`);
    }

    // Generate response text based on the request
    const responseText = this.generateResponseText(app, input.message);

    // Return ChatGPT Apps SDK formatted response
    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
      structuredContent: app.mockData,
      _meta: {
        'openai/outputTemplate': `ui://widget/${app.mcpSlug}.html`,
      },
    };
  }

  /**
   * List all tools available for an MCP server
   */
  async listTools(mcpSlug: string): Promise<{
    name: string;
    description: string;
    inputSchema: object;
  }[]> {
    const app = await this.getAppBySlug(mcpSlug);
    if (!app) {
      return [];
    }

    return [
      {
        name: app.toolName || 'execute',
        description: app.toolDescription || `Execute the ${app.name} app`,
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'User query or request',
            },
          },
          required: ['message'],
        },
      },
    ];
  }

  /**
   * Generate response text based on app context
   */
  private generateResponseText(app: App, _message: string): string {
    if (app.layoutTemplate === 'table') {
      return `Here are the results from ${app.name}:`;
    } else {
      return `Here's the content from ${app.name}:`;
    }
  }

  /**
   * Convert entity to App interface
   */
  private entityToApp(entity: AppEntity): App {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      layoutTemplate: entity.layoutTemplate,
      systemPrompt: entity.systemPrompt,
      themeVariables: entity.themeVariables,
      mockData: entity.mockData,
      toolName: entity.toolName,
      toolDescription: entity.toolDescription,
      mcpSlug: entity.mcpSlug,
      status: entity.status,
    };
  }
}
