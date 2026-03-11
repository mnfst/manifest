import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationEmailService } from './notification-email.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { detectDialect, portableSql, type DbDialect } from '../../common/utils/sql-dialect';
import { computePeriodBoundaries } from '../../common/utils/period.util';
import {
  LOCAL_EMAIL,
  readLocalNotificationEmail,
} from '../../common/constants/local-mode.constants';

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
export class NotificationCronService implements OnModuleInit {
  private readonly logger = new Logger(NotificationCronService.name);
  private readonly dialect: DbDialect;

  constructor(
    private readonly ds: DataSource,
    private readonly rulesService: NotificationRulesService,
    private readonly emailService: NotificationEmailService,
    private readonly emailProviderConfigService: EmailProviderConfigService,
  ) {
    this.dialect = detectDialect(ds.options.type as string);
  }

  async onModuleInit(): Promise<void> {
    try {
      const triggered = await this.checkThresholds();
      if (triggered > 0) {
        this.logger.log(`Startup catch-up: ${triggered} notification(s) triggered`);
      }
    } catch (err) {
      this.logger.error(`Startup catch-up failed: ${err}`);
    }
  }

  private sql(query: string): string {
    return portableSql(query, this.dialect);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkThresholds(): Promise<number> {
    const rules: ActiveRule[] = await this.rulesService.getAllActiveRules();
    if (!rules.length) return 0;

    this.logger.log(`Checking ${rules.length} notification rules...`);

    // Group rules by (tenant_id, agent_name, period) to deduplicate consumption queries
    const groups = new Map<string, { rules: ActiveRule[]; consumption: Map<string, number> }>();
    for (const rule of rules) {
      const key = `${rule.tenant_id}|${rule.agent_name}|${rule.period}`;
      if (!groups.has(key)) groups.set(key, { rules: [], consumption: new Map() });
      groups.get(key)!.rules.push(rule);
    }

    // Fetch consumption once per group+metric combination
    for (const [, group] of groups) {
      const sample = group.rules[0];
      const { periodStart, periodEnd } = computePeriodBoundaries(sample.period);
      const metrics = new Set(group.rules.map((r) => r.metric_type));
      for (const metric of metrics) {
        try {
          const value = await this.rulesService.getConsumption(
            sample.tenant_id,
            sample.agent_name,
            metric,
            periodStart,
            periodEnd,
          );
          group.consumption.set(metric, value);
        } catch (err) {
          this.logger.error(
            `Error fetching consumption for ${sample.agent_name}/${metric}: ${err}`,
          );
        }
      }
    }

    // Evaluate rules against pre-fetched consumption
    let triggered = 0;
    for (const [, group] of groups) {
      for (const rule of group.rules) {
        try {
          const actual = group.consumption.get(rule.metric_type);
          if (actual === undefined) continue;
          const sent = await this.evaluateRule(rule, actual);
          if (sent) triggered++;
        } catch (err) {
          this.logger.error(`Error evaluating rule ${rule.id}: ${err}`);
        }
      }
    }

    if (triggered > 0) {
      this.logger.log(`${triggered} notification(s) triggered`);
    }
    return triggered;
  }

  private async evaluateRule(rule: ActiveRule, actual: number): Promise<boolean> {
    const { periodStart, periodEnd } = computePeriodBoundaries(rule.period);

    const alreadySent = await this.ds.query(
      this.sql(`SELECT 1 FROM notification_logs WHERE rule_id = $1 AND period_start = $2`),
      [rule.id, periodStart],
    );
    if (alreadySent.length > 0) return false;

    if (actual < rule.threshold) return false;

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

    const email = await this.resolveUserEmail(rule.user_id);
    let emailSent = false;
    if (email) {
      const providerConfig = await this.emailProviderConfigService.getFullConfig(rule.user_id);
      const baseUrl =
        process.env['BETTER_AUTH_URL'] ?? `http://localhost:${process.env['PORT'] ?? '3001'}`;
      emailSent = await this.emailService.sendThresholdAlert(
        email,
        {
          agentName: rule.agent_name,
          metricType: rule.metric_type,
          threshold: rule.threshold,
          actualValue: actual,
          period: rule.period,
          timestamp: now,
          agentUrl: `${baseUrl}/agents/${encodeURIComponent(rule.agent_name)}`,
          alertType: 'soft',
        },
        providerConfig ?? undefined,
      );
    } else {
      this.logger.warn(
        `No email found for user ${rule.user_id}, skipping alert for rule ${rule.id}`,
      );
    }

    if (emailSent || !email) {
      await this.ds.query(
        this.sql(
          `INSERT INTO notification_logs
           (id, rule_id, period_start, period_end, actual_value, threshold_value, metric_type, agent_name, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        ),
        [
          uuid(),
          rule.id,
          periodStart,
          periodEnd,
          actual,
          rule.threshold,
          rule.metric_type,
          rule.agent_name,
          now,
        ],
      );
    } else {
      this.logger.warn(`Failed to send alert for rule ${rule.id}, will retry next cron run`);
    }

    return emailSent || !email;
  }

  private async resolveUserEmail(userId: string): Promise<string | null> {
    const fullConfig = await this.emailProviderConfigService.getFullConfig(userId);
    if (fullConfig?.notificationEmail) return fullConfig.notificationEmail;

    if (process.env['MANIFEST_MODE'] === 'local') {
      const configEmail = readLocalNotificationEmail();
      if (configEmail) return configEmail;
    }

    const rows = await this.ds.query(this.sql(`SELECT email FROM "user" WHERE id = $1`), [userId]);
    const email = rows[0]?.email ?? null;
    if (email === LOCAL_EMAIL) return null;
    return email;
  }
}
