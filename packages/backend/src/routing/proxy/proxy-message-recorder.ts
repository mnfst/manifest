import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AgentMessage } from '../../entities/agent-message.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { IngestEventBusService } from '../../common/services/ingest-event-bus.service';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { FailedFallback } from './proxy.service';
import { StreamUsage } from './stream-writer';

@Injectable()
export class ProxyMessageRecorder implements OnModuleDestroy {
  private readonly logger = new Logger(ProxyMessageRecorder.name);
  private readonly rateLimitCooldown = new Map<string, number>();
  private readonly RATE_LIMIT_COOLDOWN_MS = 60_000;
  private readonly MAX_COOLDOWN_ENTRIES = 1_000;
  private readonly cooldownCleanupTimer: ReturnType<typeof setInterval>;
  private readonly successWriteLocks = new Map<string, Promise<void>>();
  private readonly SUCCESS_SESSION_DEDUP_WINDOW_MS = 30_000;
  private readonly SUCCESS_END_TIME_GRACE_MS = 5_000;

  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly eventBus: IngestEventBusService,
  ) {
    this.cooldownCleanupTimer = setInterval(() => this.evictExpiredCooldowns(), 60_000);
    if (typeof this.cooldownCleanupTimer === 'object' && 'unref' in this.cooldownCleanupTimer) {
      this.cooldownCleanupTimer.unref();
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cooldownCleanupTimer);
  }

  async recordProviderError(
    ctx: IngestionContext,
    httpStatus: number,
    errorMessage: string,
    model?: string,
    tier?: string,
    traceId?: string,
    fallbackFromModel?: string,
    fallbackIndex?: number,
    authType?: string,
  ): Promise<void> {
    if (httpStatus === 429) {
      const key = `${ctx.tenantId}:${ctx.agentId}`;
      const now = Date.now();
      const lastRecorded = this.rateLimitCooldown.get(key) ?? 0;
      if (now - lastRecorded < this.RATE_LIMIT_COOLDOWN_MS) return;
      this.rateLimitCooldown.set(key, now);

      if (this.rateLimitCooldown.size > this.MAX_COOLDOWN_ENTRIES) {
        for (const [k, v] of this.rateLimitCooldown) {
          if (now - v >= this.RATE_LIMIT_COOLDOWN_MS) this.rateLimitCooldown.delete(k);
        }
      }
    }

    const messageStatus = httpStatus === 429 ? 'rate_limited' : 'error';

    await this.messageRepo.insert({
      id: uuid(),
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      trace_id: traceId ?? null,
      timestamp: new Date().toISOString(),
      status: messageStatus,
      error_message: errorMessage.slice(0, 2000),
      agent_name: ctx.agentName,
      model: model ?? null,
      routing_tier: tier ?? null,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      fallback_from_model: fallbackFromModel ?? null,
      fallback_index: fallbackIndex ?? null,
      auth_type: authType ?? null,
      user_id: ctx.userId,
    });
    this.eventBus.emit(ctx.userId);
  }

  async recordFailedFallbacks(
    ctx: IngestionContext,
    tier: string,
    primaryModel: string,
    failures: FailedFallback[],
    opts?: {
      traceId?: string;
      baseTimeMs?: number;
      markHandled?: boolean;
      lastAsError?: boolean;
      authType?: string;
    },
  ): Promise<void> {
    const { traceId, baseTimeMs, markHandled = false, lastAsError = false, authType } = opts ?? {};
    for (let i = 0; i < failures.length; i++) {
      const f = failures[i];
      const ts = baseTimeMs
        ? new Date(baseTimeMs + (failures.length - i) * 100).toISOString()
        : new Date().toISOString();
      const isLast = i === failures.length - 1;
      const useHandledStatus = markHandled && !(lastAsError && isLast);
      const status = useHandledStatus
        ? 'fallback_error'
        : f.status === 429
          ? 'rate_limited'
          : 'error';
      await this.messageRepo.insert({
        id: uuid(),
        tenant_id: ctx.tenantId,
        agent_id: ctx.agentId,
        trace_id: traceId ?? null,
        timestamp: ts,
        status,
        error_message: f.errorBody.slice(0, 2000),
        agent_name: ctx.agentName,
        model: f.model,
        routing_tier: tier,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        fallback_from_model: primaryModel,
        fallback_index: f.fallbackIndex,
        auth_type: authType ?? null,
        user_id: ctx.userId,
      });
    }
    this.eventBus.emit(ctx.userId);
  }

  async recordPrimaryFailure(
    ctx: IngestionContext,
    tier: string,
    model: string,
    errorBody: string,
    timestamp: string,
    authType?: string,
  ): Promise<void> {
    await this.messageRepo.insert({
      id: uuid(),
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      trace_id: null,
      timestamp,
      status: 'fallback_error',
      error_message: errorBody.slice(0, 2000),
      agent_name: ctx.agentName,
      model,
      routing_tier: tier,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      fallback_from_model: null,
      fallback_index: null,
      auth_type: authType ?? null,
      user_id: ctx.userId,
    });
    this.eventBus.emit(ctx.userId);
  }

  async recordFallbackSuccess(
    ctx: IngestionContext,
    model: string,
    tier: string,
    traceId?: string,
    fallbackFromModel?: string,
    fallbackIndex?: number,
    timestamp?: string,
    authType?: string,
    usage?: StreamUsage,
  ): Promise<void> {
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;

    let costUsd: number | null = null;
    if (authType === 'subscription') {
      costUsd = 0;
    } else if (usage) {
      const pricing = this.pricingCache.getByModel(model);
      if (pricing?.input_price_per_token != null && pricing?.output_price_per_token != null) {
        costUsd =
          inputTokens * Number(pricing.input_price_per_token) +
          outputTokens * Number(pricing.output_price_per_token);
      }
    }

    await this.messageRepo.insert({
      id: uuid(),
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      trace_id: traceId ?? null,
      timestamp: timestamp ?? new Date().toISOString(),
      status: 'ok',
      agent_name: ctx.agentName,
      model,
      routing_tier: tier,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_tokens: usage?.cache_read_tokens ?? 0,
      cache_creation_tokens: usage?.cache_creation_tokens ?? 0,
      cost_usd: costUsd,
      auth_type: authType ?? null,
      fallback_from_model: fallbackFromModel ?? null,
      fallback_index: fallbackIndex ?? null,
    });
    this.eventBus.emit(ctx.userId);
  }

  async recordSuccessMessage(
    ctx: IngestionContext,
    model: string,
    tier: string,
    reason: string,
    usage: StreamUsage,
    traceId?: string,
    authType?: string,
    sessionKey?: string,
    durationMs?: number,
  ): Promise<void> {
    if (usage.prompt_tokens === 0 && usage.completion_tokens === 0) return;

    let costUsd: number | null = null;
    if (authType === 'subscription') {
      costUsd = 0;
    } else {
      const pricing = this.pricingCache.getByModel(model);
      if (pricing?.input_price_per_token != null && pricing?.output_price_per_token != null) {
        costUsd =
          usage.prompt_tokens * Number(pricing.input_price_per_token) +
          usage.completion_tokens * Number(pricing.output_price_per_token);
      }
    }

    const normalizedSessionKey = this.normalizeSessionKey(sessionKey);

    await this.withSuccessWriteLock(
      this.getSuccessWriteLockKey(ctx, model, traceId, normalizedSessionKey),
      async () => {
        await this.withAgentMessageTransaction(ctx, async (messageRepo) => {
          const existing = await this.findExistingSuccessMessage(
            messageRepo,
            ctx,
            model,
            usage,
            traceId,
            normalizedSessionKey,
          );

          if (existing) {
            const hasRecordedTokens =
              (existing.input_tokens ?? 0) > 0 || (existing.output_tokens ?? 0) > 0;
            if (hasRecordedTokens) return;

            const updatePayload: Partial<AgentMessage> = {
              model,
              routing_tier: tier,
              routing_reason: reason,
              input_tokens: usage.prompt_tokens,
              output_tokens: usage.completion_tokens,
              cache_read_tokens: usage.cache_read_tokens ?? 0,
              cache_creation_tokens: usage.cache_creation_tokens ?? 0,
              cost_usd: costUsd,
              auth_type: authType ?? null,
              user_id: ctx.userId,
              duration_ms: durationMs ?? null,
            };
            if (normalizedSessionKey) updatePayload.session_key = normalizedSessionKey;

            await messageRepo.update({ id: existing.id }, updatePayload);
            this.eventBus.emit(ctx.userId);
            return;
          }

          await messageRepo.insert({
            id: uuid(),
            tenant_id: ctx.tenantId,
            agent_id: ctx.agentId,
            trace_id: traceId ?? null,
            session_key: normalizedSessionKey,
            timestamp: new Date().toISOString(),
            status: 'ok',
            agent_name: ctx.agentName,
            model,
            routing_tier: tier,
            routing_reason: reason,
            input_tokens: usage.prompt_tokens,
            output_tokens: usage.completion_tokens,
            cache_read_tokens: usage.cache_read_tokens ?? 0,
            cache_creation_tokens: usage.cache_creation_tokens ?? 0,
            cost_usd: costUsd,
            auth_type: authType ?? null,
            fallback_from_model: null,
            fallback_index: null,
            user_id: ctx.userId,
            duration_ms: durationMs ?? null,
          });
          this.eventBus.emit(ctx.userId);
        });
      },
    );
  }

  private async findExistingSuccessMessage(
    messageRepo: Repository<AgentMessage>,
    ctx: IngestionContext,
    model: string,
    usage: StreamUsage,
    traceId?: string,
    sessionKey?: string | null,
  ): Promise<Pick<
    AgentMessage,
    | 'id'
    | 'timestamp'
    | 'input_tokens'
    | 'output_tokens'
    | 'cache_read_tokens'
    | 'cache_creation_tokens'
    | 'duration_ms'
  > | null> {
    if (traceId) {
      const existing = await messageRepo.findOne({
        where: {
          tenant_id: ctx.tenantId,
          agent_id: ctx.agentId,
          trace_id: traceId,
          status: 'ok',
        },
        select: [
          'id',
          'timestamp',
          'input_tokens',
          'output_tokens',
          'cache_read_tokens',
          'cache_creation_tokens',
          'duration_ms',
        ],
        order: { timestamp: 'DESC' },
      });
      if (existing) return existing;
    }

    const now = Date.now();
    const recentByModel = await messageRepo.find({
      where: {
        tenant_id: ctx.tenantId,
        agent_id: ctx.agentId,
        user_id: ctx.userId,
        model,
        status: 'ok',
        ...(sessionKey ? { session_key: sessionKey } : {}),
      },
      select: [
        'id',
        'timestamp',
        'input_tokens',
        'output_tokens',
        'cache_read_tokens',
        'cache_creation_tokens',
        'duration_ms',
      ],
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
          now - rowTime > this.SUCCESS_SESSION_DEDUP_WINDOW_MS
        ) {
          return false;
        }
        const totalPromptTokens =
          (row.input_tokens ?? 0) + (row.cache_read_tokens ?? 0) + (row.cache_creation_tokens ?? 0);
        const endTimeDelta = Math.abs(now - rowTime - durationMs);
        return (
          totalPromptTokens === usage.prompt_tokens &&
          (row.output_tokens ?? 0) === usage.completion_tokens &&
          endTimeDelta <= this.SUCCESS_END_TIME_GRACE_MS
        );
      }) ?? null
    );
  }

  private normalizeSessionKey(sessionKey?: string | null): string | null {
    if (!sessionKey || sessionKey === 'default') return null;
    return sessionKey;
  }

  private async withAgentMessageTransaction<T>(
    ctx: IngestionContext,
    fn: (messageRepo: Repository<AgentMessage>) => Promise<T>,
  ): Promise<T> {
    return this.messageRepo.manager.transaction(async (manager) => {
      await this.lockAgentMessageWrites(manager, ctx.agentId);
      return fn(manager.getRepository(AgentMessage));
    });
  }

  private async lockAgentMessageWrites(manager: EntityManager, agentId: string): Promise<void> {
    if (manager.connection.options.type !== 'postgres') return;
    await manager.query('SELECT id FROM agents WHERE id = $1 FOR UPDATE', [agentId]);
  }

  private getSuccessWriteLockKey(
    ctx: IngestionContext,
    model: string,
    traceId?: string,
    sessionKey?: string | null,
  ): string {
    if (traceId) return `trace:${ctx.tenantId}:${ctx.agentId}:${traceId}`;
    return `success:${ctx.tenantId}:${ctx.agentId}:${ctx.userId}:${sessionKey ?? 'no-session'}:${model}`;
  }

  private async withSuccessWriteLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
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

  private evictExpiredCooldowns(): void {
    const now = Date.now();
    for (const [k, v] of this.rateLimitCooldown) {
      if (now - v >= this.RATE_LIMIT_COOLDOWN_MS) this.rateLimitCooldown.delete(k);
    }
  }
}
