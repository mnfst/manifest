import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Like, Repository } from 'typeorm';
import { Agent } from '../../entities/agent.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import { ManifestRequest } from '../../entities/request.entity';

const HEALED_COUNT = 8;
const UNRESOLVED_COUNT = 3;

/** Idempotently populates the current dev tenant's Auto-fix dashboard. */
@Injectable()
export class DevAutofixSeederService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    @InjectRepository(ManifestRequest)
    private readonly requestRepo: Repository<ManifestRequest>,
  ) {}

  async ensureSeeded(tenantId: string): Promise<number> {
    const existing = await this.messageRepo.count({
      where: { tenant_id: tenantId, id: Like('dev-autofix-%') },
    });
    if (existing > 0) return 0;

    const agent = await this.agentRepo.findOne({
      where: { tenant_id: tenantId, deleted_at: IsNull(), is_playground: false },
      order: { created_at: 'ASC' },
    });
    if (!agent) return 0;

    const rows: Array<Partial<AgentMessage>> = [];
    const requests: Array<Partial<ManifestRequest>> = [];
    const now = Date.now();
    for (let index = 0; index < HEALED_COUNT + UNRESOLVED_COUNT; index++) {
      const healed = index < HEALED_COUNT;
      const groupId = `dev-autofix-${tenantId}-${index + 1}`;
      const requestId = `dev-autofix-request-${tenantId}-${index + 1}`;
      const timestamp = now - (index + 1) * 3 * 60 * 60 * 1000;
      const provider = index % 2 === 0 ? 'openai' : 'anthropic';
      const model = provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5-20250929';
      const operations = [{ type: 'rename_param', from: 'max_tokens', to: 'max_output_tokens' }];
      const phoenix = {
        status: 'patched',
        issueId: `dev-issue-${index + 1}`,
        patchId: `dev-patch-${index + 1}`,
        healAttemptId: `dev-heal-${index + 1}`,
      };

      requests.push({
        id: requestId,
        tenant_id: tenantId,
        agent_id: agent.id,
        agent_name: agent.name,
        trace_id: groupId,
        timestamp: new Date(timestamp).toISOString(),
        duration_ms: healed ? 1200 : 420,
        status: healed ? 'ok' : 'error',
        autofix_status: healed ? 'retry_succeeded' : 'retry_failed',
        error_message: healed
          ? null
          : 'Invalid request: max_tokens is not supported for this model',
        error_http_status: healed ? null : 400,
        error_origin: healed ? null : 'provider',
        error_class: healed ? null : 'invalid_request',
        requested_model: model,
      });

      rows.push({
        id: `${groupId}-original`,
        request_id: requestId,
        tenant_id: tenantId,
        agent_id: agent.id,
        agent_name: agent.name,
        trace_id: groupId,
        timestamp: new Date(timestamp).toISOString(),
        duration_ms: 420,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        status: 'auto_fixed',
        error_message: 'Invalid request: max_tokens is not supported for this model',
        error_http_status: 400,
        error_origin: 'provider',
        error_class: 'invalid_request',
        provider,
        model,
        routing_reason: 'scored',
        autofix_applied: true,
        autofix_group_id: groupId,
        autofix_role: 'original',
        autofix_operations: operations,
        autofix_decision: phoenix,
        superseded: healed,
      });

      if (healed) {
        rows.push({
          id: `${groupId}-retry`,
          request_id: requestId,
          tenant_id: tenantId,
          agent_id: agent.id,
          agent_name: agent.name,
          trace_id: groupId,
          timestamp: new Date(timestamp + 650).toISOString(),
          duration_ms: 780,
          input_tokens: 1250 + index * 80,
          output_tokens: 180 + index * 12,
          cost_usd: 0.004 + index * 0.0002,
          status: 'ok',
          provider,
          model,
          routing_reason: 'scored',
          autofix_applied: true,
          autofix_group_id: groupId,
          autofix_role: 'retry',
          autofix_operations: operations,
          autofix_decision: phoenix,
          superseded: false,
        });
      }
    }

    await this.requestRepo.upsert(requests, ['id']);
    await this.messageRepo.insert(rows);
    return rows.length;
  }
}
