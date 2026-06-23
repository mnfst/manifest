import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import type { RequestParamDefaults } from 'manifest-shared';
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
import { OpencodeGoCatalogService } from '../../model-discovery/opencode-go-catalog.service';
import { PROVIDER_BY_ID_OR_ALIAS } from '../../common/constants/providers';

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
  providerKeyLabel?: string;
  /**
   * The tenant_providers row (connection/key) that served this message.
   * Persisted to agent_messages.tenant_provider_id so per-connection analytics
   * scope by the exact key rather than the non-unique provider/auth/label tuple.
   */
  tenantProviderId?: string | null;
  callerAttribution?: CallerAttribution | null;
  requestHeaders?: Record<string, string> | null;
  /**
   * Snapshot of effective request body parameters merged into the outbound
   * provider request. Persisted to `agent_messages.request_params`.
   */
  requestParams?: RequestParamDefaults | null;
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
  providerKeyLabel?: string;
  /**
   * The tenant_providers row (connection/key) that served this message.
   * Persisted to agent_messages.tenant_provider_id so per-connection analytics
   * scope by the exact key rather than the non-unique provider/auth/label tuple.
   */
  tenantProviderId?: string | null;
  usage?: StreamUsage;
  callerAttribution?: CallerAttribution | null;
  requestHeaders?: Record<string, string> | null;
  /**
   * Snapshot of effective request body parameters (today: DeepSeek
   * `thinking`) merged into the outbound provider request. `null` when no
   * known params apply. Persisted to `agent_messages.request_params`.
   */
  requestParams?: RequestParamDefaults | null;
}

export interface SuccessMessageOpts extends HeaderTierRef {
  traceId?: string;
  provider?: string;
  authType?: string;
  sessionKey?: string;
  durationMs?: number;
  specificityCategory?: string;
  providerKeyLabel?: string;
  /**
   * The tenant_providers row (connection/key) that served this message.
   * Persisted to agent_messages.tenant_provider_id so per-connection analytics
   * scope by the exact key rather than the non-unique provider/auth/label tuple.
   */
  tenantProviderId?: string | null;
  callerAttribution?: CallerAttribution | null;
  requestHeaders?: Record<string, string> | null;
  requestParams?: RequestParamDefaults | null;
}

/**
 * Reasons that mark a `recordSuccessMessage` call as a Manifest-generated
 * stub instead of a real upstream completion. The HTTP envelope is 200 OK
 * (so the chat client renders the canned `[🦚 Manifest] …` text), but the
 * dashboard should classify the row as failed and surface why.
 */
const CANNED_RESPONSE_REASONS: Record<string, string> = {
  no_provider: 'No providers configured for this agent',
  no_provider_key: 'Provider API key missing',
  limit_exceeded: 'Usage limit exceeded',
  friendly_error: 'Manifest internal error',
};

