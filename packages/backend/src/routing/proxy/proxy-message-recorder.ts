import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AgentMessage } from '../../entities/agent-message.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
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

  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    private readonly pricingCache: ModelPricingCacheService,
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
      error_message: errorMessage.slice(0, 500),
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
    });
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
        error_message: f.errorBody.slice(0, 500),
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
      });
    }
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
      error_message: errorBody.slice(0, 500),
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
    });
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
  ): Promise<void> {
    let costUsd: number | null = null;
    if (authType === 'subscription') {
      costUsd = 0;
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
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      cost_usd: costUsd,
      auth_type: authType ?? null,
      fallback_from_model: fallbackFromModel ?? null,
      fallback_index: fallbackIndex ?? null,
    });
  }

  async recordSuccessMessage(
    ctx: IngestionContext,
    model: string,
    tier: string,
    reason: string,
    usage: StreamUsage,
    traceId?: string,
    authType?: string,
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

    await this.messageRepo.insert({
      id: uuid(),
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      trace_id: traceId ?? null,
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
    });
  }

  private evictExpiredCooldowns(): void {
    const now = Date.now();
    for (const [k, v] of this.rateLimitCooldown) {
      if (now - v >= this.RATE_LIMIT_COOLDOWN_MS) this.rateLimitCooldown.delete(k);
    }
  }
}
