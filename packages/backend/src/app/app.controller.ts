import {
  Controller,
  Get,
  Post,
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
  GenerateAppRequest,
  ChatRequest,
  ChatResponse,
  PublishResult,
} from '@chatgpt-app-builder/shared';

/**
 * App controller with 4 core endpoints for POC
 * - POST /generate - Create app from prompt
 * - GET /current - Get current session app
 * - POST /chat - Customize via chat
 * - POST /publish - Publish to MCP server
 */
@Controller('api')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly agentService: AgentService
  ) {}

  /**
   * POST /api/generate
   * Generate a new app from a natural language prompt
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

    // Generate app configuration using agent
    const result = await this.agentService.generateApp(request.prompt);

    // Create and persist the app
    const app = await this.appService.create({
      name: result.name,
      description: result.description,
      layoutTemplate: result.layoutTemplate,
      systemPrompt: request.prompt,
      themeVariables: result.themeVariables,
      mockData: result.mockData,
      toolName: result.toolName,
      toolDescription: result.toolDescription,
      status: 'draft',
    });

    return app;
  }

  /**
   * GET /api/current
   * Get the current session app
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

    // Process chat message with agent
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
