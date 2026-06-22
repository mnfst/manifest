import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthType, ModelRoute } from 'manifest-shared';
import { applyRequestParamDefaults } from 'manifest-shared';
import { AgentModelParamsService } from '../routing-core/agent-model-params.service';
import { ProviderParamSpecService } from '../routing-core/provider-param-spec.service';

/**
 * Context for the per-attempt param-defaults merge. Carries the agentId so
 * `applyParamMerge` can ask the model-params service for the configuration
 * that belongs to this attempt's (provider, auth_type, model) tuple — not
 * the primary route's. Storage is model-scoped on the new
 * `agent_model_params` table, so cross-provider leak is structurally
 * impossible; we no longer need a provider-keyed filter, and Manifest's
 * old tier-aware opinion layer is gone too (only the user's explicit
 * config and the provider's natural default participate).
 */
export interface ParamMergeContext {
  agentId: string;
  scopeKey: string;
}

interface ForwardProviderOptions {
  provider: string;
  apiKey: string;
  model: string;
  body: Record<string, unknown>;
  chatBody?: Record<string, unknown>;
  stream: boolean;
  sessionKey: string;
  signal?: AbortSignal;
  authType?: string;
  rawApiKey?: string;
  providerKeyLabel?: string;
  agentId?: string;
  tenantId?: string;
  resourceUrl?: string;
  providerRegion?: string | null;
  apiMode?: ProxyApiMode;
  signatureLookup?: SignatureLookup;
  thinkingLookup?: ThinkingBlockLookup;
  reasoningContentLookup?: ReasoningContentLookup;
  paramMergeContext?: ParamMergeContext;
}

import {
  ProviderKeyService,
  SYNTHETIC_OLLAMA_PROVIDER_ID,
} from '../routing-core/provider-key.service';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { CustomProviderService } from '../custom-provider/custom-provider.service';
import { resolveForwardEndpoint } from './forward-endpoint-resolver';
import { OpenaiOauthService } from '../oauth/openai/openai-oauth.service';
import { MinimaxOauthService } from '../oauth/minimax/minimax-oauth.service';
import { AnthropicOauthService } from '../oauth/anthropic/anthropic-oauth.service';
import { GeminiOauthService } from '../oauth/gemini/gemini-oauth.service';
import { KiroOauthService } from '../oauth/kiro/kiro-oauth.service';
import { XaiOauthService } from '../oauth/xai/xai-oauth.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { ProviderClient, ForwardResult } from './provider-client';
import { resolveEndpointKey } from './provider-endpoints';
import { CopilotTokenService } from './copilot-token.service';
import { ReasoningContentCache } from './reasoning-content-cache';
import { buildProviderExtraHeaders } from './provider-hooks';
import { shouldTriggerFallback } from './fallback-status-codes';
import { inferProviderFromModelName } from '../../common/utils/provider-aliases';
import { normalizeAnthropicShortModelId } from '../../common/utils/anthropic-model-id';
import {
  isTransportError,
  buildTransportErrorResponse,
  describeTransportError,
} from './proxy-transport';
import type { SignatureLookup, ThinkingBlockLookup, ReasoningContentLookup } from './proxy-types';
import type { ProxyApiMode } from './proxy-types';
import {
  isRefreshableOAuthCredential,
  refreshRejectedOAuthCredential,
  resolveApiKey,
} from './oauth-credentials';

const RATE_LIMIT_COOLDOWN_DEFAULT_MS = 60_000;
const RATE_LIMIT_COOLDOWN_MAX_MS = 5 * 60_000;
const MAX_RATE_LIMIT_COOLDOWNS = 2_000;

export interface FailedFallback {
  model: string;
  provider: string;
  fallbackIndex: number;
  status: number;
  errorBody: string;
  // Auth used for this specific attempt. When the caller passes structured
  // routes the value is taken from the route; otherwise it falls back to the
  // legacy inference path. Either way the recorder can attribute the error
  // to the actual credential that failed instead of inheriting the primary's.
  authType?: AuthType;
  // The tenant_providers row that served this failed attempt, so the recorded
  // error row is scoped to the right connection. NULL for local/Ollama.
  tenantProviderId?: string | null;
}

@Injectable()
export class ProxyFallbackService {
  private readonly logger = new Logger(ProxyFallbackService.name);
  private readonly rateLimitCooldowns = new Map<string, number>();

