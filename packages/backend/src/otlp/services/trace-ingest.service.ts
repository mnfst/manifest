import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AgentMessage } from '../../entities/agent-message.entity';
import { LlmCall } from '../../entities/llm-call.entity';
import { ToolExecution } from '../../entities/tool-execution.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { OtlpExportTraceServiceRequest, OtlpSpan, OtlpResourceSpans } from '../interfaces';
import { IngestionContext } from '../interfaces/ingestion-context.interface';
import {
  extractAttributes,
  nanoToDatetime,
  spanDurationMs,
  toHexString,
  spanStatusToString,
  attrString,
  attrNumber,
  AttributeMap,
} from './otlp-helpers';

interface SpanEntry {
  uuid: string;
  type: 'agent_message' | 'llm_call' | 'tool_execution';
  spanId: string;
}

@Injectable()
export class TraceIngestService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly turnRepo: Repository<AgentMessage>,
    @InjectRepository(LlmCall)
    private readonly llmRepo: Repository<LlmCall>,
    @InjectRepository(ToolExecution)
    private readonly toolRepo: Repository<ToolExecution>,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  async ingest(
    request: OtlpExportTraceServiceRequest,
    ctx: IngestionContext,
  ): Promise<{ accepted: number }> {
    let accepted = 0;

    for (const rs of request.resourceSpans ?? []) {
      const resourceAttrs = extractAttributes(rs.resource?.attributes);
      const spans = this.flattenSpans(rs);
      const spanMap = this.buildSpanMap(spans, resourceAttrs);
      await this.insertAll(spans, resourceAttrs, spanMap, ctx);
      accepted += spans.length;
    }

    return { accepted };
  }

  private flattenSpans(rs: OtlpResourceSpans): OtlpSpan[] {
    const spans: OtlpSpan[] = [];
    for (const ss of rs.scopeSpans ?? []) {
      for (const span of ss.spans ?? []) spans.push(span);
    }
    return spans;
  }

  private classifySpan(attrs: AttributeMap): SpanEntry['type'] {
    if (attrString(attrs, 'gen_ai.system')) return 'llm_call';
    if (attrString(attrs, 'tool.name')) return 'tool_execution';
    return 'agent_message';
  }

  private buildSpanMap(spans: OtlpSpan[], resourceAttrs: AttributeMap): Map<string, SpanEntry> {
    const map = new Map<string, SpanEntry>();
    for (const span of spans) {
      const spanId = toHexString(span.spanId);
      const attrs = { ...resourceAttrs, ...extractAttributes(span.attributes) };
      map.set(spanId, { uuid: uuidv4(), type: this.classifySpan(attrs), spanId });
    }
    return map;
  }

  private async insertAll(
    spans: OtlpSpan[],
    resourceAttrs: AttributeMap,
    spanMap: Map<string, SpanEntry>,
    ctx: IngestionContext,
  ): Promise<void> {
    const messageAggregates = new Map<string, {
      input: number; output: number; cacheRead: number; cacheCreation: number;
      model: string | null; tier: string | null; cost: number;
    }>();

    for (const span of spans) {
      const spanId = toHexString(span.spanId);
      const entry = spanMap.get(spanId)!;
      const attrs = { ...resourceAttrs, ...extractAttributes(span.attributes) };

      if (entry.type === 'agent_message') {
        await this.insertAgentMessage(span, attrs, entry, spanMap, ctx);
      } else if (entry.type === 'llm_call') {
        await this.insertLlmCall(span, attrs, entry, spanMap, ctx);
        this.accumulateToMessage(span, attrs, spanMap, messageAggregates);
      } else {
        await this.insertToolExecution(span, attrs, entry, spanMap, ctx);
      }
    }

    await this.rollUpMessageAggregates(messageAggregates);
  }

  private accumulateToMessage(
    span: OtlpSpan,
    attrs: AttributeMap,
    spanMap: Map<string, SpanEntry>,
    aggregates: Map<string, { input: number; output: number; cacheRead: number; cacheCreation: number; model: string | null; tier: string | null; cost: number }>,
  ): void {
    const parentId = toHexString(span.parentSpanId);
    const parentEntry = spanMap.get(parentId);
    if (!parentEntry || parentEntry.type !== 'agent_message') return;

    const messageId = parentEntry.uuid;
    const agg = aggregates.get(messageId) ?? { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, model: null, tier: null, cost: 0 };
    agg.input += attrNumber(attrs, 'gen_ai.usage.input_tokens') ?? 0;
    agg.output += attrNumber(attrs, 'gen_ai.usage.output_tokens') ?? 0;
    agg.cacheRead += attrNumber(attrs, 'gen_ai.usage.cache_read_input_tokens') ?? 0;
    agg.cacheCreation += attrNumber(attrs, 'gen_ai.usage.cache_creation_input_tokens') ?? 0;
    if (!agg.model) agg.model = attrString(attrs, 'gen_ai.request.model') || attrString(attrs, 'gen_ai.response.model') || null;
    if (!agg.tier) agg.tier = attrString(attrs, 'manifest.routing.tier') || null;
    aggregates.set(messageId, agg);
  }

  private async rollUpMessageAggregates(
    aggregates: Map<string, { input: number; output: number; cacheRead: number; cacheCreation: number; model: string | null; tier: string | null; cost: number }>,
  ): Promise<void> {
    for (const [messageId, agg] of aggregates) {
      if (agg.input === 0 && agg.output === 0) continue;

      let cost: number | null = null;
      if (agg.model) {
        const pricing = this.pricingCache.getByModel(agg.model);
        if (pricing) {
          cost = agg.input * Number(pricing.input_price_per_token) + agg.output * Number(pricing.output_price_per_token);
        }
      }

      await this.turnRepo
        .createQueryBuilder()
        .update(AgentMessage)
        .set({
          input_tokens: agg.input,
          output_tokens: agg.output,
          cache_read_tokens: agg.cacheRead,
          cache_creation_tokens: agg.cacheCreation,
          model: () => 'COALESCE(model, :model)',
          routing_tier: () => 'COALESCE(routing_tier, :tier)',
          cost_usd: cost,
        })
        .setParameter('model', agg.model)
        .setParameter('tier', agg.tier)
        .where('id = :id', { id: messageId })
        .execute();
    }
  }

  private async insertAgentMessage(
    span: OtlpSpan,
    attrs: AttributeMap,
    entry: SpanEntry,
    _spanMap: Map<string, SpanEntry>,
    ctx: IngestionContext,
  ): Promise<void> {
    const cost = this.computeCost(attrs);
    await this.turnRepo.insert({
      id: entry.uuid,
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      trace_id: toHexString(span.traceId),
      session_key: attrString(attrs, 'session.key'),
      session_id: attrString(attrs, 'session.id'),
      timestamp: nanoToDatetime(span.startTimeUnixNano),
      duration_ms: spanDurationMs(span.startTimeUnixNano, span.endTimeUnixNano),
      input_tokens: attrNumber(attrs, 'gen_ai.usage.input_tokens') ?? 0,
      output_tokens: attrNumber(attrs, 'gen_ai.usage.output_tokens') ?? 0,
      cache_read_tokens: attrNumber(attrs, 'gen_ai.usage.cache_read_input_tokens') ?? 0,
      cache_creation_tokens: attrNumber(attrs, 'gen_ai.usage.cache_creation_input_tokens') ?? 0,
      cost_usd: cost,
      status: spanStatusToString(span.status?.code),
      error_message: span.status?.code === 2 ? (span.status.message ?? null) : null,
      description: span.name,
      service_type: attrString(attrs, 'service.name') ?? 'agent',
      agent_name: attrString(attrs, 'agent.name') ?? ctx.agentName,
      model: attrString(attrs, 'gen_ai.request.model') ?? attrString(attrs, 'gen_ai.response.model'),
      routing_tier: attrString(attrs, 'manifest.routing.tier'),
      skill_name: attrString(attrs, 'skill.name'),
    });
  }

  private async insertLlmCall(
    span: OtlpSpan,
    attrs: AttributeMap,
    entry: SpanEntry,
    spanMap: Map<string, SpanEntry>,
    ctx: IngestionContext,
  ): Promise<void> {
    const parentId = toHexString(span.parentSpanId);
    const parentEntry = spanMap.get(parentId);
    const messageId = parentEntry?.type === 'agent_message' ? parentEntry.uuid : null;

    await this.llmRepo.insert({
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
    });
  }

  private async insertToolExecution(
    span: OtlpSpan,
    attrs: AttributeMap,
    entry: SpanEntry,
    spanMap: Map<string, SpanEntry>,
    ctx: IngestionContext,
  ): Promise<void> {
    const parentId = toHexString(span.parentSpanId);
    const parentEntry = spanMap.get(parentId);
    const llmCallId = parentEntry?.type === 'llm_call' ? parentEntry.uuid : null;

    await this.toolRepo.insert({
      id: entry.uuid,
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      llm_call_id: llmCallId,
      tool_name: attrString(attrs, 'tool.name') ?? span.name,
      duration_ms: spanDurationMs(span.startTimeUnixNano, span.endTimeUnixNano),
      status: spanStatusToString(span.status?.code),
      error_message: span.status?.code === 2 ? (span.status.message ?? null) : null,
    });
  }

  private computeCost(attrs: AttributeMap): number | null {
    const model = attrString(attrs, 'gen_ai.request.model') ?? attrString(attrs, 'gen_ai.response.model');
    if (!model) return null;

    const inputTok = attrNumber(attrs, 'gen_ai.usage.input_tokens') ?? 0;
    const outputTok = attrNumber(attrs, 'gen_ai.usage.output_tokens') ?? 0;
    if (inputTok === 0 && outputTok === 0) return null;

    const pricing = this.pricingCache.getByModel(model);
    if (!pricing) return null;

    return inputTok * Number(pricing.input_price_per_token) + outputTok * Number(pricing.output_price_per_token);
  }
}
