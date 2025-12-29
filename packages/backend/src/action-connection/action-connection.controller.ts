import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ActionConnectionService } from './action-connection.service';
import type {
  ActionConnection,
  CreateActionConnectionRequest,
  UpdateActionConnectionRequest,
} from '@chatgpt-app-builder/shared';

/**
 * ActionConnection controller with endpoints for action connection management
 * - GET /views/:viewId/action-connections - List action connections for a view
 * - POST /views/:viewId/action-connections - Create action connection
 * - GET /views/:viewId/action-connections/:actionName - Get action connection by action name
 * - PUT /views/:viewId/action-connections/:actionName - Update action connection
 * - DELETE /views/:viewId/action-connections/:actionName - Delete action connection
 * - GET /flows/:flowId/action-connections - List all action connections for a flow
 */
@Controller('api')
export class ActionConnectionController {
  constructor(private readonly actionConnectionService: ActionConnectionService) {}

  /**
   * GET /api/views/:viewId/action-connections
   * List all action connections for a view
   */
  @Get('views/:viewId/action-connections')
  async listActionConnectionsByView(@Param('viewId') viewId: string): Promise<ActionConnection[]> {
    return this.actionConnectionService.findByViewId(viewId);
  }

  /**
   * POST /api/views/:viewId/action-connections
   * Create a new action connection
   */
  @Post('views/:viewId/action-connections')
  @HttpCode(HttpStatus.CREATED)
  async createActionConnection(
    @Param('viewId') viewId: string,
    @Body() request: CreateActionConnectionRequest
  ): Promise<ActionConnection> {
    return this.actionConnectionService.create(viewId, request);
  }

  /**
   * GET /api/views/:viewId/action-connections/:actionName
   * Get action connection by action name
   */
  @Get('views/:viewId/action-connections/:actionName')
  async getActionConnection(
    @Param('viewId') viewId: string,
    @Param('actionName') actionName: string
  ): Promise<ActionConnection> {
    const connection = await this.actionConnectionService.findByViewAndAction(viewId, actionName);
    if (!connection) {
      throw new NotFoundException(`Action connection for action "${actionName}" not found`);
    }
    return connection;
  }

  /**
   * PUT /api/views/:viewId/action-connections/:actionName
   * Update action connection
   */
  @Put('views/:viewId/action-connections/:actionName')
  async updateActionConnection(
    @Param('viewId') viewId: string,
    @Param('actionName') actionName: string,
    @Body() request: UpdateActionConnectionRequest
  ): Promise<ActionConnection> {
    return this.actionConnectionService.update(viewId, actionName, request);
  }

  /**
   * DELETE /api/views/:viewId/action-connections/:actionName
   * Delete action connection
   */
  @Delete('views/:viewId/action-connections/:actionName')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteActionConnection(
    @Param('viewId') viewId: string,
    @Param('actionName') actionName: string
  ): Promise<void> {
    await this.actionConnectionService.delete(viewId, actionName);
  }

  /**
   * GET /api/flows/:flowId/action-connections
   * List all action connections for a flow (across all views)
   */
  @Get('flows/:flowId/action-connections')
  async listActionConnectionsByFlow(@Param('flowId') flowId: string): Promise<ActionConnection[]> {
    return this.actionConnectionService.findByFlowId(flowId);
  }
}
