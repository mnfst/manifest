import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallFlowEntity } from './call-flow.entity';
import { FlowEntity } from '../flow/flow.entity';
import type { CallFlow, CreateCallFlowRequest, UpdateCallFlowRequest } from '@chatgpt-app-builder/shared';

/**
 * Service for CallFlow CRUD operations
 * Call flows represent end actions that trigger other flows
 */
@Injectable()
export class CallFlowService {
  constructor(
    @InjectRepository(CallFlowEntity)
    private readonly callFlowRepository: Repository<CallFlowEntity>,
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>
  ) {}

  /**
   * Create a new call flow for a flow
   * Call flows and return values are mutually exclusive
   */
  async create(flowId: string, data: CreateCallFlowRequest): Promise<CallFlow> {
    // Check if flow exists and has return values (mutual exclusivity with return values only)
    const flow = await this.flowRepository.findOne({
      where: { id: flowId },
      relations: ['returnValues'],
    });

    if (!flow) {
      throw new NotFoundException(`Flow with id ${flowId} not found`);
    }

    if (flow.returnValues && flow.returnValues.length > 0) {
      throw new BadRequestException(
        'Cannot add call flows to a flow that has return values. Flows can only have one type of end action.'
      );
    }

    // Validate target flow
    if (flowId === data.targetFlowId) {
      throw new BadRequestException(
        'A flow cannot call itself. Please select a different target flow.'
      );
    }

    const targetFlow = await this.flowRepository.findOne({
      where: { id: data.targetFlowId },
    });

    if (!targetFlow) {
      throw new NotFoundException(`Target flow with id ${data.targetFlowId} not found`);
    }

    if (flow.appId !== targetFlow.appId) {
      throw new BadRequestException(
        'Target flow must be in the same app.'
      );
    }

    // Get current max order for this flow
    const maxOrder = await this.callFlowRepository
      .createQueryBuilder('callFlow')
      .where('callFlow.flowId = :flowId', { flowId })
      .select('MAX(callFlow.order)', 'maxOrder')
      .getRawOne();

    const order = (maxOrder?.maxOrder ?? -1) + 1;

    const entity = this.callFlowRepository.create({
      flowId,
      targetFlowId: data.targetFlowId,
      order,
    });

    const saved = await this.callFlowRepository.save(entity);

    // Reload with target flow relation
    const reloaded = await this.callFlowRepository.findOne({
      where: { id: saved.id },
      relations: ['targetFlow'],
    });

    return this.entityToCallFlow(reloaded!);
  }

  /**
   * Get call flow by ID
   */
  async findById(id: string): Promise<CallFlow | null> {
    const entity = await this.callFlowRepository.findOne({
      where: { id },
      relations: ['targetFlow'],
    });
    return entity ? this.entityToCallFlow(entity) : null;
  }

  /**
   * Get all call flows for a flow
   */
  async findByFlowId(flowId: string): Promise<CallFlow[]> {
    const entities = await this.callFlowRepository.find({
      where: { flowId },
      relations: ['targetFlow'],
      order: { order: 'ASC' },
    });
    return entities.map((entity) => this.entityToCallFlow(entity));
  }

  /**
   * Update a call flow
   */
  async update(id: string, updates: UpdateCallFlowRequest): Promise<CallFlow> {
    const entity = await this.callFlowRepository.findOne({
      where: { id },
      relations: ['flow'],
    });
    if (!entity) {
      throw new NotFoundException(`CallFlow with id ${id} not found`);
    }

    if (updates.targetFlowId !== undefined) {
      // Validate new target
      if (entity.flowId === updates.targetFlowId) {
        throw new BadRequestException(
          'A flow cannot call itself. Please select a different target flow.'
        );
      }

      const targetFlow = await this.flowRepository.findOne({
        where: { id: updates.targetFlowId },
      });

      if (!targetFlow) {
        throw new NotFoundException(`Target flow with id ${updates.targetFlowId} not found`);
      }

      const parentFlow = await this.flowRepository.findOne({
        where: { id: entity.flowId },
      });

      if (parentFlow && parentFlow.appId !== targetFlow.appId) {
        throw new BadRequestException(
          'Target flow must be in the same app.'
        );
      }

      entity.targetFlowId = updates.targetFlowId;
    }

    const saved = await this.callFlowRepository.save(entity);

    // Reload with target flow relation
    const reloaded = await this.callFlowRepository.findOne({
      where: { id: saved.id },
      relations: ['targetFlow'],
    });

    return this.entityToCallFlow(reloaded!);
  }

  /**
   * Delete a call flow
   */
  async delete(id: string): Promise<void> {
    const entity = await this.callFlowRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`CallFlow with id ${id} not found`);
    }

    await this.callFlowRepository.remove(entity);
  }

  /**
   * Reorder call flows within a flow
   */
  async reorder(flowId: string, orderedIds: string[]): Promise<CallFlow[]> {
    // Verify all call flows belong to this flow
    const callFlows = await this.callFlowRepository.find({
      where: { flowId },
    });

    const callFlowMap = new Map(callFlows.map((cf) => [cf.id, cf]));

    // Validate all orderedIds exist and belong to this flow
    for (const id of orderedIds) {
      if (!callFlowMap.has(id)) {
        throw new BadRequestException(`CallFlow ${id} not found in flow ${flowId}`);
      }
    }

    // Update order for each call flow
    const updates = orderedIds.map((id, index) => {
      const callFlow = callFlowMap.get(id)!;
      callFlow.order = index;
      return callFlow;
    });

    await this.callFlowRepository.save(updates);

    return this.findByFlowId(flowId);
  }

  /**
   * Convert entity to CallFlow interface
   */
  private entityToCallFlow(entity: CallFlowEntity): CallFlow {
    return {
      id: entity.id,
      flowId: entity.flowId,
      targetFlowId: entity.targetFlowId,
      targetFlow: entity.targetFlow ? {
        id: entity.targetFlow.id,
        name: entity.targetFlow.name,
        toolName: entity.targetFlow.toolName,
      } : undefined,
      order: entity.order,
      createdAt: entity.createdAt?.toISOString(),
      updatedAt: entity.updatedAt?.toISOString(),
    };
  }
}
