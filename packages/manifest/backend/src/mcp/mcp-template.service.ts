import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { McpToolService } from './mcp.tool';
import { AppService } from '../app/app.service';
import { FlowEntity } from '../flow/flow.entity';
import { themeToCss, escapeHtml } from './mcp.utils';

@Injectable()
export class McpTemplateService {
  constructor(
    private readonly mcpToolService: McpToolService,
    private readonly appService: AppService,
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>,
  ) {}

  async renderUiTemplate(slug: string, toolName: string, layout: string): Promise<string> {
    const app = await this.mcpToolService.getAppBySlug(slug);
    if (!app) {
      throw new NotFoundException(`No published app found for slug: ${slug}`);
    }

    const flow = await this.flowRepository.findOne({
      where: { appId: app.id, toolName },
      relations: ['views'],
    });
    if (!flow) {
      throw new NotFoundException(`No tool found with name: ${toolName}`);
    }

    const views = flow.views?.sort((a, b) => a.order - b.order) || [];
    const primaryView = views[0];
    if (!primaryView) {
      throw new NotFoundException(`No views found for tool: ${toolName}`);
    }

    const layoutTemplate = layout.replace('.html', '');
    if (layoutTemplate !== primaryView.layoutTemplate) {
      throw new NotFoundException(`Layout mismatch: expected ${primaryView.layoutTemplate}, got ${layoutTemplate}`);
    }

    const template = this.readTemplate(layoutTemplate);
    const cssVariables = themeToCss(app.themeVariables);

    return template
      .replace('{{appName}}', app.name)
      .replace('{{flowName}}', flow.name)
      .replace('{{themeVariables}}', cssVariables);
  }

  async renderLandingPage(slug: string, host: string): Promise<string> {
    const app = await this.appService.findBySlug(slug);
    if (!app) {
      throw new NotFoundException(`No app found for slug: ${slug}`);
    }

    if (app.status !== 'published') {
      throw new NotFoundException(`No app found for slug: ${slug}`);
    }

    const tools = await this.mcpToolService.listTools(slug);
    const toolsListHtml = this.buildToolsListHtml(tools);

    const template = this.readTemplate('landing');

    const protocol = 'https';
    const mcpUrl = `${protocol}://${host}/servers/${slug}/mcp`;
    const cssVariables = themeToCss(app.themeVariables);

    return template
      .replace(/\{\{appName\}\}/g, app.name)
      .replace(/\{\{appDescription\}\}/g, app.description || 'A ChatGPT App Builder MCP Server')
      .replace(/\{\{mcpUrl\}\}/g, escapeHtml(mcpUrl))
      .replace(/\{\{toolsList\}\}/g, toolsListHtml)
      .replace(/\{\{themeVariables\}\}/g, cssVariables);
  }

  private readTemplate(name: string): string {
    const templatePath = path.join(__dirname, 'templates', `${name}.html`);
    try {
      return fs.readFileSync(templatePath, 'utf-8');
    } catch {
      throw new NotFoundException(`Template not found: ${name}`);
    }
  }

  private buildToolsListHtml(tools: { name: string; description?: string }[]): string {
    if (tools.length === 0) {
      return '<div class="empty-state">No tools available yet</div>';
    }

    return `<ul class="tools-list">
        ${tools
          .map(
            (tool) => `<li class="tool-item">
            <div class="tool-name">${tool.name}</div>
            <div class="tool-description">${tool.description || 'No description'}</div>
          </li>`,
          )
          .join('\n        ')}
      </ul>`;
  }
}
