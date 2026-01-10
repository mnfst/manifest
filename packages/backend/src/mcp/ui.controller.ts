import { Controller, Get, Post, Body, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { McpToolService } from './mcp.tool';
import { FlowEntity } from '../flow/flow.entity';
import { AppService } from '../app/app.service';
import { Public } from '../auth';
import * as fs from 'fs';
import * as path from 'path';
import type { ThemeVariables, ExecuteActionRequest } from '@chatgpt-app-builder/shared';

/**
 * Controller for serving UI components for ChatGPT Apps SDK
 * Each flow in an app has its UI accessible at /servers/{appSlug}/ui/{toolName}/{layout}.html
 *
 * All routes in this controller are public (no authentication required)
 * because MCP endpoints need to be accessible by external clients.
 */
@Controller('servers')
@Public()
export class UiController {
  constructor(
    private readonly mcpToolService: McpToolService,
    private readonly appService: AppService,
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>
  ) {}

  /**
   * GET /servers/:slug/ui/:toolName/:layout.html
   * Serve the UI component for a specific flow with theme variables injected
   */
  @Get(':slug/ui/:toolName/:layout.html')
  async serveUi(
    @Param('slug') slug: string,
    @Param('toolName') toolName: string,
    @Param('layout') layout: string,
    @Res() res: Response
  ) {
    // Get the app
    const app = await this.mcpToolService.getAppBySlug(slug);
    if (!app) {
      throw new NotFoundException(`No published app found for slug: ${slug}`);
    }

    // Get the flow
    const flow = await this.flowRepository.findOne({
      where: { appId: app.id, toolName },
      relations: ['views'],
    });
    if (!flow) {
      throw new NotFoundException(`No tool found with name: ${toolName}`);
    }

    // Get the first view
    const views = flow.views?.sort((a, b) => a.order - b.order) || [];
    const primaryView = views[0];
    if (!primaryView) {
      throw new NotFoundException(`No views found for tool: ${toolName}`);
    }

    // Validate layout matches
    const layoutTemplate = layout.replace('.html', '');
    if (layoutTemplate !== primaryView.layoutTemplate) {
      throw new NotFoundException(`Layout mismatch: expected ${primaryView.layoutTemplate}, got ${layoutTemplate}`);
    }

    // Read template file
    const templatePath = path.join(__dirname, 'templates', `${layoutTemplate}.html`);
    let template: string;

    try {
      template = fs.readFileSync(templatePath, 'utf-8');
    } catch {
      throw new NotFoundException(`Template not found: ${layoutTemplate}`);
    }

    // Convert theme variables to CSS
    const cssVariables = this.themeToCss(app.themeVariables);

    // Inject variables into template
    const html = template
      .replace('{{appName}}', app.name)
      .replace('{{flowName}}', flow.name)
      .replace('{{themeVariables}}', cssVariables);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /**
   * GET /servers/:slug/mcp
   * Simple MCP endpoint info (POC - not full MCP protocol)
   */
  @Get(':slug/mcp')
  async getMcpInfo(@Param('slug') slug: string) {
    const app = await this.mcpToolService.getAppBySlug(slug);
    if (!app) {
      throw new NotFoundException(`No published app found for slug: ${slug}`);
    }

    const tools = await this.mcpToolService.listTools(slug);

    return {
      name: 'chatgpt-app-builder',
      version: '1.0.0',
      description: `MCP server for ${app.name}`,
      tools,
    };
  }

  /**
   * POST /servers/:slug/mcp
   * MCP JSON-RPC 2.0 endpoint for tool operations
   */
  @Post(':slug/mcp')
  async handleMcpRequest(
    @Param('slug') slug: string,
    @Body() body: { jsonrpc: string; id: number | string; method: string; params?: Record<string, unknown> },
    @Res() res: Response
  ) {
    const app = await this.mcpToolService.getAppBySlug(slug);
    if (!app) {
      return res.status(404).json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32600, message: `No published app found for slug: ${slug}` },
      });
    }

    const { id, method, params } = body;

    try {
      let result: unknown;

      switch (method) {
        case 'initialize':
          result = {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
            },
            serverInfo: {
              name: app.name,
              version: '1.0.0',
            },
          };
          break;

        case 'notifications/initialized':
          // Client acknowledgement, no response needed
          return res.status(204).send();

        case 'tools/list': {
          const tools = await this.mcpToolService.listTools(slug);
          result = { tools };
          break;
        }

        case 'tools/call': {
          const toolParams = params as { name: string; arguments?: Record<string, unknown> };
          if (!toolParams?.name) {
            return res.json({
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'Missing tool name' },
            });
          }
          const toolResult = await this.mcpToolService.executeTool(
            slug,
            toolParams.name,
            toolParams.arguments ?? {}
          );
          result = toolResult;
          break;
        }

        case 'resources/list': {
          const resourcesList = await this.mcpToolService.listResources(slug);
          result = { resources: resourcesList };
          break;
        }

        case 'resources/read': {
          const resourceParams = params as { uri: string };
          if (!resourceParams?.uri) {
            return res.json({
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'Missing resource URI' },
            });
          }
          const resourceContent = await this.mcpToolService.readResource(slug, resourceParams.uri);
          result = { contents: [resourceContent] };
          break;
        }

        default:
          return res.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
          });
      }

      return res.json({
        jsonrpc: '2.0',
        id,
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: errorMessage },
      });
    }
  }

  /**
   * GET /servers/:slug
   * Landing page with app info and ChatGPT integration instructions
   */
  @Get(':slug')
  async getLandingPage(@Param('slug') slug: string, @Res() res: Response) {
    // Get the app by slug
    const app = await this.appService.findBySlug(slug);
    if (!app) {
      throw new NotFoundException(`No app found for slug: ${slug}`);
    }

    // Return generic 404 for draft apps (T021)
    // Note: Use same message as "not found" to avoid leaking existence of unpublished apps
    if (app.status !== 'published') {
      throw new NotFoundException(`No app found for slug: ${slug}`);
    }

    // Get active tools for this app (T020)
    const tools = await this.mcpToolService.listTools(slug);

    // Generate tools list HTML
    let toolsListHtml: string;
    if (tools.length === 0) {
      toolsListHtml = '<div class="empty-state">No tools available yet</div>';
    } else {
      toolsListHtml = `<ul class="tools-list">
        ${tools
          .map(
            (tool) => `<li class="tool-item">
            <div class="tool-name">${tool.name}</div>
            <div class="tool-description">${tool.description || 'No description'}</div>
          </li>`
          )
          .join('\n        ')}
      </ul>`;
    }

    // Read landing page template
    const templatePath = path.join(__dirname, 'templates', 'landing.html');
    let template: string;

    try {
      template = fs.readFileSync(templatePath, 'utf-8');
    } catch {
      throw new NotFoundException('Landing page template not found');
    }

    // Build the MCP URL
    const protocol = 'https'; // Assume HTTPS in production
    const host = res.req?.get('host') || 'localhost:3000';
    const mcpUrl = `${protocol}://${host}/servers/${slug}/mcp`;

    // Inject variables into template (T019)
    const html = template
      .replace(/\{\{appName\}\}/g, app.name)
      .replace(/\{\{appDescription\}\}/g, app.description || 'A ChatGPT App Builder MCP Server')
      .replace(/\{\{mcpUrl\}\}/g, mcpUrl)
      .replace(/\{\{toolsList\}\}/g, toolsListHtml);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /**
   * POST /servers/:slug/actions
   * Execute a UI node action callback (e.g., when user clicks "Read More" on a post)
   */
  @Post(':slug/actions')
  async executeAction(
    @Param('slug') slug: string,
    @Body() request: ExecuteActionRequest
  ) {
    const app = await this.mcpToolService.getAppBySlug(slug);
    if (!app) {
      throw new NotFoundException(`No published app found for slug: ${slug}`);
    }

    return this.mcpToolService.executeAction(slug, request);
  }

  /**
   * Convert ThemeVariables to CSS string
   */
  private themeToCss(themeVariables: ThemeVariables): string {
    return Object.entries(themeVariables)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value};`)
      .join('\n      ');
  }
}
