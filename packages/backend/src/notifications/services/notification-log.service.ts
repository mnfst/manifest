import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

export function formatNotificationTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
}

@Injectable()
export class NotificationLogService {
  constructor(private readonly ds: DataSource) {}

  private sql(query: string): string {
    return query;
  }

  async hasAlreadySent(ruleId: string, periodStart: string): Promise<boolean> {
    const rows = await this.ds.query(
      this.sql(`SELECT 1 FROM notification_logs WHERE rule_id = $1 AND period_start = $2`),
      [ruleId, periodStart],
    );
    return rows.length > 0;
  }

  async insertLog(params: {
    ruleId: string;
    periodStart: string;
    periodEnd: string;
    actualValue: number;
    thresholdValue: number;
    metricType: string;
    agentName: string;
    sentAt: string;
  }): Promise<void> {
    await this.ds.query(
      this.sql(
        `INSERT INTO notification_logs
         (id, rule_id, period_start, period_end, actual_value, threshold_value, metric_type, agent_name, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      ),
      [
        uuid(),
        params.ruleId,
        params.periodStart,
        params.periodEnd,
        params.actualValue,
        params.thresholdValue,
        params.metricType,
        params.agentName,
        params.sentAt,
      ],
    );
  }

  async getLogsForAgent(userId: string, agentName: string) {
    return this.ds.query(
      this.sql(
        `SELECT nl.id, nl.sent_at, nl.actual_value, nl.threshold_value,
                nl.metric_type, nl.period_start, nl.period_end, nl.agent_name
         FROM notification_logs nl
         JOIN notification_rules nr ON nr.id = nl.rule_id
         WHERE nr.user_id = $1 AND nl.agent_name = $2
         ORDER BY nl.sent_at DESC
         LIMIT 50`,
      ),
      [userId, agentName],
    );
  }

  async resolveUserEmail(
    userId: string,
    notificationEmail?: string | null,
  ): Promise<string | null> {
    if (notificationEmail) return notificationEmail;

    const rows = await this.ds.query(this.sql(`SELECT email FROM "user" WHERE id = $1`), [userId]);
    return rows[0]?.email ?? null;
  }
}