  constructor(
    private readonly providerKeyService: ProviderKeyService,
    @InjectRepository(CustomProvider)
    private readonly customProviderRepo: Repository<CustomProvider>,
    private readonly openaiOauth: OpenaiOauthService,
    private readonly minimaxOauth: MinimaxOauthService,
    private readonly anthropicOauth: AnthropicOauthService,
    private readonly geminiOauth: GeminiOauthService,
    private readonly kiroOauth: KiroOauthService,
    private readonly xaiOauth: XaiOauthService,
    private readonly providerClient: ProviderClient,
    private readonly copilotToken: CopilotTokenService,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly modelParamsService: AgentModelParamsService,
    private readonly providerParamSpecs: ProviderParamSpecService,
    private readonly reasoningCache?: ReasoningContentCache,
  ) {}

  /**
   * Per-attempt merge: look up the user's saved params for this
   * (agent, provider, auth_type, model) tuple and fold them into the
   * outbound body. Returns the original body unchanged when no config
   * exists — the provider's natural default applies in that case.
   *
   * Async because saved values still live in the route-scoped params table;
   * the service caches the agent's full row set, so steady-state cost is a
   * Map lookup, not a query. The MPS catalog itself is static/fetched metadata.
   */
  private async applyParamMerge(
    body: Record<string, unknown>,
    ctx: ParamMergeContext | undefined,
    provider: string,
    authType: AuthType | string | undefined,
    model: string,
  ): Promise<Record<string, unknown>> {
    if (!ctx || !authType) return body;
    const modelParams = await this.modelParamsService.get(
      ctx.agentId,
      ctx.scopeKey,
      provider,
      authType as AuthType,
      model,
    );
    const specs = await this.providerParamSpecs.getSpecs(provider, authType as AuthType, model);
    return applyRequestParamDefaults(body, modelParams, specs);
  }

