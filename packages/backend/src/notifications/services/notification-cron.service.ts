import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationEmailService } from './notification-email.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { NotificationLogService, formatNotificationTimestamp } from './notification-log.service';
import { ManifestRuntimeService } from '../../common/services/manifest-runtime.service';
import { computePeriodBoundaries } from '../../common/utils/period.util';

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

  constructor(
    private readonly rulesService: NotificationRulesService,
    private readonly emailService: NotificationEmailService,
    private readonly emailProviderConfigService: EmailProviderConfigService,
    private readonly runtime: ManifestRuntimeService,
    private readonly notificationLog: NotificationLogService,
  ) {}

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

  @Cron(CronExpression.EVERY_HOUR)
  async checkThresholds(userId?: string): Promise<number> {
    const rules: ActiveRule[] = userId
      ? await this.rulesService.getActiveRulesForUser(userId)
      : await this.rulesService.getAllActiveRules();
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

    if (await this.notificationLog.hasAlreadySent(rule.id, periodStart)) return false;
    if (actual < rule.threshold) return false;

    const now = formatNotificationTimestamp();
    const fullConfig = await this.emailProviderConfigService.getFullConfig(rule.user_id);
    const email = await this.notificationLog.resolveUserEmail(
      rule.user_id,
      fullConfig?.notificationEmail,
    );
    let emailSent = false;
    if (email) {
      emailSent = await this.emailService.sendThresholdAlert(
        email,
        {
          agentName: rule.agent_name,
          metricType: rule.metric_type,
          threshold: rule.threshold,
          actualValue: actual,
          period: rule.period,
          timestamp: now,
          agentUrl: `${this.runtime.getAuthBaseUrl()}/agents/${encodeURIComponent(rule.agent_name)}`,
          alertType: 'soft',
        },
        fullConfig ?? undefined,
      );
    } else {
      this.logger.warn(
        `No email found for user ${rule.user_id}, skipping alert for rule ${rule.id}`,
      );
    }

    if (emailSent || !email) {
      await this.notificationLog.insertLog({
        ruleId: rule.id,
        periodStart,
        periodEnd,
        actualValue: actual,
        thresholdValue: rule.threshold,
        metricType: rule.metric_type,
        agentName: rule.agent_name,
        sentAt: now,
      });
    } else {
      this.logger.warn(`Failed to send alert for rule ${rule.id}, will retry next cron run`);
    }

    return emailSent || !email;
  }
}
