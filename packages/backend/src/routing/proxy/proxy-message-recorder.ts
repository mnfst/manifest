import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AgentMessage } from '../../entities/agent-message.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { IngestEventBusService } from '../../common/services/ingest-event-bus.service';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { FailedFallback } from './proxy-fallback.service';
import { StreamUsage } from './stream-writer';
import { ProxyMessageDedup } from './proxy-message-dedup';
import { computeTokenCost } from '../../common/utils/cost-calculator';
import { scrubSecrets } from '../../common/utils/secret-scrub';
import { CallerAttribution } from './caller-classifier';
import { CustomProviderService } from '../custom-provider/custom-provider.service';

export interface HeaderTierRef {
  headerTierId?: string | null;
  headerTierName?: string | null;
  headerTierColor?: string | null;
}

export interface ProviderErrorOpts extends HeaderTierRef {
  model?: string;
  provider?: string;
  tier?: string;
  traceId?: string;
  fallbackFromModel?: string;
  fallbackIndex?: number;
  authType?: string;
  /**
   * Why the tier was selected (e.g. 'header-match', 'specificity', 'scored').
   * Persisted to agent_messages.routing_reason so single-shot upstream errors
   * keep the same audit context as their successful siblings.
   */
  reason?: string;
  specificityCategory?: string;
  callerAttribution?: CallerAttribution | null;
  requestHeaders?: Record<string, string> | null;
}

export interface FallbackSuccessOpts extends HeaderTierRef {
  traceId?: string;
  provider?: string;
  fallbackFromModel?: string;
  fallbackIndex?: number;
  timestamp?: string;
  authType?: string;
  /**
   * Why the primary tier was selected (e.g. 'header-match', 'specificity',
   * 'scored'). Persisted to agent_messages.routing_reason so fallback rows
   * keep the same audit context as their non-fallback siblings.
   */
  reason?: string;
  usage?: StreamUsage;
  callerAttribution?: CallerAttribution | null;
  requestHeaders?: Record<string, string> | null;
}

export interface SuccessMessageOpts extends HeaderTierRef {
  traceId?: string;
  provider?: string;
  authType?: string;
  sessionKey?: string;
  durationMs?: number;
  specificityCategory?: string;
  callerAttribution?: CallerAttribution | null;
  requestHeaders?: Record<string, string> | null;
}

function buildMessageRow(
  ctx: IngestionContext,
  overrides: Partial<AgentMessage>,
): Partial<AgentMessage> {
  return {
    id: uuid(),
    tenant_id: ctx.tenantId,
    agent_id: ctx.agentId,
    agent_name: ctx.agentName,
    user_id: ctx.userId,
    trace_id: null,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    ...overrides,
  };
}