  async tryFallbacks(
    agentId: string,
    tenantId: string,
    fallbackModels: string[],
    body: Record<string, unknown>,
    stream: boolean,
    sessionKey: string,
    primaryModel: string,
    signal?: AbortSignal,
    primaryProvider?: string,
    primaryAuthType?: string,
    signatureLookup?: SignatureLookup,
    thinkingLookup?: ThinkingBlockLookup,
    apiMode?: ProxyApiMode,
    chatBody?: Record<string, unknown>,
    fallbackRoutes?: ModelRoute[] | null,
    paramMergeContext?: ParamMergeContext,
    reasoningContentLookup?: ReasoningContentLookup,
  ): Promise<{
    success: {
      forward: ForwardResult;
      model: string;
      provider: string;
      fallbackIndex: number;
      authType?: AuthType;
      keyLabel?: string;
      tenantProviderId: string | null;
    } | null;
    failures: FailedFallback[];
  }> {
    const failures: FailedFallback[] = [];

    // Track auth types that already failed per provider so fallbacks for the
    // same provider try a different credential (fixes #1272). Only used on
    // the legacy inference path — when fallbackRoutes is present, the route's
    // explicit auth wins.
    const failedAuthByProvider = new Map<string, Set<string>>();
    if (primaryProvider && primaryAuthType) {
      failedAuthByProvider.set(primaryProvider.toLowerCase(), new Set([primaryAuthType]));
    }

    const useStructuredRoutes =
      Array.isArray(fallbackRoutes) && fallbackRoutes.length === fallbackModels.length;

    for (let i = 0; i < fallbackModels.length; i++) {
      const requestedModel = fallbackModels[i];
      const route = useStructuredRoutes ? fallbackRoutes![i] : null;
      let provider: string | undefined;
      let authType: AuthType;
      // Pinned key label: prefer the structured route's keyLabel. Each
      // fallback can be pinned to a specific provider key (e.g. "Work" vs
      // "Personal" Anthropic Console). When no label is supplied for a
      // subscription fallback, resolve the priority-0 key's label so OAuth
      // refresh persistence updates the same key getProviderApiKey selected.
      let providerKeyLabel = route?.keyLabel ?? undefined;

      if (route) {
        provider = route.provider;
        authType = route.authType;
      } else {
        const pricing = this.pricingCache.getByModel(requestedModel);
        if (CustomProviderService.isCustom(requestedModel)) {
          const slashIdx = requestedModel.indexOf('/');
          provider = slashIdx > 0 ? requestedModel.substring(0, slashIdx) : requestedModel;
        } else {
          const prefix = inferProviderFromModelName(requestedModel);
          provider =
            (prefix && (await this.providerKeyService.hasActiveProvider(tenantId, prefix, agentId))
              ? prefix
              : undefined) ??
            pricing?.provider ??
            (await this.providerKeyService.findProviderForModel(tenantId, requestedModel, agentId));
        }
        if (!provider) {
          this.logger.debug(`Fallback ${i}: skipping model=${requestedModel} (no provider data)`);
          continue;
        }
        const excludeAuth = failedAuthByProvider.get(provider.toLowerCase());
        authType = (await this.providerKeyService.getAuthType(
          tenantId,
          provider,
          excludeAuth,
          agentId,
        )) as AuthType;
      }
      const model = normalizeProviderModel(provider, requestedModel);
      // Single key selection per attempt: the forwarded apiKey, the stamped
      // tenant_provider_id, the recorded key label, and the region are all
      // projected from this one row, so they can never diverge. With no
      // pinned label this returns the priority-0 (default) key.
      const key = await this.providerKeyService.selectProviderKey(
        tenantId,
        provider,
        authType,
        providerKeyLabel,
        agentId,
      );
      if (!key || key.apiKey === null) {
        this.logger.debug(
          `Fallback ${i}: skipping model=${model} provider=${provider} (no API key)`,
        );
        continue;
      }
      const apiKey = key.apiKey;
      // NULL for synthetic Ollama — no persisted row to stamp.
      const tenantProviderId = key.id === SYNTHETIC_OLLAMA_PROVIDER_ID ? null : key.id;
      // Resolve an unpinned subscription label to the selected row's label so
      // OAuth refresh persistence updates the same key the selection used.
      if (!providerKeyLabel && authType === 'subscription') {
        providerKeyLabel = key.label;
      }

      const resolvedCredentials = await resolveApiKey(
        provider,
        apiKey,
        authType,
        agentId,
        tenantId,
        this.openaiOauth,
        this.minimaxOauth,
        this.anthropicOauth,
        this.geminiOauth,
        this.kiroOauth,
        this.xaiOauth,
        providerKeyLabel,
      );
      if (resolvedCredentials.apiKey === null) {
        this.logger.debug(
          `Fallback ${i}: skipping model=${model} provider=${provider} (OAuth token unavailable)`,
        );
        continue;
      }
      let rawApiKey = apiKey;
      if (authType === 'subscription' && isRefreshableOAuthCredential(apiKey)) {
        // Deliberate re-read: resolveApiKey may have refreshed + persisted a
        // rotated OAuth blob (which also invalidates the key cache), so the
        // freshest stored value is fetched for the 401-retry path.
        rawApiKey =
          (await this.providerKeyService.getProviderApiKey(
            tenantId,
            provider,
            authType,
            providerKeyLabel,
            agentId,
          )) ?? apiKey;
      }
      const providerRegion = key.region;

      this.logger.log(
        `Fallback ${i}: trying model=${model} provider=${provider} auth_type=${authType} (primary=${primaryModel})`,
      );

      const forward = await this.tryForwardToProvider({
        provider,
        apiKey: resolvedCredentials.apiKey,
        model,
        body,
        chatBody,
        stream,
        sessionKey,
        signal,
        agentId,
        tenantId,
        rawApiKey,
        providerKeyLabel,
        authType,
        apiMode,
        resourceUrl: resolvedCredentials.resourceUrl,
        providerRegion,
        signatureLookup,
        thinkingLookup,
        reasoningContentLookup,
        paramMergeContext,
      });

      if (forward.response.ok) {
        return {
          success: {
            forward,
            model,
            provider,
            fallbackIndex: i,
            authType,
            // Label of the connection row that served the attempt — stamped
            // alongside its tenant_provider_id so the pair always matches.
            // Synthetic rows (Ollama) keep the pinned label, if any.
            keyLabel: tenantProviderId ? key.label : providerKeyLabel,
            tenantProviderId,
          },
          failures,
        };
      }

      const errorBody = await forward.response.text();
      failures.push({
        model,
        provider,
        fallbackIndex: i,
        status: forward.response.status,
        errorBody,
        authType,
        tenantProviderId,
      });

      const existing = failedAuthByProvider.get(provider.toLowerCase());
      const updated = new Set(existing);
      updated.add(authType);
      failedAuthByProvider.set(provider.toLowerCase(), updated);

      if (!shouldTriggerFallback(forward.response.status)) break;
    }
    return { success: null, failures };
  }