function buildMessageRow(
  ctx: IngestionContext,
  overrides: Partial<AgentMessage>,
): Partial<AgentMessage> {
  return {
    id: uuid(),
    tenant_id: ctx.tenantId,
    agent_id: ctx.agentId,
    agent_name: ctx.agentName,
    // Informational attribution only — never filtered on (see IngestionContext).
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
  private readonly logger = new Logger(ProxyMessageRecorder.name);
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
    private readonly opencodeGoCatalog: OpencodeGoCatalogService,
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
      providerKeyLabel,
      tenantProviderId,
      callerAttribution,
      requestHeaders,
      requestParams,
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
      ctx.tenantId,
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
        provider_key_label: providerKeyLabel ?? null,
        tenant_provider_id: tenantProviderId ?? null,
        caller_attribution: callerAttribution ?? null,
        request_headers: requestHeaders ?? null,
        request_params: requestParams ?? null,
        header_tier_id: headerTierId ?? null,
        header_tier_name: headerTierName ?? null,
        header_tier_color: headerTierColor ?? null,
      }),
    );
    this.eventBus.emit(ctx.tenantId, 'message', ctx.userId);
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
      requestParams?: RequestParamDefaults | null;
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
      requestParams,
      headerTierId,
      headerTierName,
      headerTierColor,
    } = opts ?? {};
    if (failures.length === 0) return;
    // primaryModel is loop-invariant — canonicalize once.
    const canonicalPrimary = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
      null,
      primaryModel,
    );
    const canonicalFailures = await Promise.all(
      failures.map((f) =>
        this.customProviders.canonicalizeAgentMessageKeys(ctx.tenantId, f.provider, f.model),
      ),
    );
    const rows: Partial<AgentMessage>[] = [];
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
      const canonical = canonicalFailures[i];
      // Prefer the per-failure auth_type when the proxy was able to record
      // it (fallback came from a structured ModelRoute, or the legacy
      // inference path tried a different credential than the primary).
      // Falling back to the primary auth keeps behavior identical for rows
      // that haven't been backfilled with routes.
      const recordedAuth = f.authType ?? authType ?? null;
      rows.push(
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
          auth_type: recordedAuth,
          // Per-failure connection: each failed fallback carries its own key id.
          tenant_provider_id: f.tenantProviderId ?? null,
          caller_attribution: callerAttribution ?? null,
          request_headers: requestHeaders ?? null,
          request_params: requestParams ?? null,
          header_tier_id: headerTierId ?? null,
          header_tier_name: headerTierName ?? null,
          header_tier_color: headerTierColor ?? null,
        }),
      );
    }
    await this.messageRepo.insert(rows);
    this.eventBus.emit(ctx.tenantId, 'message', ctx.userId);
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
      tenantProviderId?: string | null;
      callerAttribution?: CallerAttribution | null;
      requestHeaders?: Record<string, string> | null;
      requestParams?: RequestParamDefaults | null;
      headerTierId?: string | null;
      headerTierName?: string | null;
      headerTierColor?: string | null;
    },
  ): Promise<void> {
    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
      opts?.provider,
      model,
    );
    await this.messageRepo.insert(
      buildMessageRow(ctx, {
        timestamp,
        status: 'fallback_error',
        error_message: scrubSecrets(errorBody).slice(0, 2000),
        model: canonical.model,
        provider: canonical.provider,
        routing_tier: tier,
        routing_reason: opts?.reason ?? null,
        fallback_from_model: null,
        fallback_index: null,
        auth_type: authType ?? null,
        tenant_provider_id: opts?.tenantProviderId ?? null,
        caller_attribution: opts?.callerAttribution ?? null,
        request_headers: opts?.requestHeaders ?? null,
        request_params: opts?.requestParams ?? null,
        header_tier_id: opts?.headerTierId ?? null,
        header_tier_name: opts?.headerTierName ?? null,
        header_tier_color: opts?.headerTierColor ?? null,
      }),
    );
    this.eventBus.emit(ctx.tenantId, 'message', ctx.userId);
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
      providerKeyLabel,
      tenantProviderId,
      usage,
      callerAttribution,
      requestHeaders,
      requestParams,
      headerTierId,
      headerTierName,
      headerTierColor,
    } = opts ?? {};

    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;

    const costUsd = computeTokenCost({
      inputTokens,
      outputTokens,
      cacheReadTokens: usage?.cache_read_tokens ?? 0,
      cacheCreationTokens: usage?.cache_creation_tokens ?? 0,
      model,
      pricing: usage ? this.pricingCache.getByModel(model) : undefined,
      isSubscription: authType === 'subscription',
      perRequestCostUsd: await this.perRequestSubscriptionCost(provider, authType, model),
    });

    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
      provider,
      model,
    );
    const canonicalFallbackFrom = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
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
        provider_key_label: providerKeyLabel ?? null,
        tenant_provider_id: tenantProviderId ?? null,
        caller_attribution: callerAttribution ?? null,
        request_headers: requestHeaders ?? null,
        request_params: requestParams ?? null,
        header_tier_id: headerTierId ?? null,
        header_tier_name: headerTierName ?? null,
        header_tier_color: headerTierColor ?? null,
      }),
    );
    this.eventBus.emit(ctx.tenantId, 'message', ctx.userId);
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
      providerKeyLabel,
      tenantProviderId,
      callerAttribution,
      requestHeaders,
      requestParams,
      headerTierId,
      headerTierName,
      headerTierColor,
    } = opts ?? {};

    const costUsd = computeTokenCost({
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      cacheReadTokens: usage.cache_read_tokens ?? 0,
      cacheCreationTokens: usage.cache_creation_tokens ?? 0,
      model,
      pricing: this.pricingCache.getByModel(model),
      isSubscription: authType === 'subscription',
      perRequestCostUsd: await this.perRequestSubscriptionCost(provider, authType, model),
    });

    // `model` is a required string, so the overload on
    // `canonicalizeAgentMessageKeys` keeps `canonical.model` non-null.
    const canonical = await this.customProviders.canonicalizeAgentMessageKeys(
      ctx.tenantId,
      provider,
      model,
    );
    const canonicalModel = canonical.model;
    const canonicalProvider = canonical.provider;

    const normalizedSessionKey = this.dedup.normalizeSessionKey(sessionKey);

    const cannedMessage = CANNED_RESPONSE_REASONS[reason];
    const status = cannedMessage ? 'error' : 'ok';
    const errorMessage = cannedMessage ?? null;

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
              status,
              error_message: errorMessage,
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
              provider_key_label: providerKeyLabel ?? null,
              tenant_provider_id: tenantProviderId ?? null,
              caller_attribution: callerAttribution ?? null,
              request_headers: requestHeaders ?? null,
              request_params: requestParams ?? null,
              header_tier_id: headerTierId ?? null,
              header_tier_name: headerTierName ?? null,
              header_tier_color: headerTierColor ?? null,
            };
            if (normalizedSessionKey) updatePayload.session_key = normalizedSessionKey;

            await messageRepo.update({ id: existing.id }, updatePayload);
            wrote = true;
            return;
          }

          const newId = uuid();
          await messageRepo.insert(
            buildMessageRow(ctx, {
              id: newId,
              trace_id: traceId ?? null,
              session_key: normalizedSessionKey,
              timestamp: new Date().toISOString(),
              status,
              error_message: errorMessage,
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
              provider_key_label: providerKeyLabel ?? null,
              tenant_provider_id: tenantProviderId ?? null,
              caller_attribution: callerAttribution ?? null,
              request_headers: requestHeaders ?? null,
              request_params: requestParams ?? null,
              header_tier_id: headerTierId ?? null,
              header_tier_name: headerTierName ?? null,
              header_tier_color: headerTierColor ?? null,
            }),
          );
          wrote = true;
        });
      },
    );
    if (wrote) {
      this.eventBus.emit(ctx.tenantId, 'message', ctx.userId);
    }
  }

  /**
   * Resolve the per-request USD cost for subscription providers that bill
   * against a dollar quota (today: OpenCode Go). Returns `null` for every
   * other provider, leaving the existing "subscription → $0" path intact.
   * Canonicalizes the provider through the registry so aliases (e.g.
   * `opencodego`, `OpenCode-Go`) resolve identically. Awaits the catalog
   * `list()` once if its in-memory index is still cold so the first request
   * after a process restart doesn't undercount as $0.
   */
  private async perRequestSubscriptionCost(
    provider: string | null | undefined,
    authType: string | null | undefined,
    model: string | null | undefined,
  ): Promise<number | null> {
    if (authType !== 'subscription') return null;
    if (!provider) return null;
    const canonical = PROVIDER_BY_ID_OR_ALIAS.get(provider.toLowerCase())?.id;
    if (canonical !== 'opencode-go') return null;
    return this.opencodeGoCatalog.resolveCostPerRequest(model);
  }

  private evictExpiredCooldowns(): void {
    const now = Date.now();
    for (const [k, v] of this.rateLimitCooldown) {
      if (now - v >= this.RATE_LIMIT_COOLDOWN_MS) this.rateLimitCooldown.delete(k);
    }
  }
}
