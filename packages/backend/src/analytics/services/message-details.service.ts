import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import type { CallerAttribution } from '../../routing/proxy/caller-classifier';
import type { RequestParamDefaults } from 'manifest-shared';

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
    provider_key_label: string | null;
    skill_name: string | null;
    fallback_from_model: string | null;
    fallback_index: number | null;
    session_key: string | null;
    feedback_rating: string | null;
    feedback_tags: string[] | null;
    feedback_details: string | null;
    request_headers: Record<string, string> | null;
    request_params: RequestParamDefaults | null;
    caller_attribution: CallerAttribution | null;
    header_tier_id: string | null;
    header_tier_name: string | null;
    header_tier_color: string | null;
  };
}

@Injectable()
export class MessageDetailsService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
  ) {}

  async getDetails(messageId: string, tenantId: string | null): Promise<MessageDetailResponse> {
    // No tenant → no messages, so any id is unknown.
    if (!tenantId) throw new NotFoundException('Message not found');

    const message = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.id = :id', { id: messageId })
      .andWhere('m.tenant_id = :tenantId', { tenantId })
      .getOne();
    if (!message) throw new NotFoundException('Message not found');

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
        provider_key_label: message.provider_key_label,
        skill_name: message.skill_name,
        fallback_from_model: message.fallback_from_model,
        fallback_index: message.fallback_index,
        session_key: message.session_key,
        feedback_rating: message.feedback_rating,
        feedback_tags: message.feedback_tags ? message.feedback_tags.split(',') : null,
        feedback_details: message.feedback_details,
        request_headers: message.request_headers,
        request_params: message.request_params as RequestParamDefaults | null,
        caller_attribution: message.caller_attribution,
        header_tier_id: message.header_tier_id,
        header_tier_name: message.header_tier_name,
        header_tier_color: message.header_tier_color,
      },
    };
  }
}
