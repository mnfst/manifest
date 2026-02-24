import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { rangeToInterval, rangeToPreviousInterval } from '../../common/utils/range.util';
import { MetricWithTrend, computeTrend, addTenantFilter, formatTimestamp } from './query-helpers';
import {
  DbDialect, detectDialect, computeCutoff, sqlCastFloat,
} from '../../common/utils/sql-dialect';

export { MetricWithTrend };

@Injectable()
export class AggregationService {
  private readonly dialect: DbDialect;

  constructor(
    @InjectRepository(AgentMessage)
    private readonly turnRepo: Repository<AgentMessage>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly dataSource: DataSource,
  ) {
    this.dialect = detectDialect(this.dataSource.options.type as string);
  }

  async hasAnyData(userId: string, agentName?: string): Promise<boolean> {
    const qb = this.turnRepo.createQueryBuilder('at').select('1').limit(1);
    addTenantFilter(qb, userId, agentName);
    const row = await qb.getRawOne();
    return row != null;
  }

  async getTokenSummary(range: string, userId: string, agentName?: string) {
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);
    const cutoff = computeCutoff(interval);
    const prevCutoff = computeCutoff(prevInterval);
    const currentQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'total')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(currentQb, userId, agentName);
    const currentRow = await currentQb.getRawOne();

    const prevQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'total')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(prevQb, userId, agentName);
    const prevRow = await prevQb.getRawOne();

    const detailQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COALESCE(SUM(at.input_tokens), 0)', 'inp')
      .addSelect('COALESCE(SUM(at.output_tokens), 0)', 'out')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(detailQb, userId, agentName);
    const detail = await detailQb.getRawOne();

    const current = Number(currentRow?.total ?? 0);
    const previous = Number(prevRow?.total ?? 0);
    const inputTotal = Number(detail?.inp ?? 0);
    const outputTotal = Number(detail?.out ?? 0);

    return {
      tokens_today: {
        value: current,
        trend_pct: computeTrend(current, previous),
        sub_values: { input: inputTotal, output: outputTotal },
      } as MetricWithTrend,
      input_tokens: inputTotal,
      output_tokens: outputTotal,
    };
  }

  async getCostSummary(range: string, userId: string, agentName?: string): Promise<MetricWithTrend> {
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);
    const cutoff = computeCutoff(interval);
    const prevCutoff = computeCutoff(prevInterval);

    const currentQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COALESCE(SUM(at.cost_usd), 0)', 'total')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(currentQb, userId, agentName);
    const currentRow = await currentQb.getRawOne();

    const prevQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COALESCE(SUM(at.cost_usd), 0)', 'total')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(prevQb, userId, agentName);
    const prevRow = await prevQb.getRawOne();

    const current = Number(currentRow?.total ?? 0);
    const previous = Number(prevRow?.total ?? 0);
    return { value: current, trend_pct: computeTrend(current, previous) };
  }

  async getMessageCount(range: string, userId: string, agentName?: string): Promise<MetricWithTrend> {
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);
    const cutoff = computeCutoff(interval);
    const prevCutoff = computeCutoff(prevInterval);

    const currentQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'total')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(currentQb, userId, agentName);
    const currentRow = await currentQb.getRawOne();

    const prevQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'total')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(prevQb, userId, agentName);
    const prevRow = await prevQb.getRawOne();

    const current = Number(currentRow?.total ?? 0);
    const previous = Number(prevRow?.total ?? 0);
    return { value: current, trend_pct: computeTrend(current, previous) };
  }

  async deleteAgent(userId: string, agentName: string): Promise<void> {
    const agent = await this.agentRepo
      .createQueryBuilder('a')
      .leftJoin('a.tenant', 't')
      .where('t.name = :userId', { userId })
      .andWhere('a.name = :agentName', { agentName })
      .getOne();

    if (!agent) {
      throw new NotFoundException(`Agent "${agentName}" not found`);
    }
    await this.agentRepo.delete(agent.id);
  }

  async renameAgent(userId: string, currentName: string, newName: string): Promise<void> {
    const agent = await this.agentRepo
      .createQueryBuilder('a')
      .leftJoin('a.tenant', 't')
      .where('t.name = :userId', { userId })
      .andWhere('a.name = :currentName', { currentName })
      .getOne();

    if (!agent) {
      throw new NotFoundException(`Agent "${currentName}" not found`);
    }

    const duplicate = await this.agentRepo
      .createQueryBuilder('a')
      .leftJoin('a.tenant', 't')
      .where('t.name = :userId', { userId })
      .andWhere('a.name = :newName', { newName })
      .getOne();

    if (duplicate) {
      throw new ConflictException(`Agent "${newName}" already exists`);
    }

    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update('agents')
        .set({ name: newName })
        .where('id = :id', { id: agent.id })
        .execute();

      const tables = ['agent_messages', 'notification_rules', 'notification_logs', 'token_usage_snapshots', 'cost_snapshots'];
      for (const table of tables) {
        await manager
          .createQueryBuilder()
          .update(table)
          .set({ agent_name: newName })
          .where('agent_name = :currentName', { currentName })
          .execute();
      }
    });
  }

  async getMessages(params: {
    range?: string;
    userId: string;
    status?: string;
    service_type?: string;
    model?: string;
    cost_min?: number;
    cost_max?: number;
    limit: number;
    cursor?: string;
    agent_name?: string;
  }) {
    const cutoff = params.range
      ? computeCutoff(rangeToInterval(params.range))
      : undefined;

    const baseQb = this.turnRepo.createQueryBuilder('at');
    if (cutoff) {
      baseQb.where('at.timestamp >= :cutoff', { cutoff });
    }

    addTenantFilter(baseQb, params.userId);

    if (params.status) baseQb.andWhere('at.status = :status', { status: params.status });
    if (params.service_type) baseQb.andWhere('at.service_type = :serviceType', { serviceType: params.service_type });
    if (params.model) baseQb.andWhere('at.model = :model', { model: params.model });
    if (params.cost_min !== undefined) baseQb.andWhere('at.cost_usd >= :costMin', { costMin: params.cost_min });
    if (params.cost_max !== undefined) baseQb.andWhere('at.cost_usd <= :costMax', { costMax: params.cost_max });
    if (params.agent_name) baseQb.andWhere('at.agent_name = :filterAgent', { filterAgent: params.agent_name });

    // Count (without cursor)
    const countQb = baseQb.clone().select('COUNT(*)', 'total');
    const countResult = await countQb.getRawOne();
    const totalCount = Number(countResult?.total ?? 0);

    // Data (with cursor)
    const costExpr = sqlCastFloat('at.cost_usd', this.dialect);
    const dataQb = baseQb.clone()
      .select('at.id', 'id')
      .addSelect('at.timestamp', 'timestamp')
      .addSelect('at.agent_name', 'agent_name')
      .addSelect('at.model', 'model')
      .addSelect('at.description', 'description')
      .addSelect('at.service_type', 'service_type')
      .addSelect('at.input_tokens', 'input_tokens')
      .addSelect('at.output_tokens', 'output_tokens')
      .addSelect('at.status', 'status')
      .addSelect('at.input_tokens + at.output_tokens', 'total_tokens')
      .addSelect(costExpr, 'cost')
      .addSelect('at.routing_tier', 'routing_tier');

    if (params.cursor) {
      const sepIdx = params.cursor.indexOf('|');
      if (sepIdx !== -1) {
        const cursorTs = params.cursor.substring(0, sepIdx);
        const cursorId = params.cursor.substring(sepIdx + 1);
        dataQb.andWhere(
          new Brackets((sub) => {
            sub
              .where('at.timestamp < :cursorTs', { cursorTs })
              .orWhere(
                new Brackets((inner) => {
                  inner
                    .where('at.timestamp = :cursorTs2', { cursorTs2: cursorTs })
                    .andWhere('at.id < :cursorId', { cursorId });
                }),
              );
          }),
        );
      }
    }

    const rows = await dataQb
      .orderBy('at.timestamp', 'DESC')
      .addOrderBy('at.id', 'DESC')
      .limit(params.limit + 1)
      .getRawMany();

    const hasMore = rows.length > params.limit;
    const items = rows.slice(0, params.limit);
    const lastItem = items[items.length - 1] as Record<string, unknown> | undefined;
    const ts = lastItem?.['timestamp'];
    const tsStr = ts instanceof Date ? formatTimestamp(ts) : String(ts ?? '');
    const lastId = lastItem?.['id'];
    const nextCursor = hasMore && lastItem
      ? `${tsStr}|${String(lastId)}` : null;

    // Distinct models
    const modelsQb = this.turnRepo
      .createQueryBuilder('at')
      .select('DISTINCT at.model', 'model')
      .where('at.model IS NOT NULL')
      .andWhere("at.model != ''");
    if (cutoff) {
      modelsQb.andWhere('at.timestamp >= :cutoff', { cutoff });
    }
    addTenantFilter(modelsQb, params.userId);
    const modelsResult = await modelsQb.orderBy('at.model', 'ASC').getRawMany();

    return {
      items,
      next_cursor: nextCursor,
      total_count: totalCount,
      models: modelsResult.map((r: Record<string, unknown>) => String(r['model'])),
    };
  }
}
