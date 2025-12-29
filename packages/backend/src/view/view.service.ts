import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ViewEntity } from './view.entity';
import { FlowEntity } from '../flow/flow.entity';
import type { View, CreateViewRequest, UpdateViewRequest } from '@chatgpt-app-builder/shared';
import { DEFAULT_TABLE_MOCK_DATA } from '@chatgpt-app-builder/shared';
import { MockDataService } from '../mock-data/mock-data.service';

/**
 * Service for View CRUD operations
 * Views represent display units within a flow
 */
@Injectable()
export class ViewService {
  constructor(
    @InjectRepository(ViewEntity)
    private readonly viewRepository: Repository<ViewEntity>,
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>,
    @Inject(forwardRef(() => MockDataService))
    private readonly mockDataService: MockDataService
  ) {}

  /**
   * Create a new view for a flow
   * Enforces mutual exclusivity: cannot add views if flow has return values
   */
  async create(flowId: string, data: CreateViewRequest): Promise<View> {
    // Check if flow exists and has return values or call flows (mutual exclusivity)
    const flow = await this.flowRepository.findOne({
      where: { id: flowId },
      relations: ['returnValues', 'callFlows'],
    });

    if (!flow) {
      throw new NotFoundException(`Flow with id ${flowId} not found`);
    }

    if (flow.returnValues && flow.returnValues.length > 0) {
      throw new BadRequestException(
        'Cannot add views to a flow that has return values. Flows must use either views or return values, not both.'
      );
    }

    if (flow.callFlows && flow.callFlows.length > 0) {
      throw new BadRequestException(
        'Cannot add views to a flow that has call flows. Flows must use either views or end actions, not both.'
      );
    }

    // Get current max order for this flow
    const maxOrder = await this.viewRepository
      .createQueryBuilder('view')
      .where('view.flowId = :flowId', { flowId })
      .select('MAX(view.order)', 'maxOrder')
      .getRawOne();

    const order = (maxOrder?.maxOrder ?? -1) + 1;

    const entity = this.viewRepository.create({
      flowId,
      name: data.name,
      layoutTemplate: data.layoutTemplate,
      mockData: data.mockData ?? DEFAULT_TABLE_MOCK_DATA,
      order,
    });

    const saved = await this.viewRepository.save(entity);

    // Create separate MockDataEntity for this view
    const mockDataDTO = await this.mockDataService.createForView(
      saved.id,
      saved.layoutTemplate
    );

    // Reload entity with the new relation
    const reloaded = await this.viewRepository.findOne({ where: { id: saved.id } });
    return this.entityToView(reloaded!, mockDataDTO);
  }

  /**
   * Get view by ID
   */
  async findById(id: string): Promise<View | null> {
    const entity = await this.viewRepository.findOne({ where: { id } });
    return entity ? this.entityToView(entity) : null;
  }

  /**
   * Get all views for a flow
   */
  async findByFlowId(flowId: string): Promise<View[]> {
    const entities = await this.viewRepository.find({
      where: { flowId },
      order: { order: 'ASC' },
    });
    return entities.map((entity) => this.entityToView(entity));
  }

  /**
   * Update a view
   */
  async update(id: string, updates: UpdateViewRequest): Promise<View> {
    const entity = await this.viewRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`View with id ${id} not found`);
    }

    if (updates.name !== undefined) {
      entity.name = updates.name;
    }
    if (updates.layoutTemplate !== undefined) {
      entity.layoutTemplate = updates.layoutTemplate;
    }
    if (updates.mockData !== undefined) {
      entity.mockData = updates.mockData;
    }

    const saved = await this.viewRepository.save(entity);
    return this.entityToView(saved);
  }

  /**
   * Delete a view (with protection for last view)
   */
  async delete(id: string): Promise<void> {
    const entity = await this.viewRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`View with id ${id} not found`);
    }

    // Check if this is the last view in the flow
    const viewCount = await this.viewRepository.count({
      where: { flowId: entity.flowId },
    });

    if (viewCount <= 1) {
      throw new BadRequestException('Cannot delete the last view in a flow');
    }

    await this.viewRepository.remove(entity);
  }

  /**
   * Reorder views within a flow
   */
  async reorder(flowId: string, viewIds: string[]): Promise<View[]> {
    // Verify all views belong to this flow
    const views = await this.viewRepository.find({
      where: { flowId },
    });

    const viewMap = new Map(views.map((v) => [v.id, v]));

    // Validate all viewIds exist and belong to this flow
    for (const id of viewIds) {
      if (!viewMap.has(id)) {
        throw new BadRequestException(`View ${id} not found in flow ${flowId}`);
      }
    }

    // Update order for each view
    const updates = viewIds.map((id, index) => {
      const view = viewMap.get(id)!;
      view.order = index;
      return view;
    });

    await this.viewRepository.save(updates);

    return this.findByFlowId(flowId);
  }

  /**
   * Convert entity to View interface
   * Includes mockData from the separate MockDataEntity if available
   */
  private entityToView(entity: ViewEntity, mockDataDTO?: import('@chatgpt-app-builder/shared').MockDataEntityDTO): View {
    // Use passed mockDataDTO, or convert from entity relation, or undefined
    const mockData = mockDataDTO ?? (entity.mockDataEntity ? {
      id: entity.mockDataEntity.id,
      viewId: entity.mockDataEntity.viewId,
      data: entity.mockDataEntity.data,
      createdAt: entity.mockDataEntity.createdAt?.toISOString(),
      updatedAt: entity.mockDataEntity.updatedAt?.toISOString(),
    } : undefined);

    return {
      id: entity.id,
      flowId: entity.flowId,
      name: entity.name,
      layoutTemplate: entity.layoutTemplate,
      mockData,
      order: entity.order,
      createdAt: entity.createdAt?.toISOString(),
      updatedAt: entity.updatedAt?.toISOString(),
    };
  }
}