  async tryForwardToProvider(opts: ForwardProviderOptions): Promise<ForwardResult> {
    const cooldown = this.getActiveRateLimitCooldown(opts);
    if (cooldown) {
      return this.buildRateLimitCooldownForward(opts, cooldown);
    }

    try {
      const forward = await this.forwardToProvider(opts);
      const result = await this.retryOAuthSubscriptionAfterRejectedToken(opts, forward);
      this.recordRateLimitCooldown(opts, result.response);
      return result;
    } catch (error) {
      if (opts.signal?.aborted) throw error;
      if (!isTransportError(error)) throw error;

      const failureResponse = buildTransportErrorResponse(error);
      const message = describeTransportError(error);
      this.logger.warn(
        `Provider transport failure: provider=${opts.provider} model=${opts.model} status=${failureResponse.status} message=${message}`,
      );

      return {
        response: failureResponse,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      };
    }
  }

  private getActiveRateLimitCooldown(opts: ForwardProviderOptions): number | null {
    const key = this.rateLimitCooldownKey(opts);
    if (!key) return null;
    const expiresAt = this.rateLimitCooldowns.get(key);
    if (!expiresAt) return null;
    if (expiresAt <= Date.now()) {
      this.rateLimitCooldowns.delete(key);
      return null;
    }
    return expiresAt;
  }

  private buildRateLimitCooldownForward(
    opts: ForwardProviderOptions,
    expiresAt: number,
  ): ForwardResult {
    const retryAfterSeconds = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
    const message =
      `Provider route temporarily cooling down after an upstream 429: ` +
      `${opts.provider}/${opts.model}`;
    return {
      response: new Response(JSON.stringify({ error: { message } }), {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(retryAfterSeconds),
        },
      }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
    };
  }

  private recordRateLimitCooldown(opts: ForwardProviderOptions, response: Response): void {
    if (response.status !== 429) return;
    const key = this.rateLimitCooldownKey(opts);
    if (!key) return;
    if (this.rateLimitCooldowns.size >= MAX_RATE_LIMIT_COOLDOWNS) {
      this.evictExpiredRateLimitCooldowns();
      if (this.rateLimitCooldowns.size >= MAX_RATE_LIMIT_COOLDOWNS) {
        this.evictOldestRateLimitCooldown();
      }
    }
    const ttlMs = this.parseRetryAfterMs(response.headers.get('retry-after'));
    this.rateLimitCooldowns.set(key, Date.now() + ttlMs);
  }

  private evictExpiredRateLimitCooldowns(now = Date.now()): void {
    for (const [key, expiresAt] of this.rateLimitCooldowns) {
      if (expiresAt <= now) this.rateLimitCooldowns.delete(key);
    }
  }

  private evictOldestRateLimitCooldown(): void {
    let oldestKey: string | null = null;
    let oldestExpiresAt = Number.POSITIVE_INFINITY;
    for (const [key, expiresAt] of this.rateLimitCooldowns) {
      if (expiresAt >= oldestExpiresAt) continue;
      oldestKey = key;
      oldestExpiresAt = expiresAt;
    }
    if (oldestKey) this.rateLimitCooldowns.delete(oldestKey);
  }

