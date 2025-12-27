import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ViewService } from './view.service';
import { AgentService } from '../agent/agent.service';
import type {
  View,
  CreateViewRequest,
  UpdateViewRequest,
  ReorderViewsRequest,
  ViewChatRequest,
  ViewChatResponse,
} from '@chatgpt-app-builder/shared';

/**
 * View controller with endpoints for view management
 * - GET /flows/:flowId/views - List views for a flow
 * - POST /flows/:flowId/views - Create view
 * - GET /views/:viewId - Get view by ID
 * - PATCH /views/:viewId - Update view
 * - DELETE /views/:viewId - Delete view
 * - POST /flows/:flowId/views/reorder - Reorder views
 * - POST /views/:viewId/chat - Chat-based view modification
 */
@Controller('api')
export class ViewController {
  constructor(
    private readonly viewService: ViewService,
    @Inject(forwardRef(() => AgentService))
    private readonly agentService: AgentService
  ) {}

  /**
   * GET /api/flows/:flowId/views
   * List all views for a flow
   */
  @Get('flows/:flowId/views')
  async listViews(@Param('flowId') flowId: string): Promise<View[]> {
    return this.viewService.findByFlowId(flowId);
  }

  /**
   * POST /api/flows/:flowId/views
   * Create a new view
   */
  @Post('flows/:flowId/views')
  @HttpCode(HttpStatus.CREATED)
  async createView(
    @Param('flowId') flowId: string,
    @Body() request: CreateViewRequest
  ): Promise<View> {
    return this.viewService.create(flowId, request);
  }

  /**
   * GET /api/views/:viewId
   * Get view by ID
   */
  @Get('views/:viewId')
  async getView(@Param('viewId') viewId: string): Promise<View> {
    const view = await this.viewService.findById(viewId);
    if (!view) {
      throw new NotFoundException(`View with id ${viewId} not found`);
    }
    return view;
  }

  /**
   * PATCH /api/views/:viewId
   * Update view
   */
  @Patch('views/:viewId')
  async updateView(
    @Param('viewId') viewId: string,
    @Body() request: UpdateViewRequest
  ): Promise<View> {
    return this.viewService.update(viewId, request);
  }

  /**
   * DELETE /api/views/:viewId
   * Delete view (protected - cannot delete last view)
   */
  @Delete('views/:viewId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteView(@Param('viewId') viewId: string): Promise<void> {
    await this.viewService.delete(viewId);
  }

  /**
   * POST /api/flows/:flowId/views/reorder
   * Reorder views within a flow
   */
  @Post('flows/:flowId/views/reorder')
  @HttpCode(HttpStatus.OK)
  async reorderViews(
    @Param('flowId') flowId: string,
    @Body() request: ReorderViewsRequest
  ): Promise<View[]> {
    return this.viewService.reorder(flowId, request.viewIds);
  }

  /**
   * POST /api/views/:viewId/chat
   * Chat-based view modification
   */
  @Post('views/:viewId/chat')
  @HttpCode(HttpStatus.OK)
  async chatWithView(
    @Param('viewId') viewId: string,
    @Body() request: ViewChatRequest
  ): Promise<ViewChatResponse> {
    // Validate message
    if (!request.message || request.message.trim().length === 0) {
      throw new BadRequestException('Message is required');
    }

    // Get current view
    const currentView = await this.viewService.findById(viewId);
    if (!currentView) {
      throw new NotFoundException(`View with id ${viewId} not found`);
    }

    // Process chat message with agent
    const result = await this.agentService.processViewChat(request.message, currentView);

    // Apply updates if any
    let updatedView = currentView;
    if (Object.keys(result.updates).length > 0) {
      updatedView = await this.viewService.update(viewId, result.updates);
    }

    return {
      message: result.response,
      view: updatedView,
    };
  }
}
