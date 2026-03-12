import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AgentMessage } from '../../entities/agent-message.entity';
import { LlmCall } from '../../entities/llm-call.entity';
import { ToolExecution } from '../../entities/tool-execution.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { UserProvider } from '../../entities/user-provider.entity';
import { OtlpExportTraceServiceRequest, OtlpSpan, OtlpResourceSpans } from '../interfaces';
import { IngestionContext } from '../interfaces/ingestion-context.interface';
import { In, Not, IsNull } from 'typeorm';
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
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
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

  private async remapFallbackSpans(
    spans: OtlpSpan[],
    spanMap: Map<string, SpanEntry>,
    ctx: IngestionContext,
    fallbackModelOverrides: Map<string, string>,
    fallbackDurations: Map<string, number>,
  ): Promise<Set<string>> {
    const skipIds = new Set<string>();
    for (const span of spans) {
      const spanId = toHexString(span.spanId);
      const entry = spanMap.get(spanId);
      if (!entry || entry.type !== 'agent_message') continue;

      const traceId = toHexString(span.traceId);
      let fallback: Pick<AgentMessage, 'id' | 'model'> | null = null;

      // Strategy 1: match by trace_id (when gateway sends traceparent).
      if (traceId) {
        fallback = await this.turnRepo.findOne({
          where: {
            trace_id: traceId,
            tenant_id: ctx.tenantId,
            agent_id: ctx.agentId,
            fallback_from_model: Not(IsNull()),
          },
          select: ['id', 'model'],
        });
      }

      // Strategy 2: match recent unfilled fallback success by agent + time proximity.
      if (!fallback) {
        fallback = await this.findUnfilledFallback(span, ctx);
      }

      if (fallback) {
        entry.uuid = fallback.id;
        if (fallback.model) {
          fallbackModelOverrides.set(fallback.id, fallback.model);
        }
        const durationMs = spanDurationMs(span.startTimeUnixNano, span.endTimeUnixNano);
        if (durationMs != null) fallbackDurations.set(fallback.id, durationMs);
        skipIds.add(spanId);
      }
    }
    return skipIds;
  }

  /**
   * Remap agent_message spans whose trace_id already has a proxy-recorded 'ok'
   * message. The proxy creates the message with real tokens; the OTLP span is
   * a duplicate. Remapping preserves child LLM call linkage while preventing
   * a second message row.
   */
  private async remapProxyDuplicates(
    spans: OtlpSpan[],
    spanMap: Map<string, SpanEntry>,
    ctx: IngestionContext,
  ): Promise<Set<string>> {
    const skipIds = new Set<string>();
    for (const span of spans) {
      const spanId = toHexString(span.spanId);
      const entry = spanMap.get(spanId);
      if (!entry || entry.type !== 'agent_message') continue;

      const traceId = toHexString(span.traceId);
      if (!traceId) continue;

      const existing = await this.turnRepo.findOne({
        where: { trace_id: traceId, tenant_id: ctx.tenantId, agent_id: ctx.agentId, status: 'ok' },
        select: ['id'],
      });
      if (existing) {
        entry.uuid = existing.id;
        skipIds.add(spanId);
      }
    }
    return skipIds;
  }

  private async findUnfilledFallback(
    span: OtlpSpan,
    ctx: IngestionContext,
  ): Promise<Pick<AgentMessage, 'id' | 'model'> | null> {
    const spanTime = new Date(nanoToDatetime(span.startTimeUnixNano)).getTime();
    const candidates = await this.turnRepo.find({
      where: {
        tenant_id: ctx.tenantId,
        agent_id: ctx.agentId,
        fallback_from_model: Not(IsNull()),
        status: 'ok',
        input_tokens: 0,
        output_tokens: 0,
      },
      select: ['id', 'model', 'timestamp'],
      order: { timestamp: 'DESC' },
      take: 1,
    });
    if (candidates.length === 0) return null;
    const cTime = new Date(candidates[0].timestamp).getTime();
    return Math.abs(cTime - spanTime) <= 60_000 ? candidates[0] : null;
  }

  private async insertAll(
    spans: OtlpSpan[],
    resourceAttrs: AttributeMap,
    spanMap: Map<string, SpanEntry>,
    ctx: IngestionContext,
  ): Promise<void> {
    const subOnlyProviders = await this.getSubscriptionProviders(ctx.agentId);
    const ghostSpanIds = this.filterGhostSpans(spans, resourceAttrs, spanMap);
    const fallbackModelOverrides = new Map<string, string>();
    const fallbackDurations = new Map<string, number>();
    // Pre-pass: remap UUIDs for fallback spans BEFORE processing LLM calls,
    // so accumulateToMessage uses the correct (remapped) message ID regardless
    // of span ordering within the OTLP batch.
    const fallbackSkipIds = await this.remapFallbackSpans(
      spans,
      spanMap,
      ctx,
      fallbackModelOverrides,
      fallbackDurations,
    );
    // Pre-pass: remap UUIDs for spans whose trace already has a proxy-recorded
    // message. Child LLM spans will accumulate to the proxy message instead.
    const proxySkipIds = await this.remapProxyDuplicates(spans, spanMap, ctx);
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

    const agentMessageRows: Record<string, unknown>[] = [];
    const llmCallRows: Record<string, unknown>[] = [];
    const toolExecutionRows: Record<string, unknown>[] = [];

    for (const span of spans) {
      const spanId = toHexString(span.spanId);
      const entry = spanMap.get(spanId)!;
      const attrs = { ...resourceAttrs, ...extractAttributes(span.attributes) };

      if (entry.type === 'root_request') continue;
      if (entry.type === 'agent_message') {
        if (ghostSpanIds.has(spanId) || fallbackSkipIds.has(spanId) || proxySkipIds.has(spanId))
          continue;
        const row = await this.buildAgentMessage(span, attrs, entry, ctx, subOnlyProviders);
        if (row) agentMessageRows.push(row);
      } else if (entry.type === 'llm_call') {
        llmCallRows.push(this.buildLlmCall(span, attrs, entry, spanMap, ctx));
        this.accumulateToMessage(span, attrs, spanMap, messageAggregates);
      } else {
        toolExecutionRows.push(this.buildToolExecution(span, attrs, entry, spanMap, ctx));
      }
    }

    const inserts: Promise<unknown>[] = [];
    if (agentMessageRows.length > 0) inserts.push(this.turnRepo.insert(agentMessageRows));
    if (llmCallRows.length > 0) inserts.push(this.llmRepo.insert(llmCallRows));
    if (toolExecutionRows.length > 0) inserts.push(this.toolRepo.insert(toolExecutionRows));
    await Promise.all(inserts);

    await this.rollUpMessageAggregates(
      messageAggregates,
      subOnlyProviders,
      fallbackModelOverrides,
      fallbackDurations,
    );
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
    subOnlyProviders: Set<string>,
    fallbackModelOverrides?: Map<string, string>,
    fallbackDurations?: Map<string, number>,
  ): Promise<void> {
    const updates: Promise<unknown>[] = [];
    for (const [messageId, agg] of aggregates) {
      if (agg.input === 0 && agg.output === 0) continue;

      // For fallback records, use the correct model for cost calculation
      // (OTLP carries the gateway's local resolution, not the actual fallback model).
      const costModel = fallbackModelOverrides?.get(messageId) ?? agg.model;
      let cost: number | null = null;
      if (costModel) {
        const pricing = this.pricingCache.getByModel(costModel);
        if (pricing && subOnlyProviders.has(pricing.provider?.toLowerCase())) {
          cost = 0;
        } else if (
          pricing &&
          pricing.input_price_per_token != null &&
          pricing.output_price_per_token != null
        ) {
          cost =
            agg.input * Number(pricing.input_price_per_token) +
            agg.output * Number(pricing.output_price_per_token);
        }
      }

      // Preserve proxy-recorded token/cost data: only overwrite when the
      // existing message has no tokens (i.e. empty stub awaiting rollup).
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

      const qb = this.turnRepo
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

  private async buildAgentMessage(
    span: OtlpSpan,
    attrs: AttributeMap,
    entry: SpanEntry,
    ctx: IngestionContext,
    subOnlyProviders: Set<string>,
  ): Promise<Record<string, unknown> | null> {
    // Skip if the proxy already recorded an error for this trace (avoids duplicates).
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
      if (existing) return null;
    }

    // Fallback dedup: fetch recent errors for this agent and check timestamp proximity.
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
    if (hasNearbyError) return null;

    // Proxy dedup: check if the proxy already recorded a success message with
    // real tokens for the same agent within 60s. Target proxy messages specifically
    // via duration_ms IS NULL (proxy never sets duration; OTLP always does).
    // This catches cases where the gateway doesn't propagate the traceparent
    // header, causing the trace_id-based dedup in remapProxyDuplicates to miss.
    const recentProxyMessages = await this.turnRepo.find({
      where: {
        tenant_id: ctx.tenantId,
        agent_id: ctx.agentId,
        status: 'ok',
        duration_ms: IsNull(),
      },
      select: ['id', 'timestamp', 'input_tokens'],
      order: { timestamp: 'DESC' },
      take: 3,
    });
    const hasProxyData = recentProxyMessages.some((m) => {
      const mTime = new Date(m.timestamp).getTime();
      return Math.abs(mTime - spanTime) <= 60_000 && (m.input_tokens ?? 0) > 0;
    });
    if (hasProxyData) return null;

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
      if (hasNearbyData) return null;
    }

    return {
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
      cost_usd: this.computeCost(attrs, subOnlyProviders),
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
      auth_type: this.inferAuthType(attrs, subOnlyProviders),
    };
  }

  private inferAuthType(attrs: AttributeMap, subOnlyProviders: Set<string>): string | null {
    const model =
      attrString(attrs, 'gen_ai.request.model') ?? attrString(attrs, 'gen_ai.response.model');
    if (!model) return null;
    const pricing = this.pricingCache.getByModel(model);
    if (!pricing) return null;
    return subOnlyProviders.has(pricing.provider?.toLowerCase()) ? 'subscription' : 'api_key';
  }

  private buildLlmCall(
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

  private buildToolExecution(
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

  /** Returns provider IDs that are subscription-only (no api_key counterpart) for an agent. */
  private async getSubscriptionProviders(agentId: string): Promise<Set<string>> {
    const records = await this.providerRepo.find({
      where: { agent_id: agentId, is_active: true },
      select: ['provider', 'auth_type'],
    });
    const sub = new Set<string>();
    for (const r of records) {
      if (r.auth_type === 'subscription') sub.add(r.provider);
    }
    // Keep dual-auth providers in the set: the routing layer prefers subscription
    // when both exist, so the OTLP heuristic should match (zero cost).
    return sub;
  }

  private computeCost(attrs: AttributeMap, subOnlyProviders?: Set<string>): number | null {
    const model =
      attrString(attrs, 'gen_ai.request.model') ?? attrString(attrs, 'gen_ai.response.model');
    if (!model) return null;

    const inputTok = attrNumber(attrs, 'gen_ai.usage.input_tokens') ?? 0;
    const outputTok = attrNumber(attrs, 'gen_ai.usage.output_tokens') ?? 0;
    if (inputTok === 0 && outputTok === 0) return null;

    const pricing = this.pricingCache.getByModel(model);
    if (!pricing) return null;

    if (subOnlyProviders?.has(pricing.provider?.toLowerCase())) return 0;

    return (
      inputTok * Number(pricing.input_price_per_token) +
      outputTok * Number(pricing.output_price_per_token)
    );
  }
}
