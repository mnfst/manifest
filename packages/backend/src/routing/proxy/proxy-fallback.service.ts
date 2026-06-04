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
  userId?: string;
  resourceUrl?: string;
  providerRegion?: string | null;
  apiMode?: ProxyApiMode;
  signatureLookup?: SignatureLookup;
  thinkingLookup?: ThinkingBlockLookup;
  reasoningContentLookup?: ReasoningContentLookup;
  paramMergeContext?: ParamMergeContext;
}

import { ProviderKeyService } from '../routing-core/provider-key.service';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { CustomProviderService } from '../custom-provider/custom-provider.service';
import { OpenaiOauthService } from '../oauth/openai-oauth.service';
import { MinimaxOauthService } from '../oauth/minimax-oauth.service';
import { AnthropicOauthService } from '../oauth/anthropic/anthropic-oauth.service';
import { GeminiOauthService } from '../oauth/gemini-oauth.service';
import { KiroOauthService } from '../oauth/kiro-oauth.service';
import { XaiOauthService } from '../oauth/xai/xai-oauth.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { ProviderClient, ForwardResult } from './provider-client';
import {
  buildCustomEndpoint,
  buildEndpointOverride,
  ProviderEndpoint,
  resolveEndpointKey,
} from './provider-endpoints';
import { CopilotTokenService } from './copilot-token.service';
import { ReasoningContentCache } from './reasoning-content-cache';
import { buildProviderExtraHeaders } from './provider-hooks';
import { shouldTriggerFallback } from './fallback-status-codes';
import { inferProviderFromModelName } from '../../common/utils/provider-aliases';
import { normalizeMinimaxSubscriptionBaseUrl } from '../provider-base-url';
import { MINIMAX_BASE_URLS } from '../oauth/minimax-oauth-helpers';
import { getQwenCompatibleBaseUrl, isQwenResolvedRegion } from '../qwen-region';
import { getZaiCodingPlanBaseUrl } from '../zai-region';
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
}

