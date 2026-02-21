import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { CreateNotificationRuleDto, UpdateNotificationRuleDto } from '../dto/notification-rule.dto';
import { detectDialect, portableSql, type DbDialect } from '../../common/utils/sql-dialect';

@Injectable()
export class NotificationRulesService {
  private readonly dialect: DbDialect;

  constructor(private readonly ds: DataSource) {
    this.dialect = detectDialect(ds.options.type as string);
  }

  private sql(query: string): string {
    return portableSql(query, this.dialect);
  }

  async listRules(userId: string, agentName: string) {
    return this.ds.query(
      this.sql(
        `SELECT nr.*, COALESCE(nl.trigger_count, 0) AS trigger_count
         FROM notification_rules nr
         LEFT JOIN (
           SELECT rule_id, COUNT(*) AS trigger_count FROM notification_logs GROUP BY rule_id
         ) nl ON nl.rule_id = nr.id
         WHERE nr.user_id = $1 AND nr.agent_name = $2
         ORDER BY nr.created_at DESC`,
      ),
      [userId, agentName],
    );
  }

  async createRule(userId: string, dto: CreateNotificationRuleDto) {
    const agent = await this.resolveAgent(userId, dto.agent_name);
    const id = uuid();
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

    await this.ds.query(
      this.sql(
        `INSERT INTO notification_rules
         (id, tenant_id, agent_id, agent_name, user_id, metric_type, threshold, period, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10)`,
      ),
      [id, agent.tenant_id, agent.id, dto.agent_name, userId,
       dto.metric_type, dto.threshold, dto.period, now, now],
    );

    const rows = await this.ds.query(this.sql(`SELECT * FROM notification_rules WHERE id = $1`), [id]);
    return rows[0];
  }

  async updateRule(userId: string, ruleId: string, dto: UpdateNotificationRuleDto) {
    await this.verifyOwnership(userId, ruleId);

    const sets: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (dto.metric_type !== undefined) { sets.push(`metric_type = $${paramIdx++}`); params.push(dto.metric_type); }
    if (dto.threshold !== undefined) { sets.push(`threshold = $${paramIdx++}`); params.push(dto.threshold); }
    if (dto.period !== undefined) { sets.push(`period = $${paramIdx++}`); params.push(dto.period); }
    if (dto.is_active !== undefined) {
      sets.push(`is_active = $${paramIdx++}`);
      params.push(this.dialect === 'sqlite' ? (dto.is_active ? 1 : 0) : dto.is_active);
    }

    if (sets.length === 0) return this.getRule(ruleId);

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
    sets.push(`updated_at = $${paramIdx++}`);
    params.push(now);
    params.push(ruleId);

    await this.ds.query(this.sql(`UPDATE notification_rules SET ${sets.join(', ')} WHERE id = $${paramIdx}`), params);

    const rows = await this.ds.query(this.sql(`SELECT * FROM notification_rules WHERE id = $1`), [ruleId]);
    return rows[0];
  }

  async deleteRule(userId: string, ruleId: string) {
    await this.verifyOwnership(userId, ruleId);
    await this.ds.query(this.sql(`DELETE FROM notification_rules WHERE id = $1`), [ruleId]);
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
      this.sql(
        `SELECT ${expr} as total FROM agent_messages
         WHERE tenant_id = $1 AND agent_name = $2
         AND timestamp >= $3 AND timestamp < $4`,
      ),
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
      this.sql(
        `SELECT a.id, a.tenant_id FROM agents a
         JOIN tenants t ON t.id = a.tenant_id
         WHERE t.name = $1 AND a.name = $2`,
      ),
      [userId, agentName],
    );
    if (!rows.length) {
      throw new BadRequestException(`Agent "${agentName}" not found`);
    }
    return rows[0] as { id: string; tenant_id: string };
  }

  private async verifyOwnership(userId: string, ruleId: string) {
    const rows = await this.ds.query(
      this.sql(`SELECT id FROM notification_rules WHERE id = $1 AND user_id = $2`),
      [ruleId, userId],
    );
    if (!rows.length) {
      throw new NotFoundException('Notification rule not found');
    }
  }

  private async getRule(ruleId: string) {
    const rows = await this.ds.query(this.sql(`SELECT * FROM notification_rules WHERE id = $1`), [ruleId]);
    return rows[0];
  }
}
