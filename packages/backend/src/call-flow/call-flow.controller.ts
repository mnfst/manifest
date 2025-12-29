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
} from '@nestjs/common';
import { CallFlowService } from './call-flow.service';
import type {
  CallFlow,
  CreateCallFlowRequest,
  UpdateCallFlowRequest,
  ReorderCallFlowsRequest,
} from '@chatgpt-app-builder/shared';

/**
 * CallFlow controller with endpoints for call flow management
 * - GET /flows/:flowId/call-flows - List call flows for a flow
 * - POST /flows/:flowId/call-flows - Create call flow
 * - GET /call-flows/:callFlowId - Get call flow by ID
 * - PATCH /call-flows/:callFlowId - Update call flow
 * - DELETE /call-flows/:callFlowId - Delete call flow
 * - POST /flows/:flowId/call-flows/reorder - Reorder call flows
 */
@Controller('api')
export class CallFlowController {
  constructor(private readonly callFlowService: CallFlowService) {}

  /**
   * GET /api/flows/:flowId/call-flows
   * List all call flows for a flow
   */
  @Get('flows/:flowId/call-flows')
  async listCallFlows(@Param('flowId') flowId: string): Promise<CallFlow[]> {
    return this.callFlowService.findByFlowId(flowId);
  }

  /**
   * POST /api/flows/:flowId/call-flows
   * Create a new call flow
   */
  @Post('flows/:flowId/call-flows')
  @HttpCode(HttpStatus.CREATED)
  async createCallFlow(
    @Param('flowId') flowId: string,
    @Body() request: CreateCallFlowRequest
  ): Promise<CallFlow> {
    return this.callFlowService.create(flowId, request);
  }

  /**
   * GET /api/call-flows/:callFlowId
   * Get call flow by ID
   */
  @Get('call-flows/:callFlowId')
  async getCallFlow(@Param('callFlowId') callFlowId: string): Promise<CallFlow> {
    const callFlow = await this.callFlowService.findById(callFlowId);
    if (!callFlow) {
      throw new NotFoundException(`CallFlow with id ${callFlowId} not found`);
    }
    return callFlow;
  }

  /**
   * PATCH /api/call-flows/:callFlowId
   * Update call flow
   */
  @Patch('call-flows/:callFlowId')
  async updateCallFlow(
    @Param('callFlowId') callFlowId: string,
    @Body() request: UpdateCallFlowRequest
  ): Promise<CallFlow> {
    return this.callFlowService.update(callFlowId, request);
  }

  /**
   * DELETE /api/call-flows/:callFlowId
   * Delete call flow
   */
  @Delete('call-flows/:callFlowId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCallFlow(@Param('callFlowId') callFlowId: string): Promise<void> {
    await this.callFlowService.delete(callFlowId);
  }

  /**
   * POST /api/flows/:flowId/call-flows/reorder
   * Reorder call flows within a flow
   */
  @Post('flows/:flowId/call-flows/reorder')
  @HttpCode(HttpStatus.OK)
  async reorderCallFlows(
    @Param('flowId') flowId: string,
    @Body() request: ReorderCallFlowsRequest
  ): Promise<CallFlow[]> {
    return this.callFlowService.reorder(flowId, request.orderedIds);
  }
}
