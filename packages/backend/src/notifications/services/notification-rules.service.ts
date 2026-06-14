import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { NotificationRule } from '../../entities/notification-rule.entity';
import { NotificationLog } from '../../entities/notification-log.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { CreateNotificationRuleDto, UpdateNotificationRuleDto } from '../dto/notification-rule.dto';
import { toSqlTimestamp } from '../../common/utils/postgres-sql';

export interface NotificationRuleWithTriggerCount extends NotificationRule {
  trigger_count: number;
}

const NOTIFY_ACTIONS = ['notify', 'both'] as const;
const BLOCK_ACTIONS = ['block', 'both'] as const;

@Injectable()
export class NotificationRulesService {
  constructor(
    @InjectRepository(NotificationRule)
    private readonly ruleRepo: Repository<NotificationRule>,
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
  ) {}

  async listRules(
    tenantId: string | null,
    agentName: string,
  ): Promise<NotificationRuleWithTriggerCount[]> {
    if (!tenantId) return [];
    const rules = await this.ruleRepo.find({
      where: { tenant_id: tenantId, agent_name: agentName },
      order: { created_at: 'DESC' },
    });
    if (rules.length === 0) return [];

    const ruleIds = rules.map((r) => r.id);
    const counts = await this.logRepo
      .createQueryBuilder('nl')
      .select('nl.rule_id', 'rule_id')
      .addSelect('COUNT(*)', 'trigger_count')
      .where('nl.rule_id IN (:...ids)', { ids: ruleIds })
      .groupBy('nl.rule_id')
      .getRawMany<{ rule_id: string; trigger_count: string | number }>();

    const countMap = new Map<string, number>();
    for (const row of counts) countMap.set(row.rule_id, Number(row.trigger_count));

    return rules.map((rule) => ({ ...rule, trigger_count: countMap.get(rule.id) ?? 0 }));
  }

  async createRule(
    tenantId: string | null,
    dto: CreateNotificationRuleDto,
  ): Promise<NotificationRule> {
    const agent = await this.resolveAgent(tenantId, dto.agent_name);
    const id = uuid();
    const now = toSqlTimestamp();

    const rule: Partial<NotificationRule> = {
      id,
      tenant_id: agent.tenant_id,
      agent_id: agent.id,
      agent_name: dto.agent_name,
      metric_type: dto.metric_type,
      threshold: dto.threshold,
      period: dto.period,
      action: dto.action ?? 'notify',
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    await this.ruleRepo.insert(rule);
    return (await this.ruleRepo.findOneBy({ id }))!;
  }

  async updateRule(
    tenantId: string | null,
    ruleId: string,
    dto: UpdateNotificationRuleDto,
  ): Promise<NotificationRule | undefined> {
    await this.verifyOwnership(tenantId, ruleId);

    const patch: Partial<NotificationRule> = {};
    if (dto.metric_type !== undefined) patch.metric_type = dto.metric_type;
    if (dto.threshold !== undefined) patch.threshold = dto.threshold;
    if (dto.period !== undefined) patch.period = dto.period;
    if (dto.action !== undefined) patch.action = dto.action;
    if (dto.is_active !== undefined) patch.is_active = dto.is_active;

    if (Object.keys(patch).length === 0) {
      return this.getRule(ruleId);
    }

    patch.updated_at = toSqlTimestamp();
    await this.ruleRepo.update({ id: ruleId }, patch);
    return this.getRule(ruleId);
  }

  async deleteRule(tenantId: string | null, ruleId: string): Promise<void> {
    await this.verifyOwnership(tenantId, ruleId);
    await this.ruleRepo.delete({ id: ruleId });
  }

  async getConsumption(
    tenantId: string,
    agentName: string,
    metric: 'tokens' | 'cost',
    periodStart: string,
    periodEnd: string,
  ): Promise<number> {
    const expr =
      metric === 'tokens'
        ? 'COALESCE(SUM(at.input_tokens + at.output_tokens), 0)'
        : 'COALESCE(SUM(at.cost_usd), 0)';

    const row = await this.messageRepo
      .createQueryBuilder('at')
      .select(expr, 'total')
      .where('at.tenant_id = :tenantId', { tenantId })
      .andWhere(
        `(
          at.agent_id = (
            SELECT id FROM agents
            WHERE tenant_id = at.tenant_id
              AND name = :agentName
              AND deleted_at IS NULL
            LIMIT 1
          )
          OR (
            at.agent_id IS NULL
            AND at.agent_name = :agentName
          )
        )`,
        { agentName },
      )
      .andWhere('at.timestamp >= :periodStart', { periodStart })
      .andWhere('at.timestamp < :periodEnd', { periodEnd })
      .getRawOne<{ total: string | number | null }>();

    return Number(row?.total ?? 0);
  }

  getAllActiveRules(): Promise<NotificationRule[]> {
    return this.ruleRepo.find({
      where: { is_active: true, action: In([...NOTIFY_ACTIONS]) },
    });
  }

  getActiveRulesForTenant(tenantId: string): Promise<NotificationRule[]> {
    return this.ruleRepo.find({
      where: { tenant_id: tenantId, is_active: true, action: In([...NOTIFY_ACTIONS]) },
    });
  }

  getActiveBlockRules(tenantId: string, agentName: string): Promise<NotificationRule[]> {
    return this.ruleRepo.find({
      where: {
        tenant_id: tenantId,
        agent_name: agentName,
        is_active: true,
        action: In([...BLOCK_ACTIONS]),
      },
    });
  }

  getRule(ruleId: string): Promise<NotificationRule | undefined> {
    return this.ruleRepo.findOneBy({ id: ruleId }).then((r) => r ?? undefined);
  }

  async getOwnedRule(
    tenantId: string | null,
    ruleId: string,
  ): Promise<NotificationRule | undefined> {
    if (!tenantId) return undefined;
    const rule = await this.ruleRepo.findOneBy({ id: ruleId, tenant_id: tenantId });
    return rule ?? undefined;
  }

  private async resolveAgent(
    tenantId: string | null,
    agentName: string,
  ): Promise<{ id: string; tenant_id: string }> {
    if (!tenantId) throw new NotFoundException('Tenant not found');
    const agent = await this.agentRepo
      .createQueryBuilder('a')
      .select(['a.id', 'a.tenant_id'])
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.name = :agentName', { agentName })
      .andWhere('a.deleted_at IS NULL')
      .getOne();
    if (!agent) throw new BadRequestException(`Agent "${agentName}" not found`);
    return { id: agent.id, tenant_id: agent.tenant_id };
  }

  private async verifyOwnership(tenantId: string | null, ruleId: string): Promise<void> {
    if (!tenantId) throw new NotFoundException('Notification rule not found');
    const count = await this.ruleRepo.count({ where: { id: ruleId, tenant_id: tenantId } });
    if (count === 0) throw new NotFoundException('Notification rule not found');
  }
}