@Injectable()
export class ProxyFallbackService {
  private readonly logger = new Logger(ProxyFallbackService.name);

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
    userId: string,
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
            (prefix && (await this.providerKeyService.hasActiveProvider(userId, prefix, agentId))
              ? prefix
              : undefined) ??
            pricing?.provider ??
            (await this.providerKeyService.findProviderForModel(userId, requestedModel, agentId));
        }
        if (!provider) {
          this.logger.debug(`Fallback ${i}: skipping model=${requestedModel} (no provider data)`);
          continue;
        }
        const excludeAuth = failedAuthByProvider.get(provider.toLowerCase());
        authType = (await this.providerKeyService.getAuthType(
          userId,
          provider,
          excludeAuth,
          agentId,
        )) as AuthType;
      }
      if (!providerKeyLabel && authType === 'subscription') {
        providerKeyLabel = await this.providerKeyService.getDefaultKeyLabel(
          agentId,
          provider,
          authType,
        );
      }

      const model = normalizeProviderModel(provider, requestedModel);
      const apiKey = await this.providerKeyService.getProviderApiKey(
        userId,
        provider,
        authType,
        providerKeyLabel,
        agentId,
      );
      if (apiKey === null) {
        this.logger.debug(
          `Fallback ${i}: skipping model=${model} provider=${provider} (no API key)`,
        );
        continue;
      }

      const resolvedCredentials = await resolveApiKey(
        provider,
        apiKey,
        authType,
        agentId,
        userId,
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
        rawApiKey =
          (await this.providerKeyService.getProviderApiKey(
            agentId,
            provider,
            authType,
            providerKeyLabel,
          )) ?? apiKey;
      }
      const providerRegion = await this.providerKeyService.getProviderRegion(
        userId,
        provider,
        authType,
        providerKeyLabel,
        agentId,
      );

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
        userId,
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
          success: { forward, model, provider, fallbackIndex: i, authType },
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
    try {
      const forward = await this.forwardToProvider(opts);
      return await this.retryOAuthSubscriptionAfterRejectedToken(opts, forward);
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

  private async retryOAuthSubscriptionAfterRejectedToken(
    opts: ForwardProviderOptions,
    forward: ForwardResult,
  ): Promise<ForwardResult> {
    if (
      opts.authType !== 'subscription' ||
      forward.response.status !== 401 ||
      !opts.rawApiKey ||
      !opts.agentId ||
      !opts.userId
    ) {
      return forward;
    }

    const refreshed = await refreshRejectedOAuthCredential(
      opts.provider,
      opts.rawApiKey,
      opts.agentId,
      opts.userId,
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

    let customEndpoint: ProviderEndpoint | undefined;
    let forwardModel = opts.model;

    // Strip the "copilot/" prefix -- the Copilot API expects bare model names
    if (provider.toLowerCase() === 'copilot' && forwardModel.startsWith('copilot/')) {
      forwardModel = forwardModel.substring('copilot/'.length);
    }

    // Strip the "minimax/" prefix for MiniMax subscription routes. Vendor-
    // prefixed model IDs can come in from OpenRouter pricing fallbacks
    // (e.g. `minimax/MiniMax-M2.7`), and when we set a custom endpoint below
    // for the CN region the request would otherwise reach MiniMax with the
    // prefix intact and 404. The provider-endpoint resolver normally strips
    // it for `minimax-subscription`, but a `customEndpoint` short-circuits
    // that and ProviderClient.stripModelPrefix leaves `custom` keys alone.
    if (
      provider.toLowerCase() === 'minimax' &&
      authType === 'subscription' &&
      forwardModel.toLowerCase().startsWith('minimax/')
    ) {
      forwardModel = forwardModel.substring('minimax/'.length);
    }
    if (provider.toLowerCase() === 'zai' && authType === 'subscription') {
      const lowerModel = forwardModel.toLowerCase();
      if (lowerModel.startsWith('z-ai/')) {
        forwardModel = forwardModel.substring('z-ai/'.length);
      } else if (lowerModel.startsWith('zai/')) {
        forwardModel = forwardModel.substring('zai/'.length);
      }
    }

    if (CustomProviderService.isCustom(provider)) {
      const cpId = CustomProviderService.extractId(provider);
      const cp = await this.customProviderRepo.findOne({
        where: opts.userId ? { id: cpId, user_id: opts.userId } : { id: cpId },
      });
      if (cp) {
        customEndpoint = buildCustomEndpoint(cp.base_url, cp.api_kind ?? 'openai');
        forwardModel = CustomProviderService.rawModelName(opts.model);
      }
    } else if (resolveEndpointKey(provider) === 'qwen' && isQwenResolvedRegion(providerRegion)) {
      customEndpoint = buildEndpointOverride(getQwenCompatibleBaseUrl(providerRegion), 'qwen');
    } else if (authType === 'subscription' && provider.toLowerCase() === 'minimax') {
      // OAuth-issued tokens carry the chosen region inside the JSON blob's
      // resource_url (resourceUrl). Pasted Coding Plan tokens (`sk-cp-`)
      // don't — for those we read the persisted region column. We only
      // build a custom endpoint when the region is CN; global already
      // matches the built-in `minimax-subscription` endpoint base URL, and
      // overriding it would shift the route through the `custom` endpoint
      // key, which preserves vendor-prefixed model IDs that this provider
      // would otherwise strip and reject.
      if (resourceUrl) {
        const minimaxBaseUrl = normalizeMinimaxSubscriptionBaseUrl(resourceUrl);
        if (minimaxBaseUrl) {
          customEndpoint = buildEndpointOverride(minimaxBaseUrl, 'minimax-subscription');
        } else {
          this.logger.warn('Ignoring invalid MiniMax subscription resource URL');
        }
      } else if (providerRegion === 'cn') {
        const regionBaseUrl = `${MINIMAX_BASE_URLS.cn}/anthropic`;
        customEndpoint = buildEndpointOverride(regionBaseUrl, 'minimax-subscription');
      }
    } else if (
      authType === 'subscription' &&
      provider.toLowerCase() === 'zai' &&
      providerRegion === 'cn'
    ) {
      customEndpoint = buildEndpointOverride(getZaiCodingPlanBaseUrl('cn'), 'zai-subscription');
    }

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
