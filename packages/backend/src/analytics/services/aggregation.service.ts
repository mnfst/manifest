import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { rangeToInterval, rangeToPreviousInterval } from '../../common/utils/range.util';
import { MetricWithTrend, computeTrend, addTenantFilter } from './query-helpers';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import {
  DbDialect,
  detectDialect,
  computeCutoff,
  sqlSanitizeCost,
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
    private readonly tenantCache: TenantCacheService,
  ) {
    this.dialect = detectDialect(this.dataSource.options.type as string);
  }

  async hasAnyData(userId: string, agentName?: string): Promise<boolean> {
    const tenantId = await this.tenantCache.resolve(userId);
    const qb = this.turnRepo.createQueryBuilder('at').select('1').limit(1);
    addTenantFilter(qb, userId, agentName, tenantId ?? undefined);
    const row = await qb.getRawOne();
    return row != null;
  }

  async getTokenSummary(range: string, userId: string, agentName?: string) {
    const tenantId = (await this.tenantCache.resolve(userId)) ?? undefined;
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);
    const cutoff = computeCutoff(interval);
    const prevCutoff = computeCutoff(prevInterval);

    // 3A: Merge current total + breakdown into one query (total = input + output)
    const detailQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COALESCE(SUM(at.input_tokens), 0)', 'inp')
      .addSelect('COALESCE(SUM(at.output_tokens), 0)', 'out')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(detailQb, userId, agentName, tenantId);

    const prevQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COALESCE(SUM(at.input_tokens + at.output_tokens), 0)', 'total')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(prevQb, userId, agentName, tenantId);

    const [detail, prevRow] = await Promise.all([detailQb.getRawOne(), prevQb.getRawOne()]);

    const inputTotal = Number(detail?.inp ?? 0);
    const outputTotal = Number(detail?.out ?? 0);
    const current = inputTotal + outputTotal;
    const previous = Number(prevRow?.total ?? 0);

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

  async getCostSummary(
    range: string,
    userId: string,
    agentName?: string,
  ): Promise<MetricWithTrend> {
    const tenantId = (await this.tenantCache.resolve(userId)) ?? undefined;
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);
    const cutoff = computeCutoff(interval);
    const prevCutoff = computeCutoff(prevInterval);

    // 3B: Parallelize current + previous period queries
    const safeCost = sqlSanitizeCost('at.cost_usd');
    const currentQb = this.turnRepo
      .createQueryBuilder('at')
      .select(`COALESCE(SUM(${safeCost}), 0)`, 'total')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(currentQb, userId, agentName, tenantId);

    const prevQb = this.turnRepo
      .createQueryBuilder('at')
      .select(`COALESCE(SUM(${safeCost}), 0)`, 'total')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(prevQb, userId, agentName, tenantId);

    const [currentRow, prevRow] = await Promise.all([currentQb.getRawOne(), prevQb.getRawOne()]);

    const current = Number(currentRow?.total ?? 0);
    const previous = Number(prevRow?.total ?? 0);
    return { value: current, trend_pct: computeTrend(current, previous) };
  }

  async getMessageCount(
    range: string,
    userId: string,
    agentName?: string,
  ): Promise<MetricWithTrend> {
    const tenantId = (await this.tenantCache.resolve(userId)) ?? undefined;
    const interval = rangeToInterval(range);
    const prevInterval = rangeToPreviousInterval(range);
    const cutoff = computeCutoff(interval);
    const prevCutoff = computeCutoff(prevInterval);

    // 3C: Parallelize current + previous period queries
    const currentQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'total')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(currentQb, userId, agentName, tenantId);

    const prevQb = this.turnRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'total')
      .where('at.timestamp >= :prevCutoff', { prevCutoff })
      .andWhere('at.timestamp < :cutoff', { cutoff });
    addTenantFilter(prevQb, userId, agentName, tenantId);

    const [currentRow, prevRow] = await Promise.all([currentQb.getRawOne(), prevQb.getRawOne()]);

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

  async renameAgent(
    userId: string,
    currentName: string,
    newName: string,
    displayName?: string,
  ): Promise<void> {
    const agent = await this.agentRepo
      .createQueryBuilder('a')
      .leftJoin('a.tenant', 't')
      .where('t.name = :userId', { userId })
      .andWhere('a.name = :currentName', { currentName })
      .getOne();

    if (!agent) {
      throw new NotFoundException(`Agent "${currentName}" not found`);
    }

    // If only display_name changes (same slug), short-circuit
    if (newName === currentName) {
      if (displayName !== undefined) {
        await this.agentRepo
          .createQueryBuilder()
          .update('agents')
          .set({ display_name: displayName })
          .where('id = :id', { id: agent.id })
          .execute();
      }
      return;
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
      const agentUpdate: Record<string, unknown> = { name: newName };
      if (displayName !== undefined) agentUpdate['display_name'] = displayName;

      await manager
        .createQueryBuilder()
        .update('agents')
        .set(agentUpdate)
        .where('id = :id', { id: agent.id })
        .execute();

      const tables = [
        'agent_messages',
        'notification_rules',
        'notification_logs',
        'token_usage_snapshots',
        'cost_snapshots',
      ];
      await Promise.all(
        tables.map((table) =>
          manager
            .createQueryBuilder()
            .update(table)
            .set({ agent_name: newName })
            .where('agent_name = :currentName', { currentName })
            .execute(),
        ),
      );
    });
  }
}
