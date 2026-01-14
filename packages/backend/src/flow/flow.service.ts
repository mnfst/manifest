import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlowEntity } from './flow.entity';
import type { Flow, FlowDeletionCheck, DeleteFlowResponse, UpdateFlowRequest } from '@chatgpt-app-builder/shared';
import { AppEntity } from '../app/app.entity';

/**
 * Service for Flow CRUD operations.
 * MCP tools are now derived from UserIntent trigger nodes within flows.
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
   * Create a new flow for an app.
   * Initializes empty nodes and connections arrays.
   * Tool properties are now set on individual UserIntent trigger nodes.
   */
  async create(appId: string, data: {
    name: string;
    description?: string;
  }): Promise<Flow> {
    const entity = this.flowRepository.create({
      appId,
      name: data.name,
      description: data.description,
      nodes: [],
      connections: [],
    });

    const saved = await this.flowRepository.save(entity);
    return this.entityToFlow(saved);
  }

  /**
   * Get flow by ID
   */
  async findById(id: string): Promise<Flow | null> {
    const entity = await this.flowRepository.findOne({
      where: { id },
    });
    return entity ? this.entityToFlow(entity) : null;
  }

  /**
   * Get all flows for an app
   */
  async findByAppId(appId: string): Promise<Flow[]> {
    const entities = await this.flowRepository.find({
      where: { appId },
      order: { createdAt: 'ASC' },
    });
    return entities.map((entity) => this.entityToFlow(entity));
  }

  /**
   * Update a flow.
   * Tool properties are now set on individual UserIntent trigger nodes.
   */
  async update(id: string, updates: UpdateFlowRequest): Promise<Flow> {
    const entity = await this.flowRepository.findOne({
      where: { id },
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
    if (updates.isActive !== undefined) {
      entity.isActive = updates.isActive;
    }

    await this.flowRepository.save(entity);

    // Refetch to get updated entity
    const updated = await this.flowRepository.findOne({
      where: { id },
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
    });

    if (!entity) {
      throw new NotFoundException(`Flow with id ${id} not found`);
    }

    // Count StatCard nodes (UI components) for backward compatibility in response
    const deletedViewCount = (entity.nodes ?? []).filter((n) => n.type === 'StatCard').length;

    await this.flowRepository.remove(entity);

    return {
      success: true,
      deletedViewCount,
    };
  }

  /**
   * Convert entity to Flow interface.
   * Tool properties are now on UserIntent trigger nodes, not the flow.
   */
  private entityToFlow(entity: FlowEntity): Flow {
    return {
      id: entity.id,
      appId: entity.appId,
      name: entity.name,
      description: entity.description,
      isActive: entity.isActive ?? true,
      nodes: entity.nodes ?? [],
      connections: entity.connections ?? [],
      createdAt: entity.createdAt?.toISOString(),
      updatedAt: entity.updatedAt?.toISOString(),
    };
  }

  /**
   * Migration: Delete all flows containing old interface nodes (StatCard, PostList).
   * These node types have been removed in favor of registry-based UI components.
   *
   * @returns Number of flows deleted
   */
  async migrateDeleteOldInterfaceFlows(): Promise<number> {
    // Find all flows that contain StatCard or PostList nodes
    const allFlows = await this.flowRepository.find();

    const flowsToDelete = allFlows.filter((flow) => {
      const nodes = flow.nodes ?? [];
      return nodes.some((node) => node.type === 'StatCard' || node.type === 'PostList');
    });

    if (flowsToDelete.length > 0) {
      await this.flowRepository.remove(flowsToDelete);
    }

    return flowsToDelete.length;
  }
}
