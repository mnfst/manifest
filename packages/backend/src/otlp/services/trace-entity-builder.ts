import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { OtlpSpan } from '../interfaces';
import { IngestionContext } from '../interfaces/ingestion-context.interface';
import {
  nanoToDatetime,
  spanDurationMs,
  toHexString,
  spanStatusToString,
  attrString,
  attrNumber,
  AttributeMap,
} from './otlp-helpers';
import { SpanEntry, isEmptyOkSpan } from './trace-span-classifier';
import { DedupContext } from './trace-dedup.service';
import { TraceCostCalculator } from './trace-cost-calculator';

export interface MessageAggregate {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
  model: string | null;
  tier: string | null;
  reason: string | null;
  cost: number;
}

@Injectable()
export class TraceEntityBuilder {
  constructor(private readonly costCalculator: TraceCostCalculator) {}

  buildAgentMessage(
    span: OtlpSpan,
    attrs: AttributeMap,
    entry: SpanEntry,
    ctx: IngestionContext,
    dedup: DedupContext,
    subOnlyProviders: Set<string>,
  ): Record<string, unknown> | null {
    if (this.isDuplicate(span, attrs, dedup)) return null;

    return {
      id: entry.uuid,
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      user_id: ctx.userId,
      trace_id: toHexString(span.traceId),
      session_key: attrString(attrs, 'session.key'),
      session_id: attrString(attrs, 'session.id'),
      timestamp: nanoToDatetime(span.startTimeUnixNano),
      duration_ms: spanDurationMs(span.startTimeUnixNano, span.endTimeUnixNano),
      input_tokens: attrNumber(attrs, 'gen_ai.usage.input_tokens') ?? 0,
      output_tokens: attrNumber(attrs, 'gen_ai.usage.output_tokens') ?? 0,
      cache_read_tokens: attrNumber(attrs, 'gen_ai.usage.cache_read_input_tokens') ?? 0,
      cache_creation_tokens: attrNumber(attrs, 'gen_ai.usage.cache_creation_input_tokens') ?? 0,
      cost_usd: this.costCalculator.computeCost(attrs, subOnlyProviders),
      status: spanStatusToString(span.status?.code),
      error_message: span.status?.code === 2 ? (span.status.message ?? null) : null,
      description: span.name,
      service_type: attrString(attrs, 'service.name') ?? 'agent',
      agent_name: attrString(attrs, 'agent.name') ?? ctx.agentName,
      model:
        attrString(attrs, 'gen_ai.request.model') ?? attrString(attrs, 'gen_ai.response.model'),
      routing_tier: attrString(attrs, 'manifest.routing.tier'),
      routing_reason: attrString(attrs, 'manifest.routing.reason'),
      skill_name: attrString(attrs, 'skill.name'),
      auth_type: this.costCalculator.inferAuthType(attrs, subOnlyProviders),
    };
  }

  private isDuplicate(span: OtlpSpan, attrs: AttributeMap, dedup: DedupContext): boolean {
    const traceId = toHexString(span.traceId);
    if (traceId && dedup.errorTraceIds.has(traceId)) return true;
    if (traceId && dedup.successTraceIds.has(traceId)) return true;

    const spanTime = new Date(nanoToDatetime(span.startTimeUnixNano)).getTime();
    if (this.hasNearbyError(dedup, spanTime)) return true;
    if (this.hasProxyDuplicate(span, attrs, dedup, spanTime)) return true;
    if (this.hasDbGhostDuplicate(span, attrs, dedup, spanTime)) return true;

    return false;
  }

  private hasNearbyError(dedup: DedupContext, spanTime: number): boolean {
    return dedup.recentErrors.some((e) => {
      const errorTime = new Date(e.timestamp).getTime();
      return Math.abs(errorTime - spanTime) <= 60_000;
    });
  }