@Injectable()
export class ProxyMessageRecorder implements OnModuleDestroy {
  private readonly rateLimitCooldown = new Map<string, number>();
  private readonly RATE_LIMIT_COOLDOWN_MS = 60_000;
  private readonly MAX_COOLDOWN_ENTRIES = 1_000;
  private readonly cooldownCleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly dedup: ProxyMessageDedup,
    private readonly eventBus: IngestEventBusService,
    private readonly customProviders: CustomProviderService,
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
    opts?: ProviderErrorOpts,
  ): Promise<void> {
    const {
      model,
      provider,
      tier,
      traceId,
      fallbackFromModel,
      fallbackIndex,
      authType,
      reason,
      specificityCategory,
      callerAttribution,
      requestHeaders,
      headerTierId,
      headerTierName,
      headerTierColor,
    } = opts ?? {};

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

    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.agentId,
      provider,
      model,
    );

    await this.messageRepo.insert(
      buildMessageRow(ctx, {
        trace_id: traceId ?? null,
        timestamp: new Date().toISOString(),
        status: messageStatus,
        error_message: scrubSecrets(errorMessage).slice(0, 2000),
        error_http_status: httpStatus,
        model: canonical.model,
        provider: canonical.provider,
        routing_tier: tier ?? null,
        routing_reason: reason ?? null,
        fallback_from_model: fallbackFromModel ?? null,
        fallback_index: fallbackIndex ?? null,
        auth_type: authType ?? null,
        specificity_category: specificityCategory ?? null,
        caller_attribution: callerAttribution ?? null,
        request_headers: requestHeaders ?? null,
        header_tier_id: headerTierId ?? null,
        header_tier_name: headerTierName ?? null,
        header_tier_color: headerTierColor ?? null,
      }),
    );
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
      reason?: string;
      callerAttribution?: CallerAttribution | null;
      requestHeaders?: Record<string, string> | null;
      headerTierId?: string | null;
      headerTierName?: string | null;
      headerTierColor?: string | null;
    },
  ): Promise<void> {
    const {
      traceId,
      baseTimeMs,
      markHandled = false,
      lastAsError = false,
      authType,
      reason,
      callerAttribution,
      requestHeaders,
      headerTierId,
      headerTierName,
      headerTierColor,
    } = opts ?? {};
    // primaryModel is loop-invariant — canonicalize once.
    const canonicalPrimary = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.agentId,
      null,
      primaryModel,
    );
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
      const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
        ctx.agentId,
        f.provider,
        f.model,
      );
      await this.messageRepo.insert(
        buildMessageRow(ctx, {
          trace_id: traceId ?? null,
          timestamp: ts,
          status,
          error_message: scrubSecrets(f.errorBody).slice(0, 2000),
          error_http_status: f.status,
          model: canonical.model,
          provider: canonical.provider,
          routing_tier: tier,
          routing_reason: reason ?? null,
          fallback_from_model: canonicalPrimary.model,
          fallback_index: f.fallbackIndex,
          auth_type: authType ?? null,
          caller_attribution: callerAttribution ?? null,
          request_headers: requestHeaders ?? null,
          header_tier_id: headerTierId ?? null,
          header_tier_name: headerTierName ?? null,
          header_tier_color: headerTierColor ?? null,
        }),
      );
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
    opts?: {
      provider?: string;
      reason?: string;
      callerAttribution?: CallerAttribution | null;
      requestHeaders?: Record<string, string> | null;
      headerTierId?: string | null;
      headerTierName?: string | null;
      headerTierColor?: string | null;
    },
  ): Promise<void> {
    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.agentId,
      opts?.provider,
      model,
    );
    await this.messageRepo.insert(
      buildMessageRow(ctx, {
        timestamp,
        status: 'fallback_error',
        error_message: errorBody.slice(0, 2000),
        model: canonical.model,
        provider: canonical.provider,
        routing_tier: tier,
        routing_reason: opts?.reason ?? null,
        fallback_from_model: null,
        fallback_index: null,
        auth_type: authType ?? null,
        caller_attribution: opts?.callerAttribution ?? null,
        request_headers: opts?.requestHeaders ?? null,
        header_tier_id: opts?.headerTierId ?? null,
        header_tier_name: opts?.headerTierName ?? null,
        header_tier_color: opts?.headerTierColor ?? null,
      }),
    );
    this.eventBus.emit(ctx.userId);
  }

  async recordFallbackSuccess(
    ctx: IngestionContext,
    model: string,
    tier: string,
    opts?: FallbackSuccessOpts,
  ): Promise<void> {
    const {
      traceId,
      provider,
      fallbackFromModel,
      fallbackIndex,
      timestamp,
      authType,
      reason,
      usage,
      callerAttribution,
      requestHeaders,
      headerTierId,
      headerTierName,
      headerTierColor,
    } = opts ?? {};

    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;

    const costUsd = computeTokenCost({
      inputTokens,
      outputTokens,
      model,
      pricing: usage ? this.pricingCache.getByModel(model) : undefined,
      isSubscription: authType === 'subscription',
    });

    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.agentId,
      provider,
      model,
    );
    const canonicalFallbackFrom = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.agentId,
      null,
      fallbackFromModel,
    );

    await this.messageRepo.insert(
      buildMessageRow(ctx, {
        trace_id: traceId ?? null,
        timestamp: timestamp ?? new Date().toISOString(),
        status: 'ok',
        model: canonical.model,
        provider: canonical.provider,
        routing_tier: tier,
        routing_reason: reason ?? null,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_tokens: usage?.cache_read_tokens ?? 0,
        cache_creation_tokens: usage?.cache_creation_tokens ?? 0,
        cost_usd: costUsd,
        auth_type: authType ?? null,
        fallback_from_model: canonicalFallbackFrom.model,
        fallback_index: fallbackIndex ?? null,
        caller_attribution: callerAttribution ?? null,
        request_headers: requestHeaders ?? null,
        header_tier_id: headerTierId ?? null,
        header_tier_name: headerTierName ?? null,
        header_tier_color: headerTierColor ?? null,
      }),
    );
    this.eventBus.emit(ctx.userId);
  }

  async recordSuccessMessage(
    ctx: IngestionContext,
    model: string,
    tier: string,
    reason: string,
    usage: StreamUsage,
    opts?: SuccessMessageOpts,
  ): Promise<void> {
    const {
      traceId,
      provider,
      authType,
      sessionKey,
      durationMs,
      specificityCategory,
      callerAttribution,
      requestHeaders,
      headerTierId,
      headerTierName,
      headerTierColor,
    } = opts ?? {};

    const costUsd = computeTokenCost({
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      model,
      pricing: this.pricingCache.getByModel(model),
      isSubscription: authType === 'subscription',
    });

    // `model` is a required string, so the overload on
    // `canonicalizeAgentMessageKeys` keeps `canonical.model` non-null.
    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.agentId,
      provider,
      model,
    );
    const canonicalModel = canonical.model;
    const canonicalProvider = canonical.provider;

    const normalizedSessionKey = this.dedup.normalizeSessionKey(sessionKey);

    let wrote = false;
    await this.dedup.withSuccessWriteLock(
      this.dedup.getSuccessWriteLockKey(ctx, canonicalModel, traceId, normalizedSessionKey),
      async () => {
        await this.dedup.withAgentMessageTransaction(this.messageRepo, ctx, async (messageRepo) => {
          const existing = await this.dedup.findExistingSuccessMessage(
            messageRepo,
            ctx,
            canonicalModel,
            usage,
            traceId,
            normalizedSessionKey,
          );

          if (existing) {
            const hasRecordedTokens =
              (existing.input_tokens ?? 0) > 0 || (existing.output_tokens ?? 0) > 0;
            if (hasRecordedTokens) return;

            const updatePayload: Partial<AgentMessage> = {
              model: canonicalModel,
              provider: canonicalProvider,
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
              specificity_category: specificityCategory ?? null,
              caller_attribution: callerAttribution ?? null,
              request_headers: requestHeaders ?? null,
              header_tier_id: headerTierId ?? null,
              header_tier_name: headerTierName ?? null,
              header_tier_color: headerTierColor ?? null,
            };
            if (normalizedSessionKey) updatePayload.session_key = normalizedSessionKey;

            await messageRepo.update({ id: existing.id }, updatePayload);
            wrote = true;
            return;
          }

          await messageRepo.insert(
            buildMessageRow(ctx, {
              trace_id: traceId ?? null,
              session_key: normalizedSessionKey,
              timestamp: new Date().toISOString(),
              status: 'ok',
              model: canonicalModel,
              provider: canonicalProvider,
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
              duration_ms: durationMs ?? null,
              specificity_category: specificityCategory ?? null,
              caller_attribution: callerAttribution ?? null,
              request_headers: requestHeaders ?? null,
              header_tier_id: headerTierId ?? null,
              header_tier_name: headerTierName ?? null,
              header_tier_color: headerTierColor ?? null,
            }),
          );
          wrote = true;
        });
      },
    );
    if (wrote) this.eventBus.emit(ctx.userId);
  }

  private evictExpiredCooldowns(): void {
    const now = Date.now();
    for (const [k, v] of this.rateLimitCooldown) {
      if (now - v >= this.RATE_LIMIT_COOLDOWN_MS) this.rateLimitCooldown.delete(k);
    }
  }
}
