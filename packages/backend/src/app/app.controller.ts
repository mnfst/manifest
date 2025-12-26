import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AppService } from './app.service';
import { AgentService } from '../agent/agent.service';
import type {
  App,
  CreateAppRequest,
  UpdateAppRequest,
  GenerateAppRequest,
  ChatRequest,
  ChatResponse,
  PublishResult,
} from '@chatgpt-app-builder/shared';

/**
 * App controller with endpoints for app management
 * - GET /apps - List all apps
 * - POST /apps - Create app
 * - GET /apps/:appId - Get app by ID
 * - PATCH /apps/:appId - Update app
 * - POST /apps/:appId/publish - Publish app
 *
 * Legacy endpoints (deprecated):
 * - POST /generate - Create app from prompt
 * - GET /current - Get current session app
 * - POST /chat - Customize via chat
 * - POST /publish - Publish current app
 */
@Controller('api')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly agentService: AgentService
  ) {}

  /**
   * GET /api/apps
   * List all apps
   */
  @Get('apps')
  async listApps(): Promise<App[]> {
    return this.appService.findAll();
  }

  /**
   * POST /api/apps
   * Create a new app
   */
  @Post('apps')
  @HttpCode(HttpStatus.CREATED)
  async createApp(@Body() request: CreateAppRequest): Promise<App> {
    // Validate name
    if (!request.name || request.name.trim().length === 0) {
      throw new BadRequestException('Name is required');
    }

    if (request.name.length > 100) {
      throw new BadRequestException('Name must be 100 characters or less');
    }

    return this.appService.create(request);
  }

  /**
   * GET /api/apps/:appId
   * Get app by ID
   */
  @Get('apps/:appId')
  async getApp(@Param('appId') appId: string): Promise<App> {
    const app = await this.appService.findById(appId);
    if (!app) {
      throw new NotFoundException(`App with id ${appId} not found`);
    }
    return app;
  }

  /**
   * PATCH /api/apps/:appId
   * Update app
   */
  @Patch('apps/:appId')
  async updateApp(
    @Param('appId') appId: string,
    @Body() request: UpdateAppRequest
  ): Promise<App> {
    return this.appService.update(appId, request);
  }

  /**
   * POST /api/apps/:appId/publish
   * Publish app to MCP server
   */
  @Post('apps/:appId/publish')
  @HttpCode(HttpStatus.OK)
  async publishAppById(@Param('appId') appId: string): Promise<PublishResult> {
    return this.appService.publish(appId);
  }

  // ============================================
  // LEGACY ENDPOINTS (deprecated, for backwards compatibility)
  // ============================================

  /**
   * POST /api/generate
   * Generate a new app from a natural language prompt
   * @deprecated Use POST /api/apps + POST /api/apps/:appId/flows for flow generation
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateApp(@Body() request: GenerateAppRequest): Promise<App> {
    // Validate prompt
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new BadRequestException('Prompt is required');
    }

    if (request.prompt.length > 10000) {
      throw new BadRequestException('Prompt exceeds maximum length of 10,000 characters');
    }

    // Generate app configuration using agent (legacy behavior)
    const result = await this.agentService.generateApp(request.prompt);

    // Create app with basic info (flow generation will be separate)
    const app = await this.appService.create({
      name: result.name,
      description: result.description,
      themeVariables: result.themeVariables,
    });

    return app;
  }

  /**
   * GET /api/current
   * Get the current session app
   * @deprecated Use GET /api/apps/:appId
   */
  @Get('current')
  async getCurrentApp(): Promise<App> {
    const app = await this.appService.getCurrentApp();
    if (!app) {
      throw new NotFoundException('No app in current session');
    }
    return app;
  }

  /**
   * POST /api/chat
   * Send a message to customize the current app
   * @deprecated Use POST /api/views/:viewId/chat for view-scoped chat
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() request: ChatRequest): Promise<ChatResponse> {
    // Validate message
    if (!request.message || request.message.trim().length === 0) {
      throw new BadRequestException('Message is required');
    }

    // Get current app
    const currentApp = await this.appService.getCurrentApp();
    if (!currentApp) {
      throw new NotFoundException('No app in current session');
    }

    // Process chat message with agent (legacy behavior)
    const result = await this.agentService.processChat(request.message, currentApp);

    // Apply updates if any
    let updatedApp = currentApp;
    if (Object.keys(result.updates).length > 0) {
      updatedApp = await this.appService.update(currentApp.id, result.updates);
    }

    return {
      response: result.response,
      app: updatedApp,
      changes: result.changes,
    };
  }

  /**
   * POST /api/publish
   * Publish the current app to MCP server
   * @deprecated Use POST /api/apps/:appId/publish
   */
  @Post('publish')
  @HttpCode(HttpStatus.OK)
  async publishApp(): Promise<PublishResult> {
    // Get current app
    const currentApp = await this.appService.getCurrentApp();
    if (!currentApp) {
      throw new NotFoundException('No app in current session');
    }

    // Publish the app
    return this.appService.publish(currentApp.id);
  }
}