  private hasProxyDuplicate(
    span: OtlpSpan,
    attrs: AttributeMap,
    dedup: DedupContext,
    spanTime: number,
  ): boolean {
    const spanInputTokens = attrNumber(attrs, 'gen_ai.usage.input_tokens') ?? 0;
    const spanOutputTokens = attrNumber(attrs, 'gen_ai.usage.output_tokens') ?? 0;
    const spanModel =
      attrString(attrs, 'gen_ai.request.model') ?? attrString(attrs, 'gen_ai.response.model');

    if (spanInputTokens === 0 && spanOutputTokens === 0) {
      return dedup.recentOkMessages.some((m) => {
        const mTime = new Date(m.timestamp).getTime();
        return Math.abs(mTime - spanTime) <= 60_000 && m.input_tokens > 0;
      });
    }

    // Both OTLP and proxy have tokens -- match by model + input token count within time window
    return dedup.recentMessages.some((m) => {
      if (m.model !== spanModel && !m.model?.startsWith(`${spanModel}-`)) return false;
      const mTime = new Date(m.timestamp).getTime();
      if (Math.abs(mTime - spanTime) > 30_000) return false;
      return m.input_tokens === spanInputTokens;
    });
  }

  private hasDbGhostDuplicate(
    span: OtlpSpan,
    attrs: AttributeMap,
    dedup: DedupContext,
    spanTime: number,
  ): boolean {
    if (!isEmptyOkSpan(span, attrs)) return false;

    const sessionKey = attrString(attrs, 'session.key');
    const candidates = sessionKey
      ? dedup.recentMessages.filter((m) => m.session_key === sessionKey)
      : dedup.recentMessages;

    return candidates.some((m) => {
      const mTime = new Date(m.timestamp).getTime();
      return (
        Math.abs(mTime - spanTime) <= 60_000 &&
        (m.input_tokens > 0 || m.output_tokens > 0 || m.model != null)
      );
    });
  }

  buildLlmCall(
    span: OtlpSpan,
    attrs: AttributeMap,
    entry: SpanEntry,
    spanMap: Map<string, SpanEntry>,
    ctx: IngestionContext,
  ): Record<string, unknown> {
    const parentId = toHexString(span.parentSpanId);
    const parentEntry = spanMap.get(parentId);
    const messageId = parentEntry?.type === 'agent_message' ? parentEntry.uuid : null;

    return {
      id: entry.uuid,
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      turn_id: messageId,
      call_index: attrNumber(attrs, 'gen_ai.call_index'),
      gen_ai_system: attrString(attrs, 'gen_ai.system'),
      request_model: attrString(attrs, 'gen_ai.request.model'),
      response_model: attrString(attrs, 'gen_ai.response.model'),
      input_tokens: attrNumber(attrs, 'gen_ai.usage.input_tokens') ?? 0,
      output_tokens: attrNumber(attrs, 'gen_ai.usage.output_tokens') ?? 0,
      cache_read_tokens: attrNumber(attrs, 'gen_ai.usage.cache_read_input_tokens') ?? 0,
      cache_creation_tokens: attrNumber(attrs, 'gen_ai.usage.cache_creation_input_tokens') ?? 0,
      duration_ms: spanDurationMs(span.startTimeUnixNano, span.endTimeUnixNano),
      ttft_ms: attrNumber(attrs, 'gen_ai.server.ttft_ms'),
      temperature: attrNumber(attrs, 'llm.request.temperature'),
      max_output_tokens: attrNumber(attrs, 'llm.request.max_tokens'),
      timestamp: nanoToDatetime(span.startTimeUnixNano),
    };
  }

  buildToolExecution(
    span: OtlpSpan,
    attrs: AttributeMap,
    entry: SpanEntry,
    spanMap: Map<string, SpanEntry>,
    ctx: IngestionContext,
  ): Record<string, unknown> {
    const parentId = toHexString(span.parentSpanId);
    const parentEntry = spanMap.get(parentId);
    const llmCallId = parentEntry?.type === 'llm_call' ? parentEntry.uuid : null;

    return {
      id: entry.uuid,
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      llm_call_id: llmCallId,
      tool_name: attrString(attrs, 'tool.name') ?? span.name,
      duration_ms: spanDurationMs(span.startTimeUnixNano, span.endTimeUnixNano),
      status: spanStatusToString(span.status?.code),
      error_message: span.status?.code === 2 ? (span.status.message ?? null) : null,
    };
  }

