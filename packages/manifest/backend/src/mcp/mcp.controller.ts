import { Controller, Get, Post, Body, Param, Res, Req, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpToolService } from './mcp.tool';
import { McpJsonRpcService, type JsonRpcRequest } from './mcp-jsonrpc.service';
import { McpTemplateService } from './mcp-template.service';
import { Public } from '../auth';
import { generateUserFingerprint } from './mcp.utils';
import type { ExecuteActionRequest } from '@manifest/shared';

/**
 * MCP controller for published app endpoints.
 * Handles JSON-RPC protocol, UI template serving, landing pages, and action execution.
 *
 * All routes are public (no authentication required)
 * because MCP endpoints need to be accessible by external clients.
 */
@Controller('servers')
@Public()
export class McpController {
  constructor(
    private readonly mcpToolService: McpToolService,
    private readonly mcpJsonRpcService: McpJsonRpcService,
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
      name: 'manifest-flows',
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
    @Body() body: JsonRpcRequest,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.mcpJsonRpcService.handleRequest(slug, body, req);

    if (result.type === 'no-content') {
      return res.status(204).send();
    }

    const status = result.status ?? 200;
    return res.status(status).json(result.data);
  }

  /**
   * GET /servers/:slug
   * Landing page with app info and ChatGPT integration instructions
   */
  @Get(':slug')
  async getLandingPage(@Param('slug') slug: string, @Res() res: Response) {
    const host = res.req?.get('host') || 'localhost:3000';
    const html = await this.mcpTemplateService.renderLandingPage(slug, host);
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
    @Body() request: ExecuteActionRequest,
    @Req() req: Request,
  ) {
    const app = await this.mcpToolService.getAppBySlug(slug);
    if (!app) {
      throw new NotFoundException(`No published app found for slug: ${slug}`);
    }

    const userFingerprint = generateUserFingerprint(req);
    return this.mcpToolService.executeAction(slug, request, userFingerprint);
  }
}
