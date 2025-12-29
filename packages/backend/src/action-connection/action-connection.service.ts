import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionConnectionEntity } from './action-connection.entity';
import { ViewEntity } from '../view/view.entity';
import { ReturnValueEntity } from '../return-value/return-value.entity';
import { CallFlowEntity } from '../call-flow/call-flow.entity';
import type { ActionConnection, CreateActionConnectionRequest, UpdateActionConnectionRequest } from '@chatgpt-app-builder/shared';
import { LAYOUT_REGISTRY, type LayoutTemplate } from '@chatgpt-app-builder/shared';

/**
 * Service for ActionConnection CRUD operations
 * Action connections link view actions to return values or call flows
 */
@Injectable()
export class ActionConnectionService {
  constructor(
    @InjectRepository(ActionConnectionEntity)
    private readonly actionConnectionRepository: Repository<ActionConnectionEntity>,
    @InjectRepository(ViewEntity)
    private readonly viewRepository: Repository<ViewEntity>,
    @InjectRepository(ReturnValueEntity)
    private readonly returnValueRepository: Repository<ReturnValueEntity>,
    @InjectRepository(CallFlowEntity)
    private readonly callFlowRepository: Repository<CallFlowEntity>
  ) {}

  /**
   * Create a new action connection for a view
   */
  async create(viewId: string, data: CreateActionConnectionRequest): Promise<ActionConnection> {
    // Check if view exists
    const view = await this.viewRepository.findOne({
      where: { id: viewId },
      relations: ['flow'],
    });

    if (!view) {
      throw new NotFoundException(`View with id ${viewId} not found`);
    }

    // Validate action name is valid for this view's layout template
    const layoutConfig = LAYOUT_REGISTRY[view.layoutTemplate as LayoutTemplate];
    const validAction = layoutConfig?.actions?.find(a => a.name === data.actionName);
    if (!validAction) {
      throw new BadRequestException(
        `Action "${data.actionName}" is not valid for layout template "${view.layoutTemplate}"`
      );
    }

    // Check if action connection already exists
    const existing = await this.actionConnectionRepository.findOne({
      where: { viewId, actionName: data.actionName },
    });

    if (existing) {
      throw new ConflictException(
        `Action connection for action "${data.actionName}" already exists. Use PUT to update.`
      );
    }

    // Validate target based on targetType
    await this.validateTarget(view.flow!.id, data);

    const entity = this.actionConnectionRepository.create({
      viewId,
      actionName: data.actionName,
      targetType: data.targetType,
      targetReturnValueId: data.targetType === 'return-value' ? data.targetReturnValueId : undefined,
      targetCallFlowId: data.targetType === 'call-flow' ? data.targetCallFlowId : undefined,
    });

    const saved = await this.actionConnectionRepository.save(entity);

    return this.entityToActionConnection(saved);
  }

  /**
   * Get action connection by view ID and action name
   */
  async findByViewAndAction(viewId: string, actionName: string): Promise<ActionConnection | null> {
    const entity = await this.actionConnectionRepository.findOne({
      where: { viewId, actionName },
    });
    return entity ? this.entityToActionConnection(entity) : null;
  }

  /**
   * Get all action connections for a view
   */
  async findByViewId(viewId: string): Promise<ActionConnection[]> {
    const entities = await this.actionConnectionRepository.find({
      where: { viewId },
    });
    return entities.map((entity) => this.entityToActionConnection(entity));
  }

  /**
   * Get all action connections for a flow (across all views)
   */
  async findByFlowId(flowId: string): Promise<ActionConnection[]> {
    // Get all views for this flow
    const views = await this.viewRepository.find({
      where: { flowId },
    });

    if (views.length === 0) {
      return [];
    }

    const viewIds = views.map(v => v.id);
    const entities = await this.actionConnectionRepository
      .createQueryBuilder('ac')
      .where('ac.viewId IN (:...viewIds)', { viewIds })
      .getMany();

    return entities.map((entity) => this.entityToActionConnection(entity));
  }

  /**
   * Update an action connection
   */
  async update(viewId: string, actionName: string, updates: UpdateActionConnectionRequest): Promise<ActionConnection> {
    const entity = await this.actionConnectionRepository.findOne({
      where: { viewId, actionName },
    });

    if (!entity) {
      throw new NotFoundException(`Action connection for action "${actionName}" not found`);
    }

    // Get view to validate target belongs to same flow
    const view = await this.viewRepository.findOne({
      where: { id: viewId },
      relations: ['flow'],
    });

    if (!view) {
      throw new NotFoundException(`View with id ${viewId} not found`);
    }

    // Validate new target
    await this.validateTarget(view.flow!.id, updates);

    entity.targetType = updates.targetType;
    entity.targetReturnValueId = updates.targetType === 'return-value' ? updates.targetReturnValueId : undefined;
    entity.targetCallFlowId = updates.targetType === 'call-flow' ? updates.targetCallFlowId : undefined;

    const saved = await this.actionConnectionRepository.save(entity);

    return this.entityToActionConnection(saved);
  }

  /**
   * Delete an action connection
   */
  async delete(viewId: string, actionName: string): Promise<void> {
    const entity = await this.actionConnectionRepository.findOne({
      where: { viewId, actionName },
    });

    if (!entity) {
      throw new NotFoundException(`Action connection for action "${actionName}" not found`);
    }

    await this.actionConnectionRepository.remove(entity);
  }

  /**
   * Delete all action connections for a view
   */
  async deleteByViewId(viewId: string): Promise<void> {
    await this.actionConnectionRepository.delete({ viewId });
  }

  /**
   * Validate that target exists and belongs to the same flow
   */
  private async validateTarget(flowId: string, data: { targetType: string; targetReturnValueId?: string; targetCallFlowId?: string }): Promise<void> {
    if (data.targetType === 'return-value') {
      if (!data.targetReturnValueId) {
        throw new BadRequestException('targetReturnValueId is required when targetType is "return-value"');
      }

      const returnValue = await this.returnValueRepository.findOne({
        where: { id: data.targetReturnValueId },
      });

      if (!returnValue) {
        throw new NotFoundException(`Return value with id ${data.targetReturnValueId} not found`);
      }

      if (returnValue.flowId !== flowId) {
        throw new BadRequestException('Target return value must belong to the same flow as the view');
      }
    } else if (data.targetType === 'call-flow') {
      if (!data.targetCallFlowId) {
        throw new BadRequestException('targetCallFlowId is required when targetType is "call-flow"');
      }

      const callFlow = await this.callFlowRepository.findOne({
        where: { id: data.targetCallFlowId },
      });

      if (!callFlow) {
        throw new NotFoundException(`Call flow with id ${data.targetCallFlowId} not found`);
      }

      if (callFlow.flowId !== flowId) {
        throw new BadRequestException('Target call flow must belong to the same flow as the view');
      }
    } else {
      throw new BadRequestException('targetType must be "return-value" or "call-flow"');
    }
  }

  /**
   * Convert entity to ActionConnection interface
   */
  private entityToActionConnection(entity: ActionConnectionEntity): ActionConnection {
    return {
      id: entity.id,
      viewId: entity.viewId,
      actionName: entity.actionName,
      targetType: entity.targetType,
      targetReturnValueId: entity.targetReturnValueId,
      targetCallFlowId: entity.targetCallFlowId,
      createdAt: entity.createdAt?.toISOString(),
      updatedAt: entity.updatedAt?.toISOString(),
    };
  }
}
