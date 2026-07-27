import { Injectable } from '@nestjs/common';
import { EntityManager, In, Repository } from 'typeorm';
import { AgentMessage } from '../../entities/agent-message.entity';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { StreamUsage } from './stream-writer';

// A prior success may have been written as legacy `ok` or canonical `success`
// (rolling deploy / in-flight status backfill), so dedup must match either.
const SUCCESS_STATUS_MATCH = In(['ok', 'success']);

export const SUCCESS_SESSION_DEDUP_WINDOW_MS = 30_000;
export const SUCCESS_END_TIME_GRACE_MS = 5_000;

export type DedupMatch = Pick<
  AgentMessage,
  | 'id'
  | 'timestamp'
  | 'input_tokens'
  | 'output_tokens'
  | 'cache_read_tokens'
  | 'cache_creation_tokens'
  | 'duration_ms'
>;

const DEDUP_SELECT: Array<keyof AgentMessage> = [
  'id',
  'timestamp',
  'input_tokens',
  'output_tokens',
  'cache_read_tokens',
  'cache_creation_tokens',
  'duration_ms',
];

@Injectable()
export class ProxyMessageDedup {
  private readonly successWriteLocks = new Map<string, Promise<void>>();

  async findExistingSuccessMessage(
    messageRepo: Repository<AgentMessage>,
    ctx: IngestionContext,
    model: string,
    usage: StreamUsage,
    traceId?: string,
    sessionKey?: string | null,
    requestId?: string,
  ): Promise<DedupMatch | null> {
    if (requestId) {
      const existing = await messageRepo.findOne({
        where: {
          tenant_id: ctx.tenantId,
          request_id: requestId,
          status: SUCCESS_STATUS_MATCH,
        },
        select: DEDUP_SELECT,
        order: { timestamp: 'DESC' },
      });
      if (existing) return existing;
    }

    if (traceId) {
      const existing = await messageRepo.findOne({
        where: {
          tenant_id: ctx.tenantId,
          agent_id: ctx.agentId,
          trace_id: traceId,
          status: SUCCESS_STATUS_MATCH,
        },
        select: DEDUP_SELECT,
        order: { timestamp: 'DESC' },
      });
      if (existing) return existing;
    }

    const now = Date.now();
    const recentByModel = await messageRepo.find({
      where: {
        tenant_id: ctx.tenantId,
        agent_id: ctx.agentId,
        model,
        status: SUCCESS_STATUS_MATCH,
        ...(sessionKey ? { session_key: sessionKey } : {}),
      },
      select: DEDUP_SELECT,
      order: { timestamp: 'DESC' },
      take: 10,
    });

    return (
      recentByModel.find((row) => {
        const rowTime = new Date(row.timestamp).getTime();
        const durationMs = row.duration_ms ?? null;
        if (
          Number.isNaN(rowTime) ||
          durationMs == null ||
          now - rowTime > SUCCESS_SESSION_DEDUP_WINDOW_MS
        ) {
          return false;
        }
        // agent_messages.input_tokens already stores the chat-shape prompt_tokens
        // (total input including cache reads + creation). Comparing the column
        // directly avoids double-counting the cache portions which are reported
        // separately in cache_read_tokens / cache_creation_tokens.
        const endTimeDelta = Math.abs(now - rowTime - durationMs);
        return (
          (row.input_tokens ?? 0) === usage.prompt_tokens &&
          (row.output_tokens ?? 0) === usage.completion_tokens &&
          endTimeDelta <= SUCCESS_END_TIME_GRACE_MS
        );
      }) ?? null
    );
  }

  normalizeSessionKey(sessionKey?: string | null): string | null {
    if (!sessionKey || sessionKey === 'default') return null;
    return sessionKey;
  }

  getSuccessWriteLockKey(
    ctx: IngestionContext,
    model: string,
    traceId?: string,
    sessionKey?: string | null,
    requestId?: string,
  ): string {
    if (requestId) return `request:${requestId}`;
    if (traceId) return `trace:${ctx.tenantId}:${ctx.agentId}:${traceId}`;
    return `success:${ctx.tenantId}:${ctx.agentId}:${sessionKey ?? 'no-session'}:${model}`;
  }

  async withSuccessWriteLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.successWriteLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.catch(() => undefined).then(() => current);
    this.successWriteLocks.set(key, queued);
    await previous.catch(() => undefined);

    try {
      return await fn();
    } finally {
      release();
      if (this.successWriteLocks.get(key) === queued) {
        this.successWriteLocks.delete(key);
      }
    }
  }

  async withAgentMessageTransaction<T>(
    messageRepo: Repository<AgentMessage>,
    ctx: IngestionContext,
    fn: (txRepo: Repository<AgentMessage>) => Promise<T>,
  ): Promise<T> {
    return messageRepo.manager.transaction(async (manager) => {
      await this.lockAgentMessageWrites(manager, ctx.agentId);
      return fn(manager.getRepository(AgentMessage));
    });
  }

  private async lockAgentMessageWrites(manager: EntityManager, agentId: string): Promise<void> {
    await manager.query('SELECT id FROM agents WHERE id = $1 FOR UPDATE', [agentId]);
  }
}
