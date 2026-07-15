import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  rangeToInterval,
  rangeToPreviousInterval,
  isHourlyRange,
} from '../../common/utils/range.util';
import { computeCutoff, sqlDateBucket, sqlHourBucket } from '../../common/utils/postgres-sql';
import { AgentMessage } from '../../entities/agent-message.entity';
import { addTenantFilter, excludePlaygroundAgents } from './query-helpers';

export interface AttemptMetric {
  value: number;
  previous: number;
}

export interface AttemptStatsResponse {
  /** All rows in `provider_attempts`. */
  total_attempts: AttemptMetric;
  /** Fallback destinations: attempts whose `fallback_from_model` is non-null. */
  fallbacked_attempts: AttemptMetric;
}

export const ATTEMPT_METRIC_KEYS = ['total_attempts', 'fallbacked_attempts'] as const;

export interface AttemptTimeseriesResponse {
  range: string;
  by: 'metric';
  keys: string[];
  buckets: Array<{ bucket: string; counts: number[] }>;
}

interface AttemptCounts {
  attempts: number;
  fallbacked_attempts: number;
}

/**
 * Universal attempt aggregates. Request totals remain on
 * `overview.request_reliability`; Auto-fix totals remain on the adjacent
 * Auto-fix/error aggregates. When those surfaces are composed, the canonical
 * Auto-fixed attempt is the successful `autofix_role='retry'` row. No cohort
 * or eligibility predicate belongs in this service.
 */
@Injectable()
export class AttemptStatsService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly attemptRepo: Repository<AgentMessage>,
  ) {}

  async getStats(params: {
    tenantId: string | null;
    range?: string;
    agentName?: string;
  }): Promise<AttemptStatsResponse> {
    const range = params.range ?? '7d';
    const cutoff = computeCutoff(rangeToInterval(range));
    const previousCutoff = computeCutoff(rangeToPreviousInterval(range));
    const [current, previous] = await Promise.all([
      this.queryWindow(cutoff, undefined, params.tenantId, params.agentName),
      this.queryWindow(previousCutoff, cutoff, params.tenantId, params.agentName),
    ]);

    return {
      total_attempts: { value: current.attempts, previous: previous.attempts },
      fallbacked_attempts: {
        value: current.fallbacked_attempts,
        previous: previous.fallbacked_attempts,
      },
    };
  }

  async getTimeseries(params: {
    tenantId: string | null;
    range?: string;
    agentName?: string;
  }): Promise<AttemptTimeseriesResponse> {
    const range = params.range ?? '7d';
    const cutoff = computeCutoff(rangeToInterval(range));
    const bucketExpression = isHourlyRange(range)
      ? sqlHourBucket('at.timestamp')
      : sqlDateBucket('at.timestamp');
    const qb = this.attemptRepo
      .createQueryBuilder('at')
      .select(bucketExpression, 'bucket')
      .addSelect('COUNT(*)', 'attempts')
      .addSelect(
        'COUNT(*) FILTER (WHERE at.fallback_from_model IS NOT NULL)',
        'fallbacked_attempts',
      )
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(qb, params.tenantId, params.agentName);
    excludePlaygroundAgents(qb);

    const rows = (await qb.groupBy('bucket').orderBy('bucket', 'ASC').getRawMany()) as Array<
      Record<string, unknown>
    >;
    return {
      range,
      by: 'metric',
      keys: [...ATTEMPT_METRIC_KEYS],
      buckets: rows.map((row) => ({
        bucket: String(row['bucket']),
        counts: [Number(row['attempts'] ?? 0), Number(row['fallbacked_attempts'] ?? 0)],
      })),
    };
  }

  private async queryWindow(
    from: string,
    to: string | undefined,
    tenantId: string | null,
    agentName?: string,
  ): Promise<AttemptCounts> {
    const qb = this.attemptRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'attempts')
      .addSelect(
        'COUNT(*) FILTER (WHERE at.fallback_from_model IS NOT NULL)',
        'fallbacked_attempts',
      )
      .where('at.timestamp >= :from', { from });
    if (to) qb.andWhere('at.timestamp < :to', { to });
    addTenantFilter(qb, tenantId, agentName);
    excludePlaygroundAgents(qb);
    const row = await qb.getRawOne<Record<string, unknown>>();
    return {
      attempts: Number(row?.['attempts'] ?? 0),
      fallbacked_attempts: Number(row?.['fallbacked_attempts'] ?? 0),
    };
  }
}
