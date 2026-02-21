import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { CreateNotificationRuleDto, UpdateNotificationRuleDto } from '../dto/notification-rule.dto';

@Injectable()
export class NotificationRulesService {
  constructor(private readonly ds: DataSource) {}

  async listRules(userId: string, agentName: string) {
    return this.ds.query(
      `SELECT nr.*, COALESCE(nl.trigger_count, 0) AS trigger_count
       FROM notification_rules nr
       LEFT JOIN (
         SELECT rule_id, COUNT(*) AS trigger_count FROM notification_logs GROUP BY rule_id
       ) nl ON nl.rule_id = nr.id
       WHERE nr.user_id = $1 AND nr.agent_name = $2
       ORDER BY nr.created_at DESC`,
      [userId, agentName],
    );
  }

  async createRule(userId: string, dto: CreateNotificationRuleDto) {
    const agent = await this.resolveAgent(userId, dto.agent_name);
    const id = uuid();
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

    await this.ds.query(
      `INSERT INTO notification_rules
       (id, tenant_id, agent_id, agent_name, user_id, metric_type, threshold, period, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10)`,
      [id, agent.tenant_id, agent.id, dto.agent_name, userId,
       dto.metric_type, dto.threshold, dto.period, now, now],
    );

    const rows = await this.ds.query(`SELECT * FROM notification_rules WHERE id = $1`, [id]);
    return rows[0];
  }

  async updateRule(userId: string, ruleId: string, dto: UpdateNotificationRuleDto) {
    await this.verifyOwnership(userId, ruleId);

    const update: Record<string, unknown> = {};
    if (dto.metric_type !== undefined) update.metric_type = dto.metric_type;
    if (dto.threshold !== undefined) update.threshold = dto.threshold;
    if (dto.period !== undefined) update.period = dto.period;
    if (dto.is_active !== undefined) update.is_active = dto.is_active;

    if (Object.keys(update).length === 0) return this.getRule(ruleId);

    update.updated_at = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

    await this.ds
      .createQueryBuilder()
      .update('notification_rules')
      .set(update)
      .where('id = :id', { id: ruleId })
      .execute();

    const rows = await this.ds.query(`SELECT * FROM notification_rules WHERE id = $1`, [ruleId]);
    return rows[0];
  }

  async deleteRule(userId: string, ruleId: string) {
    await this.verifyOwnership(userId, ruleId);
    await this.ds.query(`DELETE FROM notification_rules WHERE id = $1`, [ruleId]);
  }

  async getConsumption(
    tenantId: string,
    agentName: string,
    metric: 'tokens' | 'cost',
    periodStart: string,
    periodEnd: string,
  ): Promise<number> {
    const expr = metric === 'tokens'
      ? 'COALESCE(SUM(input_tokens + output_tokens), 0)'
      : 'COALESCE(SUM(cost_usd), 0)';

    const rows = await this.ds.query(
      `SELECT ${expr} as total FROM agent_messages
       WHERE tenant_id = $1 AND agent_name = $2
       AND timestamp >= $3 AND timestamp < $4`,
      [tenantId, agentName, periodStart, periodEnd],
    );

    return Number(rows[0]?.total ?? 0);
  }

  async getAllActiveRules() {
    return this.ds.query(
      `SELECT * FROM notification_rules WHERE is_active = true`,
    );
  }

  private async resolveAgent(userId: string, agentName: string) {
    const rows = await this.ds.query(
      `SELECT a.id, a.tenant_id FROM agents a
       JOIN tenants t ON t.id = a.tenant_id
       WHERE t.name = $1 AND a.name = $2`,
      [userId, agentName],
    );
    if (!rows.length) {
      throw new BadRequestException(`Agent "${agentName}" not found`);
    }
    return rows[0] as { id: string; tenant_id: string };
  }

  private async verifyOwnership(userId: string, ruleId: string) {
    const rows = await this.ds.query(
      `SELECT id FROM notification_rules WHERE id = $1 AND user_id = $2`,
      [ruleId, userId],
    );
    if (!rows.length) {
      throw new NotFoundException('Notification rule not found');
    }
  }

  private async getRule(ruleId: string) {
    const rows = await this.ds.query(`SELECT * FROM notification_rules WHERE id = $1`, [ruleId]);
    return rows[0];
  }
}
