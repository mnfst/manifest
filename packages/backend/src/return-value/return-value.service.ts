import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReturnValueEntity } from './return-value.entity';
import { FlowEntity } from '../flow/flow.entity';
import type { ReturnValue, CreateReturnValueRequest, UpdateReturnValueRequest } from '@chatgpt-app-builder/shared';

/**
 * Service for ReturnValue CRUD operations
 * Return values represent text content items to return from an MCP tool
 */
@Injectable()
export class ReturnValueService {
  constructor(
    @InjectRepository(ReturnValueEntity)
    private readonly returnValueRepository: Repository<ReturnValueEntity>,
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>
  ) {}

  /**
   * Create a new return value for a flow
   * Enforces mutual exclusivity: cannot add return values if flow has views
   */
  async create(flowId: string, data: CreateReturnValueRequest): Promise<ReturnValue> {
    // Check if flow exists and has views or call flows (mutual exclusivity)
    const flow = await this.flowRepository.findOne({
      where: { id: flowId },
      relations: ['views', 'callFlows'],
    });

    if (!flow) {
      throw new NotFoundException(`Flow with id ${flowId} not found`);
    }

    if (flow.views && flow.views.length > 0) {
      throw new BadRequestException(
        'Cannot add return values to a flow that has views. Flows must use either views or return values, not both.'
      );
    }

    if (flow.callFlows && flow.callFlows.length > 0) {
      throw new BadRequestException(
        'Cannot add return values to a flow that has call flows. Flows can only have one type of end action.'
      );
    }

    // Get current max order for this flow
    const maxOrder = await this.returnValueRepository
      .createQueryBuilder('returnValue')
      .where('returnValue.flowId = :flowId', { flowId })
      .select('MAX(returnValue.order)', 'maxOrder')
      .getRawOne();

    const order = (maxOrder?.maxOrder ?? -1) + 1;

    const entity = this.returnValueRepository.create({
      flowId,
      text: data.text,
      order,
    });

    const saved = await this.returnValueRepository.save(entity);
    return this.entityToReturnValue(saved);
  }

  /**
   * Get return value by ID
   */
  async findById(id: string): Promise<ReturnValue | null> {
    const entity = await this.returnValueRepository.findOne({ where: { id } });
    return entity ? this.entityToReturnValue(entity) : null;
  }

  /**
   * Get all return values for a flow
   */
  async findByFlowId(flowId: string): Promise<ReturnValue[]> {
    const entities = await this.returnValueRepository.find({
      where: { flowId },
      order: { order: 'ASC' },
    });
    return entities.map((entity) => this.entityToReturnValue(entity));
  }

  /**
   * Update a return value
   */
  async update(id: string, updates: UpdateReturnValueRequest): Promise<ReturnValue> {
    const entity = await this.returnValueRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`ReturnValue with id ${id} not found`);
    }

    if (updates.text !== undefined) {
      entity.text = updates.text;
    }

    const saved = await this.returnValueRepository.save(entity);
    return this.entityToReturnValue(saved);
  }

  /**
   * Delete a return value
   */
  async delete(id: string): Promise<void> {
    const entity = await this.returnValueRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`ReturnValue with id ${id} not found`);
    }

    await this.returnValueRepository.remove(entity);
  }

  /**
   * Reorder return values within a flow
   */
  async reorder(flowId: string, orderedIds: string[]): Promise<ReturnValue[]> {
    // Verify all return values belong to this flow
    const returnValues = await this.returnValueRepository.find({
      where: { flowId },
    });

    const returnValueMap = new Map(returnValues.map((rv) => [rv.id, rv]));

    // Validate all orderedIds exist and belong to this flow
    for (const id of orderedIds) {
      if (!returnValueMap.has(id)) {
        throw new BadRequestException(`ReturnValue ${id} not found in flow ${flowId}`);
      }
    }

    // Update order for each return value
    const updates = orderedIds.map((id, index) => {
      const returnValue = returnValueMap.get(id)!;
      returnValue.order = index;
      return returnValue;
    });

    await this.returnValueRepository.save(updates);

    return this.findByFlowId(flowId);
  }

  /**
   * Convert entity to ReturnValue interface
   */
  private entityToReturnValue(entity: ReturnValueEntity): ReturnValue {
    return {
      id: entity.id,
      flowId: entity.flowId,
      text: entity.text,
      order: entity.order,
      createdAt: entity.createdAt?.toISOString(),
      updatedAt: entity.updatedAt?.toISOString(),
    };
  }
}
