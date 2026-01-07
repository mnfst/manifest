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
} from '@nestjs/common';
import { FlowService } from './flow.service';
import type {
  Flow,
  CreateFlowRequest,
  UpdateFlowRequest,
  GenerateFlowResponse,
  FlowDeletionCheck,
  DeleteFlowResponse,
} from '@chatgpt-app-builder/shared';

/**
 * Flow controller with endpoints for flow management
 * - GET /flows - List all flows with parent app data
 * - GET /apps/:appId/flows - List flows for an app
 * - POST /apps/:appId/flows - Create flow (AI-assisted)
 * - GET /flows/:flowId - Get flow by ID
 * - PATCH /flows/:flowId - Update flow
 * - GET /flows/:flowId/deletion-check - Check flow deletion consequences
 * - DELETE /flows/:flowId - Delete flow
 */
@Controller('api')
export class FlowController {
  constructor(
    private readonly flowService: FlowService
  ) {}

  /**
   * GET /api/apps/:appId/flows
   * List all flows for an app
   */
  @Get('apps/:appId/flows')
  async listFlows(@Param('appId') appId: string): Promise<Flow[]> {
    return this.flowService.findByAppId(appId);
  }

  /**
   * POST /api/apps/:appId/flows
   * Create a new flow with name and description.
   * Tool properties are now set on individual UserIntent trigger nodes.
   */
  @Post('apps/:appId/flows')
  @HttpCode(HttpStatus.CREATED)
  async createFlow(
    @Param('appId') appId: string,
    @Body() request: CreateFlowRequest
  ): Promise<GenerateFlowResponse> {
    // Validate name
    if (!request.name || request.name.trim().length === 0) {
      throw new BadRequestException('Name is required');
    }

    if (request.name.length > 300) {
      throw new BadRequestException('Name exceeds maximum length of 300 characters');
    }

    // Validate description length if provided
    if (request.description && request.description.length > 500) {
      throw new BadRequestException('Description exceeds maximum length of 500 characters');
    }

    // Create the flow with minimal data (empty nodes and connections)
    const flow = await this.flowService.create(appId, {
      name: request.name.trim(),
      description: request.description?.trim(),
    });

    // Fetch flow
    const createdFlow = await this.flowService.findById(flow.id);
    if (!createdFlow) {
      throw new NotFoundException('Flow not found after creation');
    }

    return {
      flow: createdFlow,
      redirectTo: `/app/${appId}/flow/${flow.id}`,
    };
  }

  /**
   * GET /api/flows/:flowId
   * Get flow by ID
   */
  @Get('flows/:flowId')
  async getFlow(@Param('flowId') flowId: string): Promise<Flow> {
    const flow = await this.flowService.findById(flowId);
    if (!flow) {
      throw new NotFoundException(`Flow with id ${flowId} not found`);
    }
    return flow;
  }

  /**
   * PATCH /api/flows/:flowId
   * Update flow.
   * Tool properties are now set on individual UserIntent trigger nodes.
   */
  @Patch('flows/:flowId')
  async updateFlow(
    @Param('flowId') flowId: string,
    @Body() request: UpdateFlowRequest
  ): Promise<Flow> {
    return this.flowService.update(flowId, request);
  }

  /**
   * GET /api/flows/:flowId/deletion-check
   * Check what happens if this flow is deleted
   */
  @Get('flows/:flowId/deletion-check')
  async checkFlowDeletion(@Param('flowId') flowId: string): Promise<FlowDeletionCheck> {
    return this.flowService.checkDeletion(flowId);
  }

  /**
   * DELETE /api/flows/:flowId
   * Delete flow and return deletion info
   */
  @Delete('flows/:flowId')
  @HttpCode(HttpStatus.OK)
  async deleteFlow(@Param('flowId') flowId: string): Promise<DeleteFlowResponse> {
    return this.flowService.delete(flowId);
  }
}
