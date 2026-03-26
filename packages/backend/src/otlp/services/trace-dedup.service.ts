import { Injectable } from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { OtlpSpan } from '../interfaces';
import { IngestionContext } from '../interfaces/ingestion-context.interface';
import { toHexString } from './otlp-helpers';
import { SpanEntry } from './trace-span-classifier';

export interface DedupContext {
  errorTraceIds: Set<string>;
  successTraceIds: Set<string>;
  recentErrors: { id: string; timestamp: string }[];
  recentOkMessages: { id: string; timestamp: string; input_tokens: number }[];
  recentMessages: {
    id: string;
    timestamp: string;
    input_tokens: number;
    output_tokens: number;
    model: string | null;
    session_key: string | null;
  }[];
}

@Injectable()
export class TraceDedupService {
  async buildDedupContext(
    turnRepo: Repository<AgentMessage>,
    spans: OtlpSpan[],
    spanMap: Map<string, SpanEntry>,
    ghostSpanIds: Set<string>,
    fallbackSkipIds: Set<string>,
    ctx: IngestionContext,
  ): Promise<DedupContext> {
    // Collect trace IDs from agent_message spans that need dedup
    const traceIds: string[] = [];
    for (const span of spans) {
      const spanId = toHexString(span.spanId);
      const entry = spanMap.get(spanId);
      if (entry?.type !== 'agent_message') continue;
      if (ghostSpanIds.has(spanId) || fallbackSkipIds.has(spanId)) continue;
      const traceId = toHexString(span.traceId);
      if (traceId) traceIds.push(traceId);
    }

    // Batch fetch all dedup data in parallel
    const [errorByTrace, successByTrace, recentErrors, recentOkMessages, recentMessages] =
      await Promise.all([
        traceIds.length > 0
          ? turnRepo.find({
              where: {
                trace_id: In(traceIds),
                tenant_id: ctx.tenantId,
                status: In(['error', 'rate_limited']),
              },
              select: ['id', 'trace_id'],
            })
          : Promise.resolve([]),
        traceIds.length > 0
          ? turnRepo.find({
              where: {
                trace_id: In(traceIds),
                tenant_id: ctx.tenantId,
                status: 'ok',
              },
              select: ['id', 'trace_id'],
            })
          : Promise.resolve([]),
        turnRepo.find({
          where: {
            tenant_id: ctx.tenantId,
            agent_id: ctx.agentId,
            status: In(['error', 'rate_limited']),
          },
          select: ['id', 'timestamp'],
          order: { timestamp: 'DESC' },
          take: 10,
        }),
        turnRepo.find({
          where: { tenant_id: ctx.tenantId, agent_id: ctx.agentId, status: 'ok' },
          select: ['id', 'timestamp', 'input_tokens'],
          order: { timestamp: 'DESC' },
          take: 10,
        }),
        turnRepo.find({
          where: { tenant_id: ctx.tenantId, agent_id: ctx.agentId },
          select: ['id', 'timestamp', 'input_tokens', 'output_tokens', 'model', 'session_key'],
          order: { timestamp: 'DESC' },
          take: 10,
        }),
      ]);

    return {
      errorTraceIds: new Set(
        errorByTrace.map((e) => e.trace_id).filter((id): id is string => id != null),
      ),
      successTraceIds: new Set(
        successByTrace.map((e) => e.trace_id).filter((id): id is string => id != null),
      ),
      recentErrors: recentErrors.map((e) => ({ id: e.id, timestamp: e.timestamp })),
      recentOkMessages: recentOkMessages.map((m) => ({
        id: m.id,
        timestamp: m.timestamp,
        input_tokens: m.input_tokens ?? 0,
      })),
      recentMessages: recentMessages.map((m) => ({
        id: m.id,
        timestamp: m.timestamp,
        input_tokens: m.input_tokens ?? 0,
        output_tokens: m.output_tokens ?? 0,
        model: m.model ?? null,
        session_key: m.session_key ?? null,
      })),
    };
  }
}
