import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { McpToolService } from './mcp.tool';
import { FlowEntity } from '../flow/flow.entity';
import * as fs from 'fs';
import * as path from 'path';
import type { ThemeVariables } from '@chatgpt-app-builder/shared';

/**
 * Controller for serving UI components for ChatGPT Apps SDK
 * Each flow in an app has its UI accessible at /servers/{appSlug}/ui/{toolName}/{layout}.html
 */
@Controller('servers')
export class UiController {
  constructor(
    private readonly mcpToolService: McpToolService,
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
   * Convert ThemeVariables to CSS string
   */
  private themeToCss(themeVariables: ThemeVariables): string {
    return Object.entries(themeVariables)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value};`)
      .join('\n      ');
  }
}
