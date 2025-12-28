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
import { ReturnValueService } from './return-value.service';
import type {
  ReturnValue,
  CreateReturnValueRequest,
  UpdateReturnValueRequest,
  ReorderReturnValuesRequest,
} from '@chatgpt-app-builder/shared';

/**
 * ReturnValue controller with endpoints for return value management
 * - GET /flows/:flowId/return-values - List return values for a flow
 * - POST /flows/:flowId/return-values - Create return value
 * - GET /return-values/:returnValueId - Get return value by ID
 * - PATCH /return-values/:returnValueId - Update return value
 * - DELETE /return-values/:returnValueId - Delete return value
 * - POST /flows/:flowId/return-values/reorder - Reorder return values
 */
@Controller('api')
export class ReturnValueController {
  constructor(private readonly returnValueService: ReturnValueService) {}

  /**
   * GET /api/flows/:flowId/return-values
   * List all return values for a flow
   */
  @Get('flows/:flowId/return-values')
  async listReturnValues(@Param('flowId') flowId: string): Promise<ReturnValue[]> {
    return this.returnValueService.findByFlowId(flowId);
  }

  /**
   * POST /api/flows/:flowId/return-values
   * Create a new return value
   */
  @Post('flows/:flowId/return-values')
  @HttpCode(HttpStatus.CREATED)
  async createReturnValue(
    @Param('flowId') flowId: string,
    @Body() request: CreateReturnValueRequest
  ): Promise<ReturnValue> {
    return this.returnValueService.create(flowId, request);
  }

  /**
   * GET /api/return-values/:returnValueId
   * Get return value by ID
   */
  @Get('return-values/:returnValueId')
  async getReturnValue(@Param('returnValueId') returnValueId: string): Promise<ReturnValue> {
    const returnValue = await this.returnValueService.findById(returnValueId);
    if (!returnValue) {
      throw new NotFoundException(`ReturnValue with id ${returnValueId} not found`);
    }
    return returnValue;
  }

  /**
   * PATCH /api/return-values/:returnValueId
   * Update return value
   */
  @Patch('return-values/:returnValueId')
  async updateReturnValue(
    @Param('returnValueId') returnValueId: string,
    @Body() request: UpdateReturnValueRequest
  ): Promise<ReturnValue> {
    return this.returnValueService.update(returnValueId, request);
  }

  /**
   * DELETE /api/return-values/:returnValueId
   * Delete return value
   */
  @Delete('return-values/:returnValueId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReturnValue(@Param('returnValueId') returnValueId: string): Promise<void> {
    await this.returnValueService.delete(returnValueId);
  }

  /**
   * POST /api/flows/:flowId/return-values/reorder
   * Reorder return values within a flow
   */
  @Post('flows/:flowId/return-values/reorder')
  @HttpCode(HttpStatus.OK)
  async reorderReturnValues(
    @Param('flowId') flowId: string,
    @Body() request: ReorderReturnValuesRequest
  ): Promise<ReturnValue[]> {
    return this.returnValueService.reorder(flowId, request.orderedIds);
  }
}
