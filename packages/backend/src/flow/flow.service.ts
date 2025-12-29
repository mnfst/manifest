import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlowEntity } from './flow.entity';
import type { Flow, FlowDeletionCheck, DeleteFlowResponse, UpdateFlowRequest, FlowParameter } from '@chatgpt-app-builder/shared';
import { AppEntity } from '../app/app.entity';

/**
 * Service for Flow CRUD operations
 * Flows represent MCP tools within an app
 */
@Injectable()
export class FlowService {
  constructor(
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>,
    @InjectRepository(AppEntity)
    private readonly appRepository: Repository<AppEntity>
  ) {}

  /**
   * Create a new flow for an app
   */
  async create(appId: string, data: {
    name: string;
    description?: string;
    toolName: string;
    toolDescription: string;
    whenToUse?: string;
    whenNotToUse?: string;
    parameters?: FlowParameter[];
  }): Promise<Flow> {
    const entity = this.flowRepository.create({
      appId,
      name: data.name,
      description: data.description,
      toolName: data.toolName,
      toolDescription: data.toolDescription,
      whenToUse: data.whenToUse,
      whenNotToUse: data.whenNotToUse,
      parameters: data.parameters ?? [],
    });

    const saved = await this.flowRepository.save(entity);
    return this.entityToFlow(saved);
  }

  /**
   * Get all flows with their parent app data
   * Used for cross-app flow listings
   */
  async findAllWithApp(): Promise<FlowEntity[]> {
    return this.flowRepository.find({
      relations: ['app'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get flow by ID
   */
  async findById(id: string): Promise<Flow | null> {
    const entity = await this.flowRepository.findOne({
      where: { id },
      relations: ['views', 'views.mockDataEntity', 'returnValues', 'callFlows', 'callFlows.targetFlow'],
    });
    return entity ? this.entityToFlow(entity) : null;
  }

  /**
   * Get all flows for an app
   */
  async findByAppId(appId: string): Promise<Flow[]> {
    const entities = await this.flowRepository.find({
      where: { appId },
      relations: ['views', 'views.mockDataEntity', 'returnValues', 'callFlows', 'callFlows.targetFlow'],
      order: { createdAt: 'ASC' },
    });
    return entities.map((entity) => this.entityToFlow(entity));
  }

  /**
   * Update a flow
   */
  async update(id: string, updates: UpdateFlowRequest): Promise<Flow> {
    const entity = await this.flowRepository.findOne({
      where: { id },
      relations: ['views', 'views.mockDataEntity', 'returnValues'],
    });
    if (!entity) {
      throw new NotFoundException(`Flow with id ${id} not found`);
    }

    if (updates.name !== undefined) {
      entity.name = updates.name;
    }
    if (updates.description !== undefined) {
      entity.description = updates.description;
    }
    if (updates.toolName !== undefined) {
      entity.toolName = updates.toolName;
    }
    if (updates.toolDescription !== undefined) {
      entity.toolDescription = updates.toolDescription;
    }
    if (updates.whenToUse !== undefined) {
      entity.whenToUse = updates.whenToUse;
    }
    if (updates.whenNotToUse !== undefined) {
      entity.whenNotToUse = updates.whenNotToUse;
    }
    if (updates.isActive !== undefined) {
      entity.isActive = updates.isActive;
    }
    if (updates.parameters !== undefined) {
      entity.parameters = updates.parameters;
    }

    await this.flowRepository.save(entity);

    // Refetch with all relations including callFlows
    const updated = await this.flowRepository.findOne({
      where: { id },
      relations: ['views', 'views.mockDataEntity', 'returnValues', 'callFlows', 'callFlows.targetFlow'],
    });
    return this.entityToFlow(updated!);
  }

  /**
   * Check if a flow can be deleted and what the consequences are
   */
  async checkDeletion(id: string): Promise<FlowDeletionCheck> {
    const entity = await this.flowRepository.findOne({
      where: { id },
      relations: ['app'],
    });

    if (!entity) {
      throw new NotFoundException(`Flow with id ${id} not found`);
    }

    // Get total flow count for the app
    const flowCount = await this.flowRepository.count({
      where: { appId: entity.appId },
    });

    const isLastFlow = flowCount === 1;
    const appIsPublished = entity.app?.status === 'published';

    let warningMessage: string | undefined;
    if (isLastFlow && appIsPublished) {
      warningMessage = 'This is the last flow. Deleting it will require unpublishing the app since apps need at least one flow to be published.';
    } else if (isLastFlow) {
      warningMessage = 'This is the last flow in this app.';
    }

    return {
      canDelete: true,
      isLastFlow,
      appIsPublished,
      warningMessage,
    };
  }

  /**
   * Delete a flow and return deletion info
   */
  async delete(id: string): Promise<DeleteFlowResponse> {
    const entity = await this.flowRepository.findOne({
      where: { id },
      relations: ['views', 'views.mockDataEntity', 'returnValues'],
    });

    if (!entity) {
      throw new NotFoundException(`Flow with id ${id} not found`);
    }

    const deletedViewCount = entity.views?.length ?? 0;

    await this.flowRepository.remove(entity);

    return {
      success: true,
      deletedViewCount,
    };
  }

  /**
   * Convert entity to Flow interface
   */
  private entityToFlow(entity: FlowEntity): Flow {
    return {
      id: entity.id,
      appId: entity.appId,
      name: entity.name,
      description: entity.description,
      toolName: entity.toolName,
      toolDescription: entity.toolDescription,
      whenToUse: entity.whenToUse,
      whenNotToUse: entity.whenNotToUse,
      isActive: entity.isActive ?? true,
      parameters: entity.parameters ?? [],
      views: entity.views?.map((view) => ({
        id: view.id,
        flowId: view.flowId,
        name: view.name,
        layoutTemplate: view.layoutTemplate,
        mockData: view.mockDataEntity ? {
          id: view.mockDataEntity.id,
          viewId: view.mockDataEntity.viewId,
          data: view.mockDataEntity.data,
          createdAt: view.mockDataEntity.createdAt?.toISOString(),
          updatedAt: view.mockDataEntity.updatedAt?.toISOString(),
        } : undefined,
        order: view.order,
        createdAt: view.createdAt?.toISOString(),
        updatedAt: view.updatedAt?.toISOString(),
      })),
      returnValues: entity.returnValues?.map((rv) => ({
        id: rv.id,
        flowId: rv.flowId,
        text: rv.text,
        order: rv.order,
        createdAt: rv.createdAt?.toISOString(),
        updatedAt: rv.updatedAt?.toISOString(),
      })),
      callFlows: entity.callFlows?.map((cf) => ({
        id: cf.id,
        flowId: cf.flowId,
        targetFlowId: cf.targetFlowId,
        targetFlow: cf.targetFlow ? {
          id: cf.targetFlow.id,
          appId: cf.targetFlow.appId,
          name: cf.targetFlow.name,
          toolName: cf.targetFlow.toolName,
        } : undefined,
        order: cf.order,
        createdAt: cf.createdAt?.toISOString(),
        updatedAt: cf.updatedAt?.toISOString(),
      })),
      createdAt: entity.createdAt?.toISOString(),
      updatedAt: entity.updatedAt?.toISOString(),
    };
  }
}
