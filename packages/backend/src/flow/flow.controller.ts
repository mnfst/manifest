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
   * GET /api/apps/:appId/flows
   * List all flows for an app
   */
  @Get('apps/:appId/flows')
  async listFlows(@Param('appId') appId: string): Promise<Flow[]> {
    return this.flowService.findByAppId(appId);
  }

  /**
   * POST /api/apps/:appId/flows
   * Create a new flow using AI-assisted generation
   */
  @Post('apps/:appId/flows')
  @HttpCode(HttpStatus.CREATED)
  async createFlow(
    @Param('appId') appId: string,
    @Body() request: CreateFlowRequest
  ): Promise<GenerateFlowResponse> {
    // Validate prompt
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new BadRequestException('Prompt is required');
    }

    if (request.prompt.length > 10000) {
      throw new BadRequestException('Prompt exceeds maximum length of 10,000 characters');
    }

    // Generate flow configuration using agent
    const result = await this.agentService.generateFlow(request.prompt);

    // Create the flow
    const flow = await this.flowService.create(appId, {
      name: result.name,
      description: result.description,
      toolName: result.toolName,
      toolDescription: result.toolDescription,
    });

    // Create initial view with generated data
    await this.viewService.create(flow.id, {
      name: 'Main View',
      layoutTemplate: result.layoutTemplate,
      mockData: result.mockData,
    });

    // Fetch flow with views
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
