import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_ORIGINS, MANIFEST_ERROR_ORIGINS } from 'manifest-shared';
import { AgentMessage } from '../../entities/agent-message.entity';
import { rangeToInterval } from '../../common/utils/range.util';
import { computeCutoff } from '../../common/utils/postgres-sql';
import { addTenantFilter, excludePlaygroundAgents } from './query-helpers';

export interface ErrorBreakdownResponse {
  range: string;
  /** Real (successful) messages in the window — the provider-error-rate denominator. */
  successful: number;
  /** All classified error rows (every origin). */
  total_errors: number;
  /** Errors a provider actually threw (the reliability signal). */
  provider_errors: number;
  /** Network/timeout failures reaching a provider. */
  transport_errors: number;
  /** Manifest's OWN config/policy/internal rejections — NOT a provider failure. */
  manifest_errors: number;
  /**
   * Requests healed by Auto-fix in the window — one per healed request, counted
   * from the failed-original row (`status='auto_fixed'`). NOT additive with
   * `total_errors`: the healed original is a superseded attempt that is already
   * included in `total_errors`/`by_origin`, so treat this as "of those errors,
   * this many were auto-fixed", never as a separate error bucket to sum.
   */
  auto_fixed: number;
  by_origin: Record<string, number>;
  by_class: Record<string, number>;
  /** provider_errors / (provider_errors + successful), 0..1. */
  provider_error_rate: number;
}

interface ErrorGroupRow {
  origin: string;
  error_class: string | null;
  count: number;
}

@Injectable()
export class ErrorBreakdownService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
  ) {}

  async getBreakdown(params: {
    tenantId: string | null;
    range?: string;
    agentName?: string;
  }): Promise<ErrorBreakdownResponse> {
    const range = params.range ?? '30d';
    const cutoff = computeCutoff(rangeToInterval(range));

    const [groups, successful, autoFixed] = await Promise.all([
      this.queryErrorGroups(cutoff, params.tenantId, params.agentName),
      this.querySuccessful(cutoff, params.tenantId, params.agentName),
      this.queryAutoFixed(cutoff, params.tenantId, params.agentName),
    ]);

    return this.assemble(range, groups, successful, autoFixed);
  }

  private async queryErrorGroups(
    cutoff: string,
    tenantId: string | null,
    agentName?: string,
  ): Promise<ErrorGroupRow[]> {
    const qb = this.messageRepo
      .createQueryBuilder('at')
      .select('at.error_origin', 'origin')
      .addSelect('at.error_class', 'error_class')
      .addSelect('COUNT(*)', 'count')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.error_origin IS NOT NULL')
      .groupBy('at.error_origin')
      .addGroupBy('at.error_class');
    addTenantFilter(qb, tenantId, agentName);
    excludePlaygroundAgents(qb);
    const rows = await qb.getRawMany<{
      origin: string;
      error_class: string | null;
      count: string;
    }>();
    return rows.map((r) => ({
      origin: String(r.origin),
      error_class: r.error_class ?? null,
      count: Number(r.count),
    }));
  }

  private async querySuccessful(
    cutoff: string,
    tenantId: string | null,
    agentName?: string,
  ): Promise<number> {
    const qb = this.messageRepo
      .createQueryBuilder('at')
      .select("COUNT(*) FILTER (WHERE at.status = 'ok')", 'count')
      .where('at.timestamp >= :cutoff', { cutoff });
    addTenantFilter(qb, tenantId, agentName);
    excludePlaygroundAgents(qb);
    const row = await qb.getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  /**
   * Count of requests healed by Auto-fix. The failed original of a healed pair
   * carries `status='auto_fixed'` (its successful retry is a separate `ok` row),
   * so one `auto_fixed` row == one healed request — no double-counting.
   */
  private async queryAutoFixed(
    cutoff: string,
    tenantId: string | null,
    agentName?: string,
  ): Promise<number> {
    const qb = this.messageRepo
      .createQueryBuilder('at')
      .select('COUNT(*)', 'count')
      .where('at.timestamp >= :cutoff', { cutoff })
      .andWhere('at.status = :autoFixedStatus', { autoFixedStatus: 'auto_fixed' });
    addTenantFilter(qb, tenantId, agentName);
    excludePlaygroundAgents(qb);
    const row = await qb.getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  private assemble(
    range: string,
    groups: ErrorGroupRow[],
    successful: number,
    autoFixed: number,
  ): ErrorBreakdownResponse {
    const by_origin: Record<string, number> = Object.fromEntries(ERROR_ORIGINS.map((o) => [o, 0]));
    const by_class: Record<string, number> = {};
    let total = 0;
    for (const g of groups) {
      by_origin[g.origin] = (by_origin[g.origin] ?? 0) + g.count;
      if (g.error_class) by_class[g.error_class] = (by_class[g.error_class] ?? 0) + g.count;
      total += g.count;
    }
    const provider = by_origin['provider'] ?? 0;
    const manifest = MANIFEST_ERROR_ORIGINS.reduce((sum, o) => sum + (by_origin[o] ?? 0), 0);
    const denom = provider + successful;
    return {
      range,
      successful,
      total_errors: total,
      provider_errors: provider,
      transport_errors: by_origin['transport'] ?? 0,
      manifest_errors: manifest,
      auto_fixed: autoFixed,
      by_origin,
      by_class,
      provider_error_rate: denom > 0 ? provider / denom : 0,
    };
  }
}
