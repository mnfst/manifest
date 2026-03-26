import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, Not, IsNull, MoreThanOrEqual } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { LlmCall } from '../../entities/llm-call.entity';
import { ToolExecution } from '../../entities/tool-execution.entity';
import { OtlpExportTraceServiceRequest, OtlpSpan } from '../interfaces';
import { IngestionContext } from '../interfaces/ingestion-context.interface';
import {
  extractAttributes,
  nanoToDatetime,
  spanDurationMs,
  toHexString,
  AttributeMap,
} from './otlp-helpers';
import { SpanEntry, flattenSpans, buildSpanMap, filterGhostSpans } from './trace-span-classifier';
import { TraceDedupService } from './trace-dedup.service';
import { TraceCostCalculator } from './trace-cost-calculator';
import { TraceEntityBuilder, MessageAggregate } from './trace-entity-builder';

@Injectable()
export class TraceIngestService {
  constructor(
    @InjectRepository(AgentMessage)
    private readonly turnRepo: Repository<AgentMessage>,
    @InjectRepository(LlmCall)
    private readonly llmRepo: Repository<LlmCall>,
    @InjectRepository(ToolExecution)
    private readonly toolRepo: Repository<ToolExecution>,
    private readonly dedupService: TraceDedupService,
    private readonly costCalculator: TraceCostCalculator,
    private readonly entityBuilder: TraceEntityBuilder,
  ) {}

  async ingest(
    request: OtlpExportTraceServiceRequest,
    ctx: IngestionContext,
  ): Promise<{ accepted: number }> {
    let accepted = 0;

    for (const rs of request.resourceSpans ?? []) {
      const resourceAttrs = extractAttributes(rs.resource?.attributes);
      const spans = flattenSpans(rs);
      const spanMap = buildSpanMap(spans, resourceAttrs);
      await this.insertAll(spans, resourceAttrs, spanMap, ctx);
      accepted += spans.length;
    }

    return { accepted };
  }

  private async remapFallbackSpans(
    turnRepo: Repository<AgentMessage>,
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
        fallback = await turnRepo.findOne({
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
        fallback = await this.findUnfilledFallback(turnRepo, span, ctx);
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

  private async findUnfilledFallback(
    turnRepo: Repository<AgentMessage>,
    span: OtlpSpan,
    ctx: IngestionContext,
  ): Promise<Pick<AgentMessage, 'id' | 'model'> | null> {
    const spanTime = new Date(nanoToDatetime(span.startTimeUnixNano));
    const cutoff = new Date(spanTime.getTime() - 5 * 60_000).toISOString();
    const candidates = await turnRepo.find({
      where: {
        tenant_id: ctx.tenantId,
        agent_id: ctx.agentId,
        fallback_from_model: Not(IsNull()),
        status: 'ok',
        input_tokens: 0,
        output_tokens: 0,
        timestamp: MoreThanOrEqual(cutoff),
      },
      select: ['id', 'model', 'timestamp'],
      order: { timestamp: 'DESC' },
      take: 1,
    });
    if (candidates.length === 0) return null;
    const cTime = new Date(candidates[0].timestamp).getTime();
    return Math.abs(cTime - spanTime.getTime()) <= 60_000 ? candidates[0] : null;
  }

  private async insertAll(
    spans: OtlpSpan[],
    resourceAttrs: AttributeMap,
    spanMap: Map<string, SpanEntry>,
    ctx: IngestionContext,
  ): Promise<void> {
    const subOnlyProviders = await this.costCalculator.getSubscriptionProviders(ctx.agentId);
    await this.withTurnWriteTransaction(ctx, async ({ turnRepo, llmRepo, toolRepo }) => {
      const ghostSpanIds = filterGhostSpans(spans, resourceAttrs, spanMap);
      const fallbackModelOverrides = new Map<string, string>();
      const fallbackDurations = new Map<string, number>();
      const fallbackSkipIds = await this.remapFallbackSpans(
        turnRepo,
        spans,
        spanMap,
        ctx,
        fallbackModelOverrides,
        fallbackDurations,
      );

      const dedupCtx = await this.dedupService.buildDedupContext(
        turnRepo,
        spans,
        spanMap,
        ghostSpanIds,
        fallbackSkipIds,
        ctx,
      );

      const messageAggregates = new Map<string, MessageAggregate>();
      const agentMessageRows: Record<string, unknown>[] = [];
      const llmCallRows: Record<string, unknown>[] = [];
      const toolExecutionRows: Record<string, unknown>[] = [];

      for (const span of spans) {
        const spanId = toHexString(span.spanId);
        const entry = spanMap.get(spanId)!;
        const attrs = { ...resourceAttrs, ...extractAttributes(span.attributes) };

        if (entry.type === 'root_request') continue;
        if (entry.type === 'agent_message') {
          if (ghostSpanIds.has(spanId) || fallbackSkipIds.has(spanId)) continue;
          const row = this.entityBuilder.buildAgentMessage(
            span,
            attrs,
            entry,
            ctx,
            dedupCtx,
            subOnlyProviders,
          );
          if (row) agentMessageRows.push(row);
        } else if (entry.type === 'llm_call') {
          llmCallRows.push(this.entityBuilder.buildLlmCall(span, attrs, entry, spanMap, ctx));
          this.entityBuilder.accumulateToMessage(span, attrs, spanMap, messageAggregates);
        } else {
          toolExecutionRows.push(
            this.entityBuilder.buildToolExecution(span, attrs, entry, spanMap, ctx),
          );
        }
      }

      const inserts: Promise<unknown>[] = [];
      if (agentMessageRows.length > 0) inserts.push(turnRepo.insert(agentMessageRows));
      if (llmCallRows.length > 0) inserts.push(llmRepo.insert(llmCallRows));
      if (toolExecutionRows.length > 0) inserts.push(toolRepo.insert(toolExecutionRows));
      await Promise.all(inserts);

      await this.entityBuilder.rollUpMessageAggregates(
        turnRepo,
        messageAggregates,
        subOnlyProviders,
        fallbackModelOverrides,
        fallbackDurations,
      );
    });
  }

  private async withTurnWriteTransaction<T>(
    ctx: IngestionContext,
    fn: (repos: {
      turnRepo: Repository<AgentMessage>;
      llmRepo: Repository<LlmCall>;
      toolRepo: Repository<ToolExecution>;
    }) => Promise<T>,
  ): Promise<T> {
    return this.turnRepo.manager.transaction(async (manager) => {
      await this.lockAgentMessageWrites(manager, ctx.agentId);
      return fn({
        turnRepo: manager.getRepository(AgentMessage),
        llmRepo: manager.getRepository(LlmCall),
        toolRepo: manager.getRepository(ToolExecution),
      });
    });
  }

  private async lockAgentMessageWrites(manager: EntityManager, agentId: string): Promise<void> {
    if (manager.connection.options.type !== 'postgres') return;
    await manager.query('SELECT id FROM agents WHERE id = $1 FOR UPDATE', [agentId]);
  }
}
