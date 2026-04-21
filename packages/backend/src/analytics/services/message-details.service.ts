import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { LlmCall } from '../../entities/llm-call.entity';
import { ToolExecution } from '../../entities/tool-execution.entity';
import { AgentLog } from '../../entities/agent-log.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

export interface MessageDetailResponse {
  message: {
    id: string;
    timestamp: string;
    agent_name: string | null;
    model: string | null;
    status: string;
    error_message: string | null;
    error_http_status: number | null;
    description: string | null;
    service_type: string | null;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    cost_usd: number | null;
    duration_ms: number | null;
    trace_id: string | null;
    routing_tier: string | null;
    routing_reason: string | null;
    specificity_category: string | null;
    specificity_miscategorized: boolean;
    auth_type: string | null;
    skill_name: string | null;
    fallback_from_model: string | null;
    fallback_index: number | null;
    session_key: string | null;
    feedback_rating: string | null;
    feedback_tags: string[] | null;
    feedback_details: string | null;
  };
  llm_calls: {
    id: string;
    call_index: number | null;
    request_model: string | null;
    response_model: string | null;
    gen_ai_system: string | null;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    duration_ms: number | null;
    ttft_ms: number | null;
    temperature: number | null;
    max_output_tokens: number | null;
    timestamp: string;
  }[];
  tool_executions: {
    id: string;
    llm_call_id: string | null;
    tool_name: string;
    duration_ms: number | null;
    status: string;
    error_message: string | null;
  }[];
  agent_logs: {
    id: string;
    severity: string;
    body: string | null;
    timestamp: string;
    span_id: string | null;
  }[];
}

@Injectable()
export class MessageDetailsService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    @InjectRepository(LlmCall)
    private readonly llmCallRepo: Repository<LlmCall>,
    @InjectRepository(ToolExecution)
    private readonly toolRepo: Repository<ToolExecution>,
    @InjectRepository(AgentLog)
    private readonly logRepo: Repository<AgentLog>,
    private readonly tenantCache: TenantCacheService,
  ) {}

  async getDetails(messageId: string, userId: string): Promise<MessageDetailResponse> {
    const tenantId = await this.tenantCache.resolve(userId);

    const messageQb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.id = :id', { id: messageId });
    if (tenantId) {
      messageQb.andWhere('m.tenant_id = :tenantId', { tenantId });
    } else {
      messageQb.andWhere('m.user_id = :userId', { userId });
    }
    const message = await messageQb.getOne();
    if (!message) throw new NotFoundException('Message not found');

    const llmCallsQb = this.llmCallRepo
      .createQueryBuilder('lc')
      .where('lc.turn_id = :turnId', { turnId: messageId })
      .orderBy('lc.call_index', 'ASC')
      .addOrderBy('lc.timestamp', 'ASC');

    const logsQb = message.trace_id
      ? this.logRepo
          .createQueryBuilder('al')
          .where('al.trace_id = :traceId', { traceId: message.trace_id })
          .orderBy('al.timestamp', 'ASC')
      : null;

    const [llmCalls, agentLogs] = await Promise.all([
      llmCallsQb.getMany(),
      logsQb ? logsQb.getMany() : Promise.resolve([]),
    ]);

    const llmCallIds = llmCalls.map((lc) => lc.id);
    const toolExecutions =
      llmCallIds.length > 0
        ? await this.toolRepo
            .createQueryBuilder('te')
            .where('te.llm_call_id IN (:...ids)', { ids: llmCallIds })
            .orderBy('te.llm_call_id', 'ASC')
            .getMany()
        : [];

    return {
      message: {
        id: message.id,
        timestamp: message.timestamp,
        agent_name: message.agent_name,
        model: message.model,
        status: message.status,
        error_message: message.error_message,
        error_http_status: message.error_http_status,
        description: message.description,
        service_type: message.service_type,
        input_tokens: message.input_tokens,
        output_tokens: message.output_tokens,
        cache_read_tokens: message.cache_read_tokens,
        cache_creation_tokens: message.cache_creation_tokens,
        cost_usd: message.cost_usd,
        duration_ms: message.duration_ms,
        trace_id: message.trace_id,
        routing_tier: message.routing_tier,
        routing_reason: message.routing_reason,
        specificity_category: message.specificity_category,
        specificity_miscategorized: message.specificity_miscategorized,
        auth_type: message.auth_type,
        skill_name: message.skill_name,
        fallback_from_model: message.fallback_from_model,
        fallback_index: message.fallback_index,
        session_key: message.session_key,
        feedback_rating: message.feedback_rating,
        feedback_tags: message.feedback_tags ? message.feedback_tags.split(',') : null,
        feedback_details: message.feedback_details,
      },
      llm_calls: llmCalls.map((lc) => ({
        id: lc.id,
        call_index: lc.call_index,
        request_model: lc.request_model,
        response_model: lc.response_model,
        gen_ai_system: lc.gen_ai_system,
        input_tokens: lc.input_tokens,
        output_tokens: lc.output_tokens,
        cache_read_tokens: lc.cache_read_tokens,
        cache_creation_tokens: lc.cache_creation_tokens,
        duration_ms: lc.duration_ms,
        ttft_ms: lc.ttft_ms,
        temperature: lc.temperature,
        max_output_tokens: lc.max_output_tokens,
        timestamp: lc.timestamp,
      })),
      tool_executions: toolExecutions.map((te) => ({
        id: te.id,
        llm_call_id: te.llm_call_id,
        tool_name: te.tool_name,
        duration_ms: te.duration_ms,
        status: te.status,
        error_message: te.error_message,
      })),
      agent_logs: agentLogs.map((al) => ({
        id: al.id,
        severity: al.severity,
        body: al.body,
        timestamp: al.timestamp,
        span_id: al.span_id,
      })),
    };
  }
}
