import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityEvent } from '../entities/security-event.entity';
import { rangeToInterval } from '../common/utils/range.util';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    @InjectRepository(SecurityEvent)
    private readonly securityRepo: Repository<SecurityEvent>,
  ) {}

  async getSecurityOverview(range: string, userId: string) {
    const interval = rangeToInterval(range);

    const countRows = await this.securityRepo
      .createQueryBuilder('se')
      .select('se.severity', 'severity')
      .addSelect('COUNT(*)', 'cnt')
      .where('se.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
      .andWhere('se.user_id = :userId', { userId })
      .groupBy('se.severity')
      .getRawMany();

    let criticalCount = 0;
    let warningCount = 0;
    for (const row of countRows) {
      if (row.severity === 'critical') criticalCount = Number(row.cnt);
      if (row.severity === 'warning') warningCount = Number(row.cnt);
    }

    const events = await this.securityRepo
      .createQueryBuilder('se')
      .select(['se.id', 'se.timestamp', 'se.severity', 'se.category', 'se.description'])
      .where('se.timestamp >= NOW() - CAST(:interval AS interval)', { interval })
      .andWhere('se.user_id = :userId', { userId })
      .orderBy('se.timestamp', 'DESC')
      .limit(50)
      .getMany();

    const score = this.computeRiskScore(criticalCount, warningCount);

    return {
      score,
      critical_events_count: criticalCount,
      sandbox_mode: 'enabled',
      events,
    };
  }

  private static readonly CRITICAL_PENALTY = 15;
  private static readonly WARNING_PENALTY = 5;
  private static readonly THRESHOLD_LOW = 80;
  private static readonly THRESHOLD_MODERATE = 60;
  private static readonly THRESHOLD_HIGH = 30;

  private computeRiskScore(criticalCount: number, warningCount: number) {
    const value = Math.max(
      0,
      100 - criticalCount * SecurityService.CRITICAL_PENALTY - warningCount * SecurityService.WARNING_PENALTY,
    );

    let riskLevel: string;
    if (value >= SecurityService.THRESHOLD_LOW) riskLevel = 'low';
    else if (value >= SecurityService.THRESHOLD_MODERATE) riskLevel = 'moderate';
    else if (value >= SecurityService.THRESHOLD_HIGH) riskLevel = 'high';
    else riskLevel = 'critical';

    return { value, risk_level: riskLevel };
  }
}
