import { Controller, Get, Post, Delete, Param, Res, Req } from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpToolService } from './mcp.tool';
import { McpServerFactory } from './mcp-server.factory';
import { McpTemplateService } from './mcp-template.service';
import { Public } from '../auth';

/**
 * MCP controller for published app endpoints.
 * Handles MCP protocol via SDK transport, UI template serving, and landing pages.
 *
 * All routes are public (no authentication required)
 * because MCP endpoints need to be accessible by external clients.
 */
@Controller('servers')
@Public()
export class McpController {
  constructor(
    private readonly mcpToolService: McpToolService,
    private readonly mcpServerFactory: McpServerFactory,
    private readonly mcpTemplateService: McpTemplateService,
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
    @Res() res: Response,
  ) {
    const html = await this.mcpTemplateService.renderUiTemplate(slug, toolName, layout);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /**
   * GET /servers/:slug/mcp
   * Handle MCP GET requests (SSE streaming support)
   */
  @Get(':slug/mcp')
  async handleMcpGet(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.mcpServerFactory.handleRequest(slug, req, res);
  }

  /**
   * POST /servers/:slug/mcp
   * Handle MCP POST requests via StreamableHTTPServerTransport
   */
  @Post(':slug/mcp')
  async handleMcpRequest(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.mcpServerFactory.handleRequest(slug, req, res);
  }

  /**
   * DELETE /servers/:slug/mcp
   * Handle MCP DELETE requests (session teardown)
   */
  @Delete(':slug/mcp')
  async handleMcpDelete(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.mcpServerFactory.handleRequest(slug, req, res);
  }

  /**
   * GET /servers/:slug
   * Landing page with app info and MCP integration instructions
   */
  @Get(':slug')
  async getLandingPage(@Param('slug') slug: string, @Res() res: Response) {
    const host = res.req?.get('host') || 'localhost:3000';
    const html = await this.mcpTemplateService.renderLandingPage(slug, host);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