  private parseRetryAfterMs(retryAfter: string | null): number {
    if (!retryAfter) return RATE_LIMIT_COOLDOWN_DEFAULT_MS;
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, RATE_LIMIT_COOLDOWN_MAX_MS);
    }
    const retryAt = Date.parse(retryAfter);
    if (Number.isNaN(retryAt)) return RATE_LIMIT_COOLDOWN_DEFAULT_MS;
    return Math.min(
      Math.max(retryAt - Date.now(), RATE_LIMIT_COOLDOWN_DEFAULT_MS),
      RATE_LIMIT_COOLDOWN_MAX_MS,
    );
  }

  private rateLimitCooldownKey(opts: ForwardProviderOptions): string | null {
    if (!opts.agentId || !opts.authType) return null;
    return [
      opts.agentId,
      opts.provider.toLowerCase(),
      opts.authType,
      opts.providerKeyLabel ?? '',
      opts.model.toLowerCase(),
    ].join('\u0000');
  }

  private async retryOAuthSubscriptionAfterRejectedToken(
    opts: ForwardProviderOptions,
    forward: ForwardResult,
  ): Promise<ForwardResult> {
    if (
      opts.authType !== 'subscription' ||
      forward.response.status !== 401 ||
      !opts.rawApiKey ||
      !opts.agentId ||
      !opts.tenantId
    ) {
      return forward;
    }

    const refreshed = await refreshRejectedOAuthCredential(
      opts.provider,
      opts.rawApiKey,
      opts.agentId,
      opts.tenantId,
      opts.providerKeyLabel,
      {
        openaiOauth: this.openaiOauth,
        minimaxOauth: this.minimaxOauth,
        anthropicOauth: this.anthropicOauth,
        geminiOauth: this.geminiOauth,
        kiroOauth: this.kiroOauth,
        xaiOauth: this.xaiOauth,
      },
    );
    if (!refreshed?.apiKey || refreshed.apiKey === opts.apiKey) return forward;

    this.logger.log(
      `OAuth token rejected upstream; refreshed provider=${opts.provider} agent=${opts.agentId}`,
    );
    return this.forwardToProvider({
      ...opts,
      apiKey: refreshed.apiKey,
      resourceUrl: refreshed.resourceUrl ?? opts.resourceUrl,
    });
  }

  private async forwardToProvider(opts: ForwardProviderOptions): Promise<ForwardResult> {
    const {
      provider,
      stream,
      signal,
      authType,
      resourceUrl,
      providerRegion,
      signatureLookup,
      thinkingLookup,
      reasoningContentLookup,
    } = opts;
    // Per-attempt merge: ask the model-params service for this iteration's
    // (provider, auth_type, model) config. Storage is model-scoped on the
    // new agent_model_params table, so a primary OpenAI route with a
    // DeepSeek fallback no longer needs the old per-provider filter —
    // OpenAI's lookup returns null, DeepSeek's returns its own row.
    let body = await this.applyParamMerge(
      opts.body,
      opts.paramMergeContext,
      provider,
      authType,
      opts.model,
    );
    let chatBody = opts.chatBody
      ? await this.applyParamMerge(
          opts.chatBody,
          opts.paramMergeContext,
          provider,
          authType,
          opts.model,
        )
      : undefined;

    const extraHeaders = buildProviderExtraHeaders(provider, opts.sessionKey);

    // Copilot: exchange the stored GitHub OAuth token for a short-lived API token
    let effectiveKey = opts.apiKey;
    if (provider.toLowerCase() === 'copilot') {
      effectiveKey = await this.copilotToken.getCopilotToken(opts.apiKey);
    }

    // Custom providers store their endpoint on a DB row; fetch it so the shared
    // resolver can build the override. (Kept in the caller to keep the resolver
    // synchronous + DB-free.)
    // Fail closed: TypeORM strips an `undefined` where-value, so without the
    // explicit tenantId guard a missing tenantId would silently degrade to an
    // unscoped lookup by id alone. A real custom-provider forward always carries
    // the caller's tenantId; if it's absent we skip the lookup rather than read a
    // row that could belong to another tenant.
    const customProvider =
      CustomProviderService.isCustom(provider) && opts.tenantId
        ? await this.customProviderRepo.findOne({
            where: { id: CustomProviderService.extractId(provider), tenant_id: opts.tenantId },
          })
        : null;
    const { customEndpoint, forwardModel } = resolveForwardEndpoint({
      provider,
      authType,
      model: opts.model,
      providerRegion,
      resourceUrl,
      customProvider,
      logger: this.logger,
    });

    const reasoningEndpointKey =
      customEndpoint && customEndpoint.format !== 'openai'
        ? null
        : customEndpoint
          ? 'custom'
          : resolveEndpointKey(provider);
    if (this.reasoningCache) {
      body = await this.reasoningCache.reinjectMissingReasoningContent(
        body,
        opts.sessionKey,
        reasoningEndpointKey,
        forwardModel,
      );
      if (chatBody) {
        chatBody = await this.reasoningCache.reinjectMissingReasoningContent(
          chatBody,
          opts.sessionKey,
          reasoningEndpointKey,
          forwardModel,
        );
      }
    }

    // For Gemini OAuth, the OAuth blob's `u` field is the
    // CodeAssist project id (not a URL). It must be forwarded so the
    // CodeAssist envelope wrap can include it.
    const providerResource =
      authType === 'subscription' && provider.toLowerCase() === 'gemini' ? resourceUrl : undefined;

    return this.providerClient.forward({
      provider,
      apiKey: effectiveKey,
      model: forwardModel,
      body,
      chatBody,
      stream,
      signal,
      extraHeaders,
      customEndpoint,
      authType,
      apiMode: opts.apiMode,
      signatureLookup,
      thinkingLookup,
      reasoningContentLookup,
      providerResource,
    });
  }
}

export function normalizeProviderModel(provider: string, model: string): string {
  return provider.toLowerCase() === 'anthropic' ? normalizeAnthropicShortModelId(model) : model;
}
