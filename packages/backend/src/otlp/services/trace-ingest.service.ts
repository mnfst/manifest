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
import { In } from 'typeorm';
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
  type: 'agent_message' | 'llm_call' | 'tool_execution' | 'root_request';
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

  private classifySpan(attrs: AttributeMap, spanName?: string): SpanEntry['type'] {
    if (spanName === 'openclaw.agent.turn' || (spanName && spanName.startsWith('manifest.')))
      return 'agent_message';
    if (attrString(attrs, 'gen_ai.system')) return 'llm_call';
    if (attrString(attrs, 'tool.name')) return 'tool_execution';
    // Skip root spans, HTTP auto-instrumentation, and any other unknown spans.
    // Only explicitly recognized spans above should create agent_messages.
    return 'root_request';
  }

  private buildSpanMap(spans: OtlpSpan[], resourceAttrs: AttributeMap): Map<string, SpanEntry> {
    const map = new Map<string, SpanEntry>();
    for (const span of spans) {
      const spanId = toHexString(span.spanId);
      const attrs = { ...resourceAttrs, ...extractAttributes(span.attributes) };
      map.set(spanId, { uuid: uuidv4(), type: this.classifySpan(attrs, span.name), spanId });
    }
    return map;
  }

  private isEmptyOkSpan(span: OtlpSpan, attrs: AttributeMap): boolean {
    if (spanStatusToString(span.status?.code) !== 'ok') return false;
    if (attrString(attrs, 'gen_ai.request.model') || attrString(attrs, 'gen_ai.response.model'))
      return false;
    const input = attrNumber(attrs, 'gen_ai.usage.input_tokens') ?? 0;
    const output = attrNumber(attrs, 'gen_ai.usage.output_tokens') ?? 0;
    return input === 0 && output === 0;
  }

  private filterGhostSpans(
    spans: OtlpSpan[],
    resourceAttrs: AttributeMap,
    spanMap: Map<string, SpanEntry>,
  ): Set<string> {
    const ghostIds = new Set<string>();
    const msgSpans: { spanId: string; time: number; empty: boolean }[] = [];

    for (const span of spans) {
      const spanId = toHexString(span.spanId);
      const entry = spanMap.get(spanId);
      if (entry?.type !== 'agent_message') continue;
      const attrs = { ...resourceAttrs, ...extractAttributes(span.attributes) };
      const time = new Date(nanoToDatetime(span.startTimeUnixNano)).getTime();
      msgSpans.push({ spanId, time, empty: this.isEmptyOkSpan(span, attrs) });
    }

    for (const ms of msgSpans) {
      if (!ms.empty) continue;
      const hasSibling = msgSpans.some(
        (other) => !other.empty && Math.abs(other.time - ms.time) <= 60_000,
      );
      if (hasSibling) ghostIds.add(ms.spanId);
    }
    return ghostIds;
  }

  private async insertAll(
    spans: OtlpSpan[],
    resourceAttrs: AttributeMap,
    spanMap: Map<string, SpanEntry>,
    ctx: IngestionContext,
  ): Promise<void> {
    const ghostSpanIds = this.filterGhostSpans(spans, resourceAttrs, spanMap);
    const messageAggregates = new Map<
      string,
      {
        input: number;
        output: number;
        cacheRead: number;
        cacheCreation: number;
        model: string | null;
        tier: string | null;
        reason: string | null;
        cost: number;
      }
    >();

    for (const span of spans) {
      const spanId = toHexString(span.spanId);
      const entry = spanMap.get(spanId)!;
      const attrs = { ...resourceAttrs, ...extractAttributes(span.attributes) };

      if (entry.type === 'root_request') continue;
      if (entry.type === 'agent_message') {
        if (ghostSpanIds.has(spanId)) continue;
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
    aggregates: Map<
      string,
      {
        input: number;
        output: number;
        cacheRead: number;
        cacheCreation: number;
        model: string | null;
        tier: string | null;
        reason: string | null;
        cost: number;
      }
    >,
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

  private async rollUpMessageAggregates(
    aggregates: Map<
      string,
      {
        input: number;
        output: number;
        cacheRead: number;
        cacheCreation: number;
        model: string | null;
        tier: string | null;
        reason: string | null;
        cost: number;
      }
    >,
  ): Promise<void> {
    for (const [messageId, agg] of aggregates) {
      if (agg.input === 0 && agg.output === 0) continue;

      let cost: number | null = null;
      if (agg.model) {
        const pricing = this.pricingCache.getByModel(agg.model);
        if (
          pricing &&
          pricing.input_price_per_token != null &&
          pricing.output_price_per_token != null
        ) {
          cost =
            agg.input * Number(pricing.input_price_per_token) +
            agg.output * Number(pricing.output_price_per_token);
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
          routing_reason: () => 'COALESCE(routing_reason, :reason)',
          cost_usd: cost,
        })
        .setParameter('model', agg.model)
        .setParameter('tier', agg.tier)
        .setParameter('reason', agg.reason)
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
    // Skip if the proxy already recorded an error for this trace (avoids duplicates).
    // Two strategies: (1) match by trace_id, (2) match by agent + timestamp proximity.
    // Strategy 2 covers cases where the proxy doesn't have the traceparent header.
    const traceId = toHexString(span.traceId);
    if (traceId) {
      const existing = await this.turnRepo.findOne({
        where: {
          trace_id: traceId,
          tenant_id: ctx.tenantId,
          status: In(['error', 'rate_limited']),
        },
        select: ['id'],
      });
      if (existing) return;
    }

    // Fallback dedup: fetch recent errors for this agent and check timestamp proximity.
    // Uses the span's own timestamp (not Date.now()) because OTLP batches arrive
    // 10-30s after the actual event. Compares in JS to avoid SQLite Between issues.
    const spanTime = new Date(nanoToDatetime(span.startTimeUnixNano)).getTime();
    const recentErrors = await this.turnRepo.find({
      where: {
        tenant_id: ctx.tenantId,
        agent_id: ctx.agentId,
        status: In(['error', 'rate_limited']),
      },
      select: ['id', 'timestamp'],
      order: { timestamp: 'DESC' },
      take: 5,
    });
    const hasNearbyError = recentErrors.some((e) => {
      const errorTime = new Date(e.timestamp).getTime();
      return Math.abs(errorTime - spanTime) <= 30_000;
    });
    if (hasNearbyError) return;

    // DB-level ghost dedup: if this span is empty-ok, check if a data-bearing
    // message for the same agent already exists within 60s (cross-batch case).
    // Scope by session_key when available to avoid cross-session false positives.
    if (this.isEmptyOkSpan(span, attrs)) {
      const sessionKey = attrString(attrs, 'session.key');
      const where: Record<string, string> = { tenant_id: ctx.tenantId, agent_id: ctx.agentId };
      if (sessionKey) where.session_key = sessionKey;
      const recentMessages = await this.turnRepo.find({
        where,
        select: ['id', 'timestamp', 'input_tokens', 'output_tokens', 'model'],
        order: { timestamp: 'DESC' },
        take: 5,
      });
      const hasNearbyData = recentMessages.some((m) => {
        const mTime = new Date(m.timestamp).getTime();
        return (
          Math.abs(mTime - spanTime) <= 60_000 &&
          ((m.input_tokens ?? 0) > 0 || (m.output_tokens ?? 0) > 0 || m.model != null)
        );
      });
      if (hasNearbyData) return;
    }

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
      model:
        attrString(attrs, 'gen_ai.request.model') ?? attrString(attrs, 'gen_ai.response.model'),
      routing_tier: attrString(attrs, 'manifest.routing.tier'),
      routing_reason: attrString(attrs, 'manifest.routing.reason'),
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
    const model =
      attrString(attrs, 'gen_ai.request.model') ?? attrString(attrs, 'gen_ai.response.model');
    if (!model) return null;

    const inputTok = attrNumber(attrs, 'gen_ai.usage.input_tokens') ?? 0;
    const outputTok = attrNumber(attrs, 'gen_ai.usage.output_tokens') ?? 0;
    if (inputTok === 0 && outputTok === 0) return null;

    const pricing = this.pricingCache.getByModel(model);
    if (!pricing) return null;

    return (
      inputTok * Number(pricing.input_price_per_token) +
      outputTok * Number(pricing.output_price_per_token)
    );
  }
}
