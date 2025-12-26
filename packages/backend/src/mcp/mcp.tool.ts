import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppEntity } from '../entities/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { ViewEntity } from '../view/view.entity';
import type { McpToolResponse, LayoutTemplate } from '@chatgpt-app-builder/shared';

/**
 * Service for handling MCP tool calls for published apps
 * Implements ChatGPT Apps SDK response format
 * Each flow in an app becomes an MCP tool
 */
@Injectable()
export class McpToolService {
  constructor(
    @InjectRepository(AppEntity)
    private readonly appRepository: Repository<AppEntity>,
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>,
    @InjectRepository(ViewEntity)
    private readonly viewRepository: Repository<ViewEntity>
  ) {}

  /**
   * Get app by slug (used for MCP server discovery)
   */
  async getAppBySlug(slug: string): Promise<AppEntity | null> {
    return this.appRepository.findOne({
      where: { slug, status: 'published' },
      relations: ['flows'],
    });
  }

  /**
   * Execute an MCP tool call for a published app's flow
   * Returns ChatGPT Apps SDK formatted response
   */
  async executeTool(
    appSlug: string,
    toolName: string,
    input: { message: string }
  ): Promise<McpToolResponse> {
    const app = await this.getAppBySlug(appSlug);
    if (!app) {
      throw new NotFoundException(`No published app found for slug: ${appSlug}`);
    }

    // Find the flow that matches the tool name
    const flow = await this.flowRepository.findOne({
      where: { appId: app.id, toolName },
      relations: ['views'],
    });

    if (!flow) {
      throw new NotFoundException(`No tool found with name: ${toolName}`);
    }

    // Get the first view for layout and mock data
    const views = flow.views?.sort((a, b) => a.order - b.order) || [];
    const primaryView = views[0];

    if (!primaryView) {
      throw new NotFoundException(`No views found for tool: ${toolName}`);
    }

    // Generate response text based on the request
    const responseText = this.generateResponseText(
      flow.name,
      primaryView.layoutTemplate,
      input.message
    );

    // Return ChatGPT Apps SDK formatted response
    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
      structuredContent: primaryView.mockData,
      _meta: {
        'openai/outputTemplate': `ui://widget/${app.slug}/${flow.toolName}.html`,
      },
    };
  }

  /**
   * List all tools available for an MCP server (one per flow)
   */
  async listTools(appSlug: string): Promise<{
    name: string;
    description: string;
    inputSchema: object;
  }[]> {
    const app = await this.getAppBySlug(appSlug);
    if (!app) {
      return [];
    }

    const flows = await this.flowRepository.find({
      where: { appId: app.id },
    });

    return flows.map((flow) => ({
      name: flow.toolName,
      description: flow.toolDescription || `Execute the ${flow.name} flow`,
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
    }));
  }

  /**
   * Generate response text based on flow context
   */
  private generateResponseText(
    flowName: string,
    layoutTemplate: LayoutTemplate,
    _message: string
  ): string {
    if (layoutTemplate === 'table') {
      return `Here are the results from ${flowName}:`;
    } else {
      return `Here's the content from ${flowName}:`;
    }
  }
}
