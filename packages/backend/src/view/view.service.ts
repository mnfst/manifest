import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ViewEntity } from './view.entity';
import type { View, CreateViewRequest, UpdateViewRequest, LayoutTemplate, MockData } from '@chatgpt-app-builder/shared';
import { DEFAULT_TABLE_MOCK_DATA } from '@chatgpt-app-builder/shared';

/**
 * Service for View CRUD operations
 * Views represent display units within a flow
 */
@Injectable()
export class ViewService {
  constructor(
    @InjectRepository(ViewEntity)
    private readonly viewRepository: Repository<ViewEntity>
  ) {}

  /**
   * Create a new view for a flow
   */
  async create(flowId: string, data: CreateViewRequest): Promise<View> {
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
    return this.entityToView(saved);
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
   */
  private entityToView(entity: ViewEntity): View {
    return {
      id: entity.id,
      flowId: entity.flowId,
      name: entity.name,
      layoutTemplate: entity.layoutTemplate,
      mockData: entity.mockData,
      order: entity.order,
      createdAt: entity.createdAt?.toISOString(),
      updatedAt: entity.updatedAt?.toISOString(),
    };
  }
}
