import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { MockDataService } from './mock-data.service';
import { AgentService } from '../agent/agent.service';
import { ViewService } from '../view/view.service';
import type {
  MockDataEntityDTO,
  MockDataChatRequest,
  MockDataChatResponse,
  UpdateMockDataRequest,
} from '@chatgpt-app-builder/shared';

/**
 * MockData controller with endpoints for mock data operations
 * - GET /mock-data/:id - Get mock data by ID
 * - GET /mock-data/view/:viewId - Get mock data by view ID
 * - PUT /mock-data/:id - Update mock data directly
 * - POST /mock-data/:id/chat - Chat to regenerate mock data
 */
@Controller('api/mock-data')
export class MockDataController {
  constructor(
    private readonly mockDataService: MockDataService,
    @Inject(forwardRef(() => AgentService))
    private readonly agentService: AgentService,
    @Inject(forwardRef(() => ViewService))
    private readonly viewService: ViewService
  ) {}

  /**
   * GET /api/mock-data/:id
   * Get mock data by ID
   */
  @Get(':id')
  async getMockDataById(@Param('id') id: string): Promise<MockDataEntityDTO> {
    const mockData = await this.mockDataService.findById(id);
    if (!mockData) {
      throw new NotFoundException(`MockData with id ${id} not found`);
    }
    return mockData;
  }

  /**
   * GET /api/mock-data/view/:viewId
   * Get mock data by view ID (auto-creates if not found)
   */
  @Get('view/:viewId')
  async getMockDataByViewId(
    @Param('viewId') viewId: string
  ): Promise<MockDataEntityDTO> {
    let mockData = await this.mockDataService.findByViewId(viewId);

    // Auto-create mock data for existing views that don't have it
    if (!mockData) {
      const view = await this.viewService.findById(viewId);
      if (!view) {
        throw new NotFoundException(`View ${viewId} not found`);
      }

      console.log(`Auto-creating mock data for view ${viewId} with layout ${view.layoutTemplate}`);
      mockData = await this.mockDataService.createForView(viewId, view.layoutTemplate);
    }

    return mockData;
  }

  /**
   * PUT /api/mock-data/:id
   * Update mock data directly with validation
   */
  @Put(':id')
  async updateMockData(
    @Param('id') id: string,
    @Body() request: UpdateMockDataRequest
  ): Promise<MockDataEntityDTO> {
    if (!request.data) {
      throw new BadRequestException('Data is required');
    }

    const currentMockData = await this.mockDataService.findById(id);
    if (!currentMockData) {
      throw new NotFoundException(`MockData with id ${id} not found`);
    }

    const view = await this.viewService.findById(currentMockData.viewId);
    if (!view) {
      throw new NotFoundException(`View for MockData ${id} not found`);
    }

    return this.mockDataService.update(id, request.data, view.layoutTemplate);
  }

  /**
   * POST /api/mock-data/:id/chat
   * Chat to regenerate mock data using AI
   */
  @Post(':id/chat')
  @HttpCode(HttpStatus.OK)
  async chatWithMockData(
    @Param('id') id: string,
    @Body() request: MockDataChatRequest
  ): Promise<MockDataChatResponse> {
    if (!request.message || request.message.trim().length === 0) {
      throw new BadRequestException('Message is required');
    }

    const currentMockData = await this.mockDataService.findById(id);
    if (!currentMockData) {
      throw new NotFoundException(`MockData with id ${id} not found`);
    }

    const view = await this.viewService.findById(currentMockData.viewId);
    if (!view) {
      throw new NotFoundException(`View for MockData ${id} not found`);
    }

    try {
      const result = await this.agentService.processMockDataChat(
        request.message,
        view.layoutTemplate
      );

      const updatedMockData = await this.mockDataService.update(
        id,
        result.mockData,
        view.layoutTemplate
      );

      return {
        message: result.response,
        mockData: updatedMockData,
      };
    } catch (error) {
      console.error('Failed to regenerate mock data:', error);
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Failed to generate mock data. Please try again.'
      );
    }
  }
}
