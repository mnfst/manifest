import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { SpecificityCategory, SPECIFICITY_CATEGORIES } from 'manifest-shared';

/**
 * Aggregates user-flagged miscategorizations (from the Messages log) into a
 * per-category score penalty applied at detection time. A category that
 * routes wrongly more than once starts losing weight; after enough flags it
 * requires an unambiguous anchor on the current turn to fire again.
 *
 * The flip-side writer is SpecificityFeedbackService in analytics — this
 * service is read-only and lives in routing-core to avoid a circular module
 * dependency with AnalyticsModule.
 */
@Injectable()
export class SpecificityPenaltyService {
  private static readonly PENALTY_PER_FLAG = 0.75;
  private static readonly PENALTY_CAP = 3;

  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
  ) {}

  async getPenaltiesForAgent(agentId: string): Promise<Map<SpecificityCategory, number>> {
    const penalties = new Map<SpecificityCategory, number>();
    if (!agentId) return penalties;

    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .select('m.specificity_category', 'category')
      .addSelect('COUNT(*)::int', 'count')
      .where('m.specificity_miscategorized = true')
      .andWhere('m.specificity_category IS NOT NULL')
      .andWhere('m.agent_id = :agentId', { agentId })
      .groupBy('m.specificity_category')
      .getRawMany<{ category: string; count: number }>();

    for (const row of rows) {
      if (!(SPECIFICITY_CATEGORIES as readonly string[]).includes(row.category)) continue;
      const penalty = Math.min(
        row.count * SpecificityPenaltyService.PENALTY_PER_FLAG,
        SpecificityPenaltyService.PENALTY_CAP,
      );
      if (penalty > 0) {
        penalties.set(row.category as SpecificityCategory, penalty);
      }
    }
    return penalties;
  }
}
