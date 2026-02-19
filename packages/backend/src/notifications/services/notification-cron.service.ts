import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationEmailService } from './notification-email.service';

interface ActiveRule {
  id: string;
  tenant_id: string;
  agent_name: string;
  user_id: string;
  metric_type: 'tokens' | 'cost';
  threshold: number;
  period: 'hour' | 'day' | 'week' | 'month';
}

@Injectable()
export class NotificationCronService {
  private readonly logger = new Logger(NotificationCronService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly rulesService: NotificationRulesService,
    private readonly emailService: NotificationEmailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkThresholds(): Promise<number> {
    const rules: ActiveRule[] = await this.rulesService.getAllActiveRules();
    if (!rules.length) return 0;

    this.logger.log(`Checking ${rules.length} notification rules...`);
    let triggered = 0;

    for (const rule of rules) {
      try {
        const sent = await this.evaluateRule(rule);
        if (sent) triggered++;
      } catch (err) {
        this.logger.error(`Error evaluating rule ${rule.id}: ${err}`);
      }
    }

    if (triggered > 0) {
      this.logger.log(`${triggered} notification(s) triggered`);
    }
    return triggered;
  }

  private async evaluateRule(rule: ActiveRule): Promise<boolean> {
    const { periodStart, periodEnd } = this.computePeriodBoundaries(rule.period);

    const alreadySent = await this.ds.query(
      `SELECT 1 FROM notification_logs WHERE rule_id = $1 AND period_start = $2`,
      [rule.id, periodStart],
    );
    if (alreadySent.length > 0) return false;

    const actual = await this.rulesService.getConsumption(
      rule.tenant_id, rule.agent_name, rule.metric_type, periodStart, periodEnd,
    );

    if (actual < rule.threshold) return false;

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

    await this.ds.query(
      `INSERT INTO notification_logs
       (id, rule_id, period_start, period_end, actual_value, threshold_value, metric_type, agent_name, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [uuid(), rule.id, periodStart, periodEnd, actual, rule.threshold,
       rule.metric_type, rule.agent_name, now],
    );

    const email = await this.resolveUserEmail(rule.user_id);
    if (email) {
      await this.emailService.sendThresholdAlert(email, {
        agentName: rule.agent_name,
        metricType: rule.metric_type,
        threshold: rule.threshold,
        actualValue: actual,
        period: rule.period,
        timestamp: now,
      });
    }

    return true;
  }

  private computePeriodBoundaries(period: string): { periodStart: string; periodEnd: string } {
    const now = new Date();
    let start: Date;

    switch (period) {
      case 'hour':
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
        break;
      case 'day':
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        break;
      case 'week': {
        const dayOfWeek = now.getUTCDay();
        const monday = now.getUTCDate() - ((dayOfWeek + 6) % 7);
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), monday));
        break;
      }
      case 'month':
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        break;
      default:
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
    }

    const end = new Date(now.getTime());
    const fmt = (d: Date) => d.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

    return { periodStart: fmt(start), periodEnd: fmt(end) };
  }

  private async resolveUserEmail(userId: string): Promise<string | null> {
    const rows = await this.ds.query(
      `SELECT email FROM "user" WHERE id = $1`,
      [userId],
    );
    return rows[0]?.email ?? null;
  }
}
