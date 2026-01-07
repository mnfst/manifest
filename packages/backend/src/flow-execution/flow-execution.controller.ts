import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FlowExecutionService } from './flow-execution.service';
import type {
  ExecutionStatus,
  ExecutionListResponse,
  FlowExecution,
} from '@chatgpt-app-builder/shared';

@Controller('api/flows/:flowId/executions')
export class FlowExecutionController {
  constructor(private readonly executionService: FlowExecutionService) {}

  /**
   * GET /api/flows/:flowId/executions
   * List executions for a flow with pagination
   */
  @Get()
  async listExecutions(
    @Param('flowId', ParseUUIDPipe) flowId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: ExecutionStatus,
    @Query('isPreview') isPreview?: string
  ): Promise<ExecutionListResponse> {
    // Mark timed-out executions before querying
    await this.executionService.markTimedOutExecutions();

    return this.executionService.findByFlow(flowId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      isPreview: isPreview === undefined ? undefined : isPreview === 'true',
    });
  }

  /**
   * GET /api/flows/:flowId/executions/:executionId
   * Get execution details
   */
  @Get(':executionId')
  async getExecution(
    @Param('flowId', ParseUUIDPipe) flowId: string,
    @Param('executionId', ParseUUIDPipe) executionId: string
  ): Promise<FlowExecution> {
    const execution = await this.executionService.findOne(executionId);

    if (!execution) {
      throw new NotFoundException(`Execution not found: ${executionId}`);
    }

    // Verify execution belongs to the specified flow (or flow was deleted)
    if (execution.flowId && execution.flowId !== flowId) {
      throw new NotFoundException(`Execution not found: ${executionId}`);
    }

    return execution;
  }
}
