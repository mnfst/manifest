import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { FlowExecutionEntity } from './flow-execution.entity';
import { paginate } from '../common/paginate';
import type {
  ExecutionListResponse,
  FlowExecution,
} from '@manifest/shared';
import type {
  CreateExecutionParams,
  UpdateExecutionParams,
  FindByFlowOptions,
} from './flow-execution.types';
import { toExecutionListItem, toFlowExecution } from '../utils/entity-mappers';

export type { CreateExecutionParams, UpdateExecutionParams, FindByFlowOptions } from './flow-execution.types';

@Injectable()
export class FlowExecutionService {
  constructor(
    @InjectRepository(FlowExecutionEntity)
    private readonly executionRepository: Repository<FlowExecutionEntity>
  ) {}

  /**
   * Create a new execution record when a flow is invoked via MCP
   */
  async createExecution(params: CreateExecutionParams): Promise<FlowExecutionEntity> {
    const execution = this.executionRepository.create({
      flowId: params.flowId,
      flowName: params.flowName,
      flowToolName: params.flowToolName,
      initialParams: params.initialParams,
      status: 'pending',
      nodeExecutions: [],
      isPreview: params.isPreview ?? false,
      userFingerprint: params.userFingerprint,
    });

    return this.executionRepository.save(execution);
  }

  /**
   * Update an existing execution (status, endedAt, nodeExecutions, errorInfo)
   */
  async updateExecution(
    id: string,
    params: UpdateExecutionParams
  ): Promise<FlowExecutionEntity> {
    const execution = await this.executionRepository.findOne({ where: { id } });

    if (!execution) {
      throw new NotFoundException(`Execution not found: ${id}`);
    }

    if (params.status !== undefined) {
      execution.status = params.status;
    }
    if (params.endedAt !== undefined) {
      execution.endedAt = params.endedAt;
    }
    if (params.nodeExecutions !== undefined) {
      execution.nodeExecutions = params.nodeExecutions;
    }
    if (params.errorInfo !== undefined) {
      execution.errorInfo = params.errorInfo;
    }

    return this.executionRepository.save(execution);
  }

  /**
   * Get paginated list of executions for a flow
   */
  async findByFlow(
    flowId: string,
    options: FindByFlowOptions = {}
  ): Promise<ExecutionListResponse> {
    const { status, isPreview, ...paginationQuery } = options;

    const whereClause: Record<string, unknown> = { flowId };
    if (status) {
      whereClause.status = status;
    }
    if (isPreview !== undefined) {
      whereClause.isPreview = isPreview;
    }

    const paginatedResult = await paginate(this.executionRepository, {
      query: paginationQuery,
      where: whereClause as any,
      order: { startedAt: 'DESC' } as any,
    });

    // Check if any pending executions exist for this flow
    const pendingCount = await this.executionRepository.count({
      where: { flowId, status: 'pending' },
    });

    return {
      ...paginatedResult,
      items: paginatedResult.items.map((exec) => toExecutionListItem(exec)),
      hasPendingExecutions: pendingCount > 0,
    };
  }

  /**
   * Get a single execution by ID
   */
  async findOne(id: string): Promise<FlowExecution | null> {
    const execution = await this.executionRepository.findOne({ where: { id } });

    if (!execution) {
      return null;
    }

    return toFlowExecution(execution);
  }

  /**
   * Get a single execution by ID, throwing if not found
   */
  async findOneOrFail(id: string): Promise<FlowExecution> {
    const execution = await this.findOne(id);

    if (!execution) {
      throw new NotFoundException(`Execution not found: ${id}`);
    }

    return execution;
  }

  /**
   * Mark timed-out pending executions as error
   * Called on query to handle executions that exceeded timeout
   */
  async markTimedOutExecutions(timeoutMinutes: number = 5): Promise<number> {
    const timeoutThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const result = await this.executionRepository.update(
      {
        status: 'pending',
        startedAt: LessThan(timeoutThreshold),
      },
      {
        status: 'error',
        endedAt: new Date(),
        errorInfo: {
          message: `Execution timed out after ${timeoutMinutes} minutes`,
        },
      }
    );

    return result.affected ?? 0;
  }

}
