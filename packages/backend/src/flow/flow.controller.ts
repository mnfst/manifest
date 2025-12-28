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
import { FlowService } from './flow.service';
import { ViewService } from '../view/view.service';
import { AgentService } from '../agent/agent.service';
import {
  toSnakeCase,
  isValidToolName,
} from '@chatgpt-app-builder/shared';
import type {
  Flow,
  FlowWithApp,
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
    private readonly flowService: FlowService,
    @Inject(forwardRef(() => ViewService))
    private readonly viewService: ViewService,
    @Inject(forwardRef(() => AgentService))
    private readonly agentService: AgentService
  ) {}

  /**
   * GET /api/flows
   * List all flows with parent app data
   * Used by the sidebar Flows page
   */
  @Get('flows')
  async getAllFlows(): Promise<FlowWithApp[]> {
    const entities = await this.flowService.findAllWithApp();
    return entities.map((entity) => ({
      id: entity.id,
      appId: entity.appId,
      name: entity.name,
      description: entity.description,
      toolName: entity.toolName,
      toolDescription: entity.toolDescription,
      whenToUse: entity.whenToUse,
      whenNotToUse: entity.whenNotToUse,
      isActive: entity.isActive ?? true,
      createdAt: entity.createdAt?.toISOString(),
      updatedAt: entity.updatedAt?.toISOString(),
      app: {
        id: entity.app.id,
        name: entity.app.name,
        slug: entity.app.slug,
      },
    }));
  }

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
   * Create a new flow with name and description
   * Tool name is auto-generated from name using snake_case conversion
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

    // Generate tool name from name
    const toolName = toSnakeCase(request.name);

    // Validate that the generated tool name is valid
    if (!isValidToolName(toolName)) {
      throw new BadRequestException('Name must contain at least one letter or number');
    }

    // Validate description length if provided
    if (request.description && request.description.length > 500) {
      throw new BadRequestException('Description exceeds maximum length of 500 characters');
    }

    // Create the flow with minimal data (no views, empty user intent)
    const flow = await this.flowService.create(appId, {
      name: request.name.trim(),
      description: request.description?.trim(),
      toolName,
      toolDescription: '', // Empty until user adds via User Intent modal
    });

    // Fetch flow with views (will be empty)
    const flowWithViews = await this.flowService.findById(flow.id);
    if (!flowWithViews) {
      throw new NotFoundException('Flow not found after creation');
    }

    return {
      flow: flowWithViews,
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
   * Update flow
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