  accumulateToMessage(
    span: OtlpSpan,
    attrs: AttributeMap,
    spanMap: Map<string, SpanEntry>,
    aggregates: Map<string, MessageAggregate>,
  ): void {
    const parentId = toHexString(span.parentSpanId);
    const parentEntry = spanMap.get(parentId);
    if (!parentEntry || parentEntry.type !== 'agent_message') return;

    const messageId = parentEntry.uuid;
    const agg = aggregates.get(messageId) ?? {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheCreation: 0,
      model: null,
      tier: null,
      reason: null,
      cost: 0,
    };
    agg.input += attrNumber(attrs, 'gen_ai.usage.input_tokens') ?? 0;
    agg.output += attrNumber(attrs, 'gen_ai.usage.output_tokens') ?? 0;
    agg.cacheRead += attrNumber(attrs, 'gen_ai.usage.cache_read_input_tokens') ?? 0;
    agg.cacheCreation += attrNumber(attrs, 'gen_ai.usage.cache_creation_input_tokens') ?? 0;
    if (!agg.model)
      agg.model =
        attrString(attrs, 'gen_ai.request.model') ||
        attrString(attrs, 'gen_ai.response.model') ||
        null;
    if (!agg.tier) agg.tier = attrString(attrs, 'manifest.routing.tier') || null;
    if (!agg.reason) agg.reason = attrString(attrs, 'manifest.routing.reason') || null;
    aggregates.set(messageId, agg);
  }

  async rollUpMessageAggregates(
    turnRepo: Repository<AgentMessage>,
    aggregates: Map<string, MessageAggregate>,
    subOnlyProviders: Set<string>,
    fallbackModelOverrides?: Map<string, string>,
    fallbackDurations?: Map<string, number>,
  ): Promise<void> {
    const updates: Promise<unknown>[] = [];
    for (const [messageId, agg] of aggregates) {
      if (agg.input === 0 && agg.output === 0) continue;

      const costModel = fallbackModelOverrides?.get(messageId) ?? agg.model;
      const cost = this.costCalculator.computeRollupCost(
        costModel,
        agg.input,
        agg.output,
        subOnlyProviders,
      );

      const setClause: Record<string, unknown> = {
        input_tokens: () => `CASE WHEN input_tokens = 0 THEN :inputTok ELSE input_tokens END`,
        output_tokens: () => `CASE WHEN input_tokens = 0 THEN :outputTok ELSE output_tokens END`,
        cache_read_tokens: () =>
          `CASE WHEN input_tokens = 0 THEN :cacheRead ELSE cache_read_tokens END`,
        cache_creation_tokens: () =>
          `CASE WHEN input_tokens = 0 THEN :cacheCreation ELSE cache_creation_tokens END`,
        cost_usd: () => `CASE WHEN input_tokens = 0 THEN :cost ELSE cost_usd END`,
        model: () => 'COALESCE(model, :model)',
        routing_tier: () => 'COALESCE(routing_tier, :tier)',
        routing_reason: () => 'COALESCE(routing_reason, :reason)',
      };
      const durationMs = fallbackDurations?.get(messageId);
      if (durationMs != null) {
        setClause.duration_ms = () => 'COALESCE(duration_ms, :durationMs)';
      }

      const qb = turnRepo
        .createQueryBuilder()
        .update(AgentMessage)
        .set(setClause)
        .setParameter('inputTok', agg.input)
        .setParameter('outputTok', agg.output)
        .setParameter('cacheRead', agg.cacheRead)
        .setParameter('cacheCreation', agg.cacheCreation)
        .setParameter('cost', cost)
        .setParameter('model', agg.model)
        .setParameter('tier', agg.tier)
        .setParameter('reason', agg.reason)
        .where('id = :id', { id: messageId });
      if (durationMs != null) qb.setParameter('durationMs', durationMs);
      updates.push(qb.execute());
    }
    if (updates.length > 0) await Promise.all(updates);
  }
}
