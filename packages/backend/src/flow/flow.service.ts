import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlowEntity } from './flow.entity';
import type { Flow, CreateFlowRequest, UpdateFlowRequest } from '@chatgpt-app-builder/shared';

/**
 * Service for Flow CRUD operations
 * Flows represent MCP tools within an app
 */
@Injectable()
export class FlowService {
  constructor(
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>
  ) {}

  /**
   * Create a new flow for an app
   */
  async create(appId: string, data: {
    name: string;
    description?: string;
    toolName: string;
    toolDescription: string;
  }): Promise<Flow> {
    const entity = this.flowRepository.create({
      appId,
      name: data.name,
      description: data.description,
      toolName: data.toolName,
      toolDescription: data.toolDescription,
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
      relations: ['views'],
    });
    return entity ? this.entityToFlow(entity) : null;
  }

  /**
   * Get all flows for an app
   */
  async findByAppId(appId: string): Promise<Flow[]> {
    const entities = await this.flowRepository.find({
      where: { appId },
      relations: ['views'],
      order: { createdAt: 'ASC' },
    });
    return entities.map((entity) => this.entityToFlow(entity));
  }

  /**
   * Update a flow
   */
  async update(id: string, updates: UpdateFlowRequest): Promise<Flow> {
    const entity = await this.flowRepository.findOne({ where: { id } });
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

    const saved = await this.flowRepository.save(entity);
    return this.entityToFlow(saved);
  }

  /**
   * Delete a flow
   */
  async delete(id: string): Promise<void> {
    const entity = await this.flowRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Flow with id ${id} not found`);
    }

    await this.flowRepository.remove(entity);
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
      views: entity.views?.map((view) => ({
        id: view.id,
        flowId: view.flowId,
        name: view.name,
        layoutTemplate: view.layoutTemplate,
        mockData: view.mockData,
        order: view.order,
        createdAt: view.createdAt?.toISOString(),
        updatedAt: view.updatedAt?.toISOString(),
      })),
      createdAt: entity.createdAt?.toISOString(),
      updatedAt: entity.updatedAt?.toISOString(),
    };
  }
}
