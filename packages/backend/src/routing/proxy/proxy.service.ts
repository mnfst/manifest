import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResolveService } from '../resolve/resolve.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import {
  ProviderKeyService,
  SYNTHETIC_OLLAMA_PROVIDER_ID,
} from '../routing-core/provider-key.service';
import { OpenaiOauthService } from '../oauth/openai/openai-oauth.service';
import { MinimaxOauthService } from '../oauth/minimax/minimax-oauth.service';
import { AnthropicOauthService } from '../oauth/anthropic/anthropic-oauth.service';
import { GeminiOauthService } from '../oauth/gemini/gemini-oauth.service';
import { KiroOauthService } from '../oauth/kiro/kiro-oauth.service';
import { XaiOauthService } from '../oauth/xai/xai-oauth.service';
import { ForwardResult } from './provider-client';
import { SessionMomentumService } from './session-momentum.service';
import { LimitCheckService } from '../../notifications/services/limit-check.service';
import { shouldTriggerFallback } from './fallback-status-codes';
import { Tier, TIERS, ScorerMessage } from '../../scoring/types';
import type {
  AuthType,
  RequestParamDefaults,
  ResponseMode,
  OutputModality,
  SpecificityCategory,
  TierSlot,
} from 'manifest-shared';
import {
  DEFAULT_RESPONSE_MODE,
  SPECIFICITY_CATEGORIES,
  modelParamsScopeForRouting,
  routeEquals,
  snapshotRequestParams,
} from 'manifest-shared';
import type { ParamMergeContext } from './proxy-fallback.service';
import {
  ProxyFallbackService,
  FailedFallback,
  normalizeProviderModel,
} from './proxy-fallback.service';
import { isRefreshableOAuthCredential, resolveApiKey } from './oauth-credentials';
import {
  ProxyApiMode,
  ProxyRequestOptions,
  SignatureLookup,
  ThinkingBlockLookup,
  ReasoningContentLookup,
  ProviderAttemptRef,
  StartProviderAttempt,
} from './proxy-types';
import { ThoughtSignatureCache } from './thought-signature-cache';
import { ThinkingBlockCache } from './thinking-block-cache';
import { ReasoningContentCache } from './reasoning-content-cache';
import { AgentModelParamsService } from '../routing-core/agent-model-params.service';
import { ProviderParamSpecService } from '../routing-core/provider-param-spec.service';
import { buildFriendlyResponse, getDashboardUrl } from './proxy-friendly-response';
import { formatManifestError, type ManifestErrorCode } from '../../common/errors/error-codes';
import { ManifestError } from '../../common/errors/manifest-error';
import { peekStream, STREAM_WARMUP_MS } from './stream-warmup';
import { toChatCompletionsRequest } from './responses-adapter';
import { messagesToChatCompletionsRequest } from './anthropic-messages-adapter';
import { effectiveRoutesForResponseMode } from '../routing-core/response-mode-guard';
import { OPENAI_MODEL_ID_AUTO, routeForOpenAiModelId } from './openai-model-id';
import { AutofixService } from '../autofix/autofix.service';
import type { AutofixRecord } from '../autofix/autofix.types';

type ResolvedRouting = Awaited<ReturnType<ResolveService['resolve']>> & {
  explicit_model_override?: boolean;
  explicit_model_unavailable?: string;
};

/**
 * Roles excluded from scoring. AI agents (OpenClaw, Hermes, and
 * similar tools) inject a large, keyword-rich system prompt with every
 * request. Scoring it inflates every request to the most expensive tier.
 * We strip these before the scorer sees them, but forward the full
 * unmodified body to the real provider.
 */
const SCORING_EXCLUDED_ROLES = new Set(['system', 'developer']);
const SCORING_RECENT_MESSAGES = 10;

export interface RoutingMeta {
  tier: TierSlot | 'direct';
  model: string;
  provider: string;
  confidence: number;
  reason: string;
  /**
   * Present when the "response" is really a Manifest error rendered as an
   * assistant message (no provider was contacted). See buildFriendlyResponse.
   */
  manifest_error_code?: ManifestErrorCode;
  manifest_error_message?: string;
  auth_type?: AuthType;
  specificity_category?: string;
  header_tier_id?: string;
  header_tier_name?: string;
  header_tier_color?: string;
  provider_key_label?: string;
  /**
   * The `tenant_providers` row id that served this attempt. Stamped on
   * `agent_messages.tenant_provider_id` so per-connection analytics scope by the
   * exact key rather than the non-unique (provider, auth_type, label) tuple.
   * In a fallback-success flow this holds the winning fallback's connection.
   * NULL for local/Ollama and resolution-failure paths.
   */
  tenantProviderId?: string | null;
  fallbackFromModel?: string;
  fallbackIndex?: number;
  primaryErrorStatus?: number;
  primaryErrorBody?: string;
  /**
   * Provider of the primary model when a fallback ultimately succeeded.
   * Distinct from `provider`, which in a fallback-success flow holds the
   * fallback model's provider. Used to attribute the recorded primary
   * failure row to the correct vendor.
   */
  primaryProvider?: string;
  /**
   * Auth type of the primary model when a fallback ultimately succeeded.
   * In a fallback-success flow, `auth_type` holds the fallback's auth so
   * the recorder costs the success row correctly; this field preserves the
   * primary's auth so the primary-failure row stays accurate too. See #1173.
   */
  primaryAuthType?: string;
  /**
   * The primary's `tenant_provider_id` when a fallback ultimately succeeded.
   * Mirrors primaryProvider/primaryAuthType: `tenantProviderId` then holds the
   * winning fallback's connection, so the recorded primary-failure row reads
   * this to stay attributed to the connection that actually failed.
   */
  primaryTenantProviderId?: string | null;
  /**
   * Effective request body parameters for this attempt: client body values,
   * route-scoped `agent_model_params`, and MPS provider param defaults.
   * Persisted on `agent_messages.request_params` so the dashboard can show
   * which model params were in play for the recorded request.
   */
  request_params?: RequestParamDefaults | null;
  /** Effective output modality configured on the resolved routing chain. */
  output_modality?: OutputModality;
  /** Effective response transport configured on the resolved routing chain. */
  response_mode?: ResponseMode;
  /** Internal persisted identity of the response-producing Attempt. */
  attempt?: ProviderAttemptRef;
  /** False when the response was produced without invoking provider transport. */
  providerCallStarted?: boolean;
  /** Internal identity of the failed primary/retry that triggered fallback. */
  primaryAttempt?: ProviderAttemptRef;
  /** Whether the primary/retry actually crossed the provider transport boundary. */
  primaryProviderCallStarted?: boolean;
  /** Internal identity of the original failure before an Auto-fix retry. */
  autofixOriginalAttempt?: ProviderAttemptRef;
  /** Whether the pre-Auto-fix original actually invoked provider transport. */
  autofixOriginalProviderCallStarted?: boolean;
}

export interface ProxyResult {
  forward: ForwardResult;
  meta: RoutingMeta;
  failedFallbacks?: FailedFallback[];
  /** Auto-fix audit when a repairable failure was sent to the healing service. */
  autofix?: AutofixRecord;
}

/** Everything Auto-fix's reforward needs to re-send a healed body to a provider. */
interface HealedReforwardContext {
  agentId: string;
  tenantId: string;
  apiMode: ProxyApiMode;
  sessionKey: string;
  signal?: AbortSignal;
  stream: boolean;
  specificityOverride?: ProxyRequestOptions['specificityOverride'];
  headers?: ProxyRequestOptions['headers'];
  provider: string;
  apiKey: string;
  rawApiKey: string;
  model: string;
  keyLabel?: string;
  authType?: AuthType;
  resourceUrl?: string;
  providerRegion?: string | null;
  paramMergeContext: ParamMergeContext | undefined;
  signatureLookup: SignatureLookup;
  thinkingLookup: ThinkingBlockLookup;
  reasoningContentLookup: ReasoningContentLookup;
  tenantProviderId: string | null;
  startProviderAttempt?: StartProviderAttempt;
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly resolveService: ResolveService,
    private readonly modelDiscovery: ModelDiscoveryService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly openaiOauth: OpenaiOauthService,
    private readonly minimaxOauth: MinimaxOauthService,
    private readonly anthropicOauth: AnthropicOauthService,
    private readonly geminiOauth: GeminiOauthService,
    private readonly kiroOauth: KiroOauthService,
    private readonly xaiOauth: XaiOauthService,
    private readonly momentum: SessionMomentumService,
    private readonly limitCheck: LimitCheckService,
    private readonly fallbackService: ProxyFallbackService,
    private readonly config: ConfigService,
    private readonly signatureCache: ThoughtSignatureCache,
    private readonly thinkingCache: ThinkingBlockCache,
    private readonly reasoningCache: ReasoningContentCache,
    private readonly modelParamsService: AgentModelParamsService,
    private readonly providerParamSpecs: ProviderParamSpecService,
    private readonly autofixService: AutofixService,
  ) {}

  async proxyRequest(opts: ProxyRequestOptions): Promise<ProxyResult> {
    const {
      agentId,
      tenantId,
      body,
      sessionKey,
      agentName,
      signal,
      specificityOverride,
      headers,
      startProviderAttempt,
    } = opts;
    const apiMode = opts.apiMode ?? 'chat_completions';
    const routingSource = opts.routingBody ?? body;
    const chatBody = this.toChatBody(apiMode, body);
    const forwardingBody = chatBody ?? body;
    let routingBody = forwardingBody;
    if (routingSource !== body) {
      const routingChatBody = this.toChatBody(apiMode, routingSource);
      routingBody = routingChatBody ?? routingSource;
    }
    this.validatePayload(forwardingBody);
    if (routingBody !== forwardingBody) this.validatePayload(routingBody);

    const limitMessage = await this.enforceLimits(tenantId, agentName);
    if (limitMessage) {
      return buildFriendlyResponse(
        limitMessage,
        routingBody.stream === true,
        'limit_exceeded',
        'M200',
      );
    }

    const resolved = await this.resolveRouting(
      agentId,
      tenantId,
      routingBody,
      sessionKey,
      specificityOverride,
      headers,
      apiMode,
    );
    const responseMode = resolved.response_mode ?? DEFAULT_RESPONSE_MODE;
    const stream = body.stream === true || responseMode === 'stream';
    if (!resolved.route) {
      this.logger.warn(
        `No route available for agent=${agentId}: ` +
          `tier=${resolved.tier} confidence=${resolved.confidence} reason=${resolved.reason}`,
      );
      if (resolved.explicit_model_unavailable) {
        return this.buildModelUnavailableResult(
          stream,
          agentName,
          resolved.explicit_model_unavailable,
        );
      }
      return this.buildNoProviderResult(stream, agentName);
    }

    const route = resolved.route;
    const credentials = await this.resolveCredentials(agentId, tenantId, {
      provider: route.provider,
      auth_type: route.authType,
      provider_key_label: route.keyLabel ?? undefined,
    });
    if (credentials === null) {
      const dashboardUrl = getDashboardUrl(this.config, agentName, 'routing');
      const content = formatManifestError('M100', { provider: route.provider, dashboardUrl });
      return buildFriendlyResponse(content, stream, 'no_provider_key', 'M100');
    }

    const primaryModel = normalizeProviderModel(route.provider, route.model);
    this.logger.log(
      `Proxy: tier=${resolved.tier} model=${primaryModel} provider=${route.provider} auth_type=${route.authType} confidence=${resolved.confidence}`,
    );

    const signatureLookup = (toolCallId: string) =>
      this.signatureCache.retrieve(sessionKey, toolCallId);
    const thinkingLookup: ThinkingBlockLookup = (firstToolUseId, routeContext) =>
      routeContext
        ? this.thinkingCache.retrieve(sessionKey, firstToolUseId, routeContext)
        : this.thinkingCache.retrieve(sessionKey, firstToolUseId);
    const reasoningContentLookup = (firstToolCallId: string) =>
      this.reasoningCache.retrieve(sessionKey, firstToolCallId);

    // Per-attempt param-defaults merge happens inside the fallback service
    // so each forward (primary + every fallback iteration) looks up its
    // own (provider, auth_type, model) tuple in the model-params service.
    // Pass the agentId here as a thin context bag; the storage is already
    // route-scoped, so no per-provider filter is needed downstream.
    const explicitModelOverride = resolved.explicit_model_override === true;
    const scopeKey = modelParamsScopeForRouting({
      tier: resolved.tier,
      specificityCategory: resolved.specificity_category,
      headerTierId: resolved.header_tier_id,
    });
    const paramMergeContext: ParamMergeContext | undefined = explicitModelOverride
      ? undefined
      : { agentId, scopeKey };

    // Snapshot of which known param keys are *effectively in play* for the
    // primary attempt. Stored on every `agent_messages` row recorded for
    // this request so the dashboard can display the effective parameters
    // (today: DeepSeek's `thinking` toggle) in the expanded message detail.
    // Re-derived for fallback successes against the actual fallback
    // provider so the persisted snapshot matches what was sent on that row.
    // Independent reads — the params row and the provider spec list don't
    // depend on each other, so fetch them concurrently to shave a round-trip
    // off the cold path before forwarding.
    const [primaryModelParams, primarySpecs] = explicitModelOverride
      ? ([null, []] as const)
      : await Promise.all([
          this.modelParamsService.get(
            agentId,
            scopeKey,
            route.provider,
            route.authType,
            primaryModel,
          ),
          this.providerParamSpecs.getSpecs(route.provider, route.authType, primaryModel),
        ]);
    const primaryRequestParams = explicitModelOverride
      ? null
      : snapshotRequestParams({
          body: routingBody as Record<string, unknown>,
          modelParams: primaryModelParams,
          specs: primarySpecs,
        });

    let forward = await this.fallbackService.tryForwardToProvider({
      provider: route.provider,
      apiKey: credentials.apiKey,
      model: primaryModel,
      body,
      chatBody,
      stream,
      sessionKey,
      signal,
      agentId,
      tenantId,
      rawApiKey: credentials.rawApiKey,
      providerKeyLabel: route.keyLabel ?? undefined,
      authType: route.authType,
      apiMode,
      resourceUrl: credentials.resourceUrl,
      providerRegion: credentials.providerRegion,
      signatureLookup,
      thinkingLookup,
      reasoningContentLookup,
      paramMergeContext,
      tenantProviderId: credentials.tenantProviderId,
      startProviderAttempt,
    });
    const autofixOriginalAttempt = forward.attempt;
    const autofixOriginalProviderCallStarted = forward.providerCallStarted;

    // Auto-fix runs BEFORE the fallback chain: heal a repairable 4xx and retry
    // the patched request, so a fixable request isn't sprayed across every
    // fallback provider. A no-op unless the agent opted in and the forward
    // failed with a repairable status, so successful traffic is untouched.
    const wireRequestBody = forward.wireRequestBody;
    const wireApiMode = forward.wireApiMode;
    const retryWireBody = forward.retryWireBody;
    const autofixAttempt =
      wireRequestBody && wireApiMode && retryWireBody
        ? await this.autofixService.maybeHeal({
            forward,
            agentId,
            tenantId,
            provider: route.provider,
            authType: route.authType,
            apiMode: wireApiMode,
            requestBody: wireRequestBody,
            reforward: (healedBody) =>
              this.reforwardHealed(healedBody, forward, {
                agentId,
                tenantId,
                apiMode: wireApiMode,
                sessionKey,
                signal,
                stream,
                specificityOverride,
                headers,
                provider: route.provider,
                apiKey: credentials.apiKey,
                rawApiKey: credentials.rawApiKey,
                model: primaryModel,
                keyLabel: route.keyLabel ?? undefined,
                authType: route.authType,
                resourceUrl: credentials.resourceUrl,
                providerRegion: credentials.providerRegion,
                paramMergeContext,
                signatureLookup,
                thinkingLookup,
                reasoningContentLookup,
                tenantProviderId: credentials.tenantProviderId,
                startProviderAttempt,
              }),
          })
        : null;
    const autofixRecord = autofixAttempt?.record;
    if (autofixAttempt) forward = autofixAttempt.forward;

    if (
      !explicitModelOverride &&
      !forward.response.ok &&
      shouldTriggerFallback(forward.response.status) &&
      paramMergeContext
    ) {
      const fallbackResult = await this.tryFallbackChain({
        agentId,
        tenantId,
        resolved,
        primaryModel,
        forward,
        body,
        chatBody,
        stream,
        sessionKey,
        signal,
        signatureLookup,
        thinkingLookup,
        reasoningContentLookup,
        apiMode,
        paramMergeContext,
        primaryTenantProviderId: credentials.tenantProviderId,
        startProviderAttempt,
      });
      if (fallbackResult) {
        return {
          ...fallbackResult,
          meta: {
            ...fallbackResult.meta,
            autofixOriginalAttempt,
            autofixOriginalProviderCallStarted,
          },
          autofix: autofixRecord,
        };
      }
    }

    // Stream warm-up: for streaming 200 responses, verify the provider
    // actually starts delivering data before committing to the client.
    // If the stream stalls or dies, we can still try fallback providers.
    if (forward.response.ok && stream && forward.response.body) {
      const warmup = await peekStream(forward.response.body, STREAM_WARMUP_MS);
      if (warmup.ok) {
        const peeked: ForwardResult = {
          response: new Response(warmup.stream, {
            status: forward.response.status,
            statusText: forward.response.statusText,
            headers: forward.response.headers,
          }),
          isGoogle: forward.isGoogle,
          isAnthropic: forward.isAnthropic,
          isChatGpt: forward.isChatGpt,
          isResponses: forward.isResponses,
          isCodeAssist: forward.isCodeAssist,
          structuredOutputToolName: forward.structuredOutputToolName,
          responsesTextFormat: forward.responsesTextFormat,
          providerCallStarted: forward.providerCallStarted,
        };
        this.recordTierIfScoring(sessionKey, resolved.tier);
        this.recordCategoryIfValid(sessionKey, resolved.specificity_category);
        return {
          forward: peeked,
          meta: this.buildBaseMeta(resolved, primaryModel, {
            request_params: primaryRequestParams,
            tenantProviderId: credentials.tenantProviderId,
            attempt: forward.attempt,
            providerCallStarted: forward.providerCallStarted,
            autofixOriginalAttempt,
            autofixOriginalProviderCallStarted,
          }),
          autofix: autofixRecord,
        };
      }

      this.logger.warn(
        `Stream warmup failed: provider=${route.provider} model=${primaryModel} reason=${warmup.reason} message=${warmup.message}`,
      );

      const syntheticForward: ForwardResult = {
        response: new Response(
          JSON.stringify({ error: { message: `Stream warmup failed: ${warmup.message}` } }),
          { status: 502, headers: { 'content-type': 'application/json' } },
        ),
        attempt: forward.attempt,
        isGoogle: forward.isGoogle,
        isAnthropic: forward.isAnthropic,
        isChatGpt: forward.isChatGpt,
        isResponses: forward.isResponses,
        isCodeAssist: forward.isCodeAssist,
        structuredOutputToolName: forward.structuredOutputToolName,
        responsesTextFormat: forward.responsesTextFormat,
        providerCallStarted: forward.providerCallStarted,
      };
      if (!explicitModelOverride && paramMergeContext) {
        const fallbackResult = await this.tryFallbackChain({
          agentId,
          tenantId,
          resolved,
          primaryModel,
          forward: syntheticForward,
          body,
          chatBody,
          stream,
          sessionKey,
          signal,
          signatureLookup,
          thinkingLookup,
          reasoningContentLookup,
          apiMode,
          paramMergeContext,
          primaryTenantProviderId: credentials.tenantProviderId,
          startProviderAttempt,
        });
        if (fallbackResult) {
          return {
            ...fallbackResult,
            meta: {
              ...fallbackResult.meta,
              autofixOriginalAttempt,
              autofixOriginalProviderCallStarted,
            },
            autofix: autofixRecord,
          };
        }
      }

      // Warmup failed and no fallbacks available: return the synthetic 502
      // instead of the original forward (whose body was consumed by peekStream).
      this.recordTierIfScoring(sessionKey, resolved.tier);
      this.recordCategoryIfValid(sessionKey, resolved.specificity_category);
      return {
        forward: syntheticForward,
        meta: this.buildBaseMeta(resolved, primaryModel, {
          request_params: primaryRequestParams,
          tenantProviderId: credentials.tenantProviderId,
          attempt: forward.attempt,
          providerCallStarted: forward.providerCallStarted,
          autofixOriginalAttempt,
          autofixOriginalProviderCallStarted,
        }),
        autofix: autofixRecord,
      };
    }

    this.recordTierIfScoring(sessionKey, resolved.tier);
    this.recordCategoryIfValid(sessionKey, resolved.specificity_category);
    return {
      forward,
      meta: this.buildBaseMeta(resolved, primaryModel, {
        request_params: primaryRequestParams,
        tenantProviderId: credentials.tenantProviderId,
        attempt: forward.attempt,
        providerCallStarted: forward.providerCallStarted,
        autofixOriginalAttempt,
        autofixOriginalProviderCallStarted,
      }),
      autofix: autofixRecord,
    };
  }

  private recordTierIfScoring(sessionKey: string, tier: TierSlot): void {
    if ((TIERS as readonly string[]).includes(tier)) {
      this.momentum.recordTier(sessionKey, tier as Tier);
    }
  }

  /**
   * Convert a native Responses / Anthropic-Messages body into the internal
   * chat-completions shape used for routing and forwarding. Returns undefined
   * for `chat_completions` mode (the body is already in the target shape).
   */
  private toChatBody(
    apiMode: ProxyApiMode,
    body: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (apiMode === 'responses') return toChatCompletionsRequest(body);
    if (apiMode === 'messages') return messagesToChatCompletionsRequest(body);
    return undefined;
  }

  /**
   * Re-send an Auto-fix-healed wire body. Same model → use the exact resolved
   * transport without re-merging or translating. Model changed (e.g. an
   * unknown-model fix) → re-resolve so it reaches the right provider/key (M5).
   */
  private reforwardHealed(
    healedBody: Record<string, unknown>,
    originalForward: ForwardResult,
    ctx: HealedReforwardContext,
  ): Promise<ForwardResult> {
    const originalModel = originalForward.wireRequestBody?.model;
    const healedModel = typeof healedBody.model === 'string' ? healedBody.model : undefined;
    if (healedModel && healedModel !== originalModel) {
      return this.forwardResolvedHealed(healedBody, ctx);
    }
    return this.fallbackService.retryWireBody(originalForward, healedBody, {
      provider: ctx.provider,
      model: ctx.model,
      signal: ctx.signal,
      authType: ctx.authType,
      tenantProviderId: ctx.tenantProviderId,
      startProviderAttempt: ctx.startProviderAttempt,
    });
  }

  private async forwardResolvedHealed(
    healedBody: Record<string, unknown>,
    ctx: HealedReforwardContext,
  ): Promise<ForwardResult> {
    const routingBody = this.toChatBody(ctx.apiMode, healedBody) ?? healedBody;
    const resolved = await this.resolveRouting(
      ctx.agentId,
      ctx.tenantId,
      routingBody,
      ctx.sessionKey,
      ctx.specificityOverride,
      ctx.headers,
      ctx.apiMode,
    );
    const route = resolved.route;
    if (!route) return this.autofixReforwardError('no route resolved for the healed model');
    const credentials = await this.resolveCredentials(ctx.agentId, ctx.tenantId, {
      provider: route.provider,
      auth_type: route.authType,
      provider_key_label: route.keyLabel ?? undefined,
    });
    if (!credentials) return this.autofixReforwardError('no provider key for the healed model');
    const explicitModelOverride = resolved.explicit_model_override === true;
    const scopeKey = modelParamsScopeForRouting({
      tier: resolved.tier,
      specificityCategory: resolved.specificity_category,
      headerTierId: resolved.header_tier_id,
    });
    return this.fallbackService.tryForwardToProvider({
      provider: route.provider,
      apiKey: credentials.apiKey,
      model: normalizeProviderModel(route.provider, route.model),
      body: healedBody,
      chatBody: this.toChatBody(ctx.apiMode, healedBody),
      stream: ctx.stream,
      sessionKey: ctx.sessionKey,
      signal: ctx.signal,
      agentId: ctx.agentId,
      tenantId: ctx.tenantId,
      rawApiKey: credentials.rawApiKey,
      providerKeyLabel: route.keyLabel ?? undefined,
      authType: route.authType,
      apiMode: ctx.apiMode,
      resourceUrl: credentials.resourceUrl,
      providerRegion: credentials.providerRegion,
      signatureLookup: ctx.signatureLookup,
      thinkingLookup: ctx.thinkingLookup,
      reasoningContentLookup: ctx.reasoningContentLookup,
      paramMergeContext: explicitModelOverride ? undefined : { agentId: ctx.agentId, scopeKey },
      tenantProviderId: credentials.tenantProviderId,
      startProviderAttempt: ctx.startProviderAttempt,
    });
  }

  /** Synthetic failed forward so a heal that can't be re-routed surfaces the original error. */
  private autofixReforwardError(reason: string): ForwardResult {
    return {
      response: new Response(JSON.stringify({ error: { message: `Auto-fix: ${reason}` } }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      }),
      isGoogle: false,
      isAnthropic: false,
      isChatGpt: false,
      isResponses: false,
      isCodeAssist: false,
    };
  }

  private validatePayload(body: ProxyRequestOptions['body']): void {
    const messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      // A ManifestError, not a bare BadRequestException: the proxy needs to tell
      // "Manifest refused this body" from "the provider returned a 400", or the
      // row lands in agent_messages blamed on the provider.
      throw new ManifestError('M300', HttpStatus.BAD_REQUEST);
    }
    sanitizeNullContent(messages as Record<string, unknown>[]);
  }

  private async resolveRouting(
    agentId: string,
    tenantId: string,
    body: ProxyRequestOptions['body'],
    sessionKey: string,
    specificityOverride: ProxyRequestOptions['specificityOverride'],
    headers: ProxyRequestOptions['headers'],
    apiMode: ProxyApiMode,
  ): Promise<ResolvedRouting> {
    const requestedModel = typeof body.model === 'string' ? body.model : undefined;
    // Anthropic Messages requests require a provider-native model field; only
    // OpenAI-compatible surfaces use /v1/models IDs as route overrides.
    if (apiMode !== 'messages' && requestedModel && requestedModel !== OPENAI_MODEL_ID_AUTO) {
      const explicit = await this.resolveExplicitModel(agentId, tenantId, requestedModel, headers);
      if (explicit) return explicit;
      return {
        tier: 'default' as const,
        route: null,
        fallback_routes: null,
        response_mode: DEFAULT_RESPONSE_MODE,
        confidence: 0,
        score: 0,
        reason: 'default' as const,
        explicit_model_unavailable: requestedModel,
      };
    }

    // Not guaranteed to be an array here: a healed body reaches this path from
    // forwardResolvedHealed, which never runs it past validatePayload. An
    // explicit model used to return before this line, so the fall-through is
    // what newly exposes it to a body Phoenix rewrote.
    const messages = (Array.isArray(body.messages) ? body.messages : []) as ScorerMessage[];
    const scoringMessages = this.filterScoringMessages(messages);
    const scoringTools = Array.isArray(body.tools) ? body.tools : undefined;
    const isHeartbeat = this.detectHeartbeat(scoringMessages);
    const recentTiers = this.momentum.getRecentTiers(sessionKey);
    const recentCategories = this.momentum.getRecentCategories(sessionKey);

    const baseResolved = await (isHeartbeat
      ? this.resolveService.resolveForTier(agentId, tenantId, 'simple')
      : this.resolveService.resolve(
          agentId,
          tenantId,
          scoringMessages,
          scoringTools,
          body.tool_choice,
          body.max_tokens as number | undefined,
          recentTiers,
          specificityOverride,
          recentCategories,
          headers,
        ));

    return baseResolved;
  }

  /**
   * Route the `model` an OpenAI-compatible client named in the body.
   *
   * A matching header tier wins: that rule is an override the operator
   * configured on purpose, and the SDK's `model` field is mandatory, so most
   * agents send a name they cannot change.
   *
   * Returns null when neither applies. The caller turns that into M302 instead
   * of falling back to automatic routing, because a concrete `model` is a
   * request for that model.
   */
  private async resolveExplicitModel(
    agentId: string,
    tenantId: string,
    requestedModel: string,
    headers: ProxyRequestOptions['headers'],
  ): Promise<ResolvedRouting | null> {
    if (headers) {
      const headerTier = await this.resolveService.resolveHeaderTier(agentId, tenantId, headers);
      if (headerTier) return headerTier;
    }

    const models = await this.modelDiscovery.getModelsForAgent(tenantId, agentId);
    const route = routeForOpenAiModelId(requestedModel, models);
    if (!route) {
      this.logger.warn(
        `Requested model "${requestedModel}" matches no connected model for agent=${agentId} — ` +
          `returning model-not-available`,
      );
      return null;
    }

    return {
      tier: 'default' as const,
      route,
      fallback_routes: null,
      response_mode: DEFAULT_RESPONSE_MODE,
      confidence: 1,
      score: 0,
      reason: 'default' as const,
      explicit_model_override: true,
    };
  }

  private async resolveCredentials(
    agentId: string,
    tenantId: string,
    resolved: { provider: string; auth_type?: AuthType; provider_key_label?: string },
  ): Promise<{
    apiKey: string;
    rawApiKey: string;
    resourceUrl?: string;
    providerRegion?: string | null;
    tenantProviderId: string | null;
  } | null> {
    // Single key selection per request: apiKey, the stamped tenant_provider_id,
    // and the region are all projected from this one row, so the forwarded
    // key and the recorded connection can never come from different rows.
    const key = await this.providerKeyService.selectProviderKey(
      tenantId,
      resolved.provider,
      resolved.auth_type,
      resolved.provider_key_label,
      agentId,
    );
    if (!key || key.apiKey === null) return null;
    const apiKey = key.apiKey;
    // NULL for the synthetic Ollama tile — it has no persisted row, so
    // stamping its id would violate the agent_messages FK.
    const tenantProviderId = key.id === SYNTHETIC_OLLAMA_PROVIDER_ID ? null : key.id;

    const unwrapped = await resolveApiKey(
      resolved.provider,
      apiKey,
      resolved.auth_type,
      agentId,
      tenantId,
      this.openaiOauth,
      this.minimaxOauth,
      this.anthropicOauth,
      this.geminiOauth,
      this.kiroOauth,
      this.xaiOauth,
      resolved.provider_key_label,
    );
    const unwrappedApiKey = unwrapped.apiKey;
    if (unwrappedApiKey === null) return null;
    let rawApiKey = apiKey;
    if (resolved.auth_type === 'subscription' && isRefreshableOAuthCredential(apiKey)) {
      // Deliberate re-read: resolveApiKey may have refreshed + persisted a
      // rotated OAuth blob (which also invalidates the key cache), so the
      // freshest stored value is fetched for the 401-retry path.
      rawApiKey =
        (await this.providerKeyService.getProviderApiKey(
          tenantId,
          resolved.provider,
          resolved.auth_type,
          resolved.provider_key_label,
          agentId,
        )) ?? apiKey;
    }
    return {
      apiKey: unwrappedApiKey,
      rawApiKey,
      resourceUrl: unwrapped.resourceUrl,
      providerRegion: key.region,
      tenantProviderId,
    };
  }

  private async tryFallbackChain(args: {
    agentId: string;
    tenantId: string;
    resolved: ResolvedRouting;
    primaryModel: string;
    forward: ForwardResult;
    body: ProxyRequestOptions['body'];
    chatBody?: ProxyRequestOptions['body'];
    stream: boolean;
    sessionKey: string;
    signal?: AbortSignal;
    signatureLookup: SignatureLookup;
    thinkingLookup: ThinkingBlockLookup;
    reasoningContentLookup: ReasoningContentLookup;
    apiMode: ProxyApiMode;
    paramMergeContext: ParamMergeContext;
    /** Primary connection id, carried so a fallback-success flow can attribute
     * its recorded primary-failure row to the connection that actually failed. */
    primaryTenantProviderId: string | null;
    startProviderAttempt?: StartProviderAttempt;
  }): Promise<ProxyResult | null> {
    const {
      agentId,
      tenantId,
      resolved,
      primaryModel,
      forward,
      body,
      chatBody,
      stream,
      sessionKey,
      signal,
      apiMode,
    } = args;
    // The resolver owns the effective route chain. Null is a definitive
    // "nothing remains", including when the only configured fallback was
    // promoted to primary. Reloading the persisted tier here would retry that
    // promoted route as its own fallback and could resurrect routes the
    // resolver deliberately skipped.
    let fallbackRoutes = resolved.fallback_routes ?? null;
    if ((resolved.response_mode ?? DEFAULT_RESPONSE_MODE) === 'stream') {
      const effectiveRoutes = effectiveRoutesForResponseMode(
        resolved.response_mode,
        resolved.route,
        fallbackRoutes,
      );
      fallbackRoutes = (effectiveRoutes.fallbackRoutes ?? []).filter(
        (route) => !routeEquals(route, resolved.route),
      );
    }
    if (!fallbackRoutes || fallbackRoutes.length === 0) return null;
    const fallbackModels = fallbackRoutes.map((r) => r.model);

    const primaryStatus = forward.response.status;
    const primaryErrorBody = await forward.response.text();
    const primaryProvider = resolved.route?.provider;
    const primaryAuth = resolved.route?.authType;
    const { success, failures } = await this.fallbackService.tryFallbacks(
      agentId,
      tenantId,
      fallbackModels,
      body,
      stream,
      sessionKey,
      primaryModel,
      signal,
      primaryProvider,
      primaryAuth,
      args.signatureLookup,
      args.thinkingLookup,
      apiMode,
      chatBody,
      fallbackRoutes,
      args.paramMergeContext,
      args.reasoningContentLookup,
      args.startProviderAttempt,
    );

    this.recordTierIfScoring(sessionKey, resolved.tier);
    this.recordCategoryIfValid(sessionKey, resolved.specificity_category);

    if (success) {
      // Re-snapshot for the fallback's actual provider — its model-scoped
      // params row (if any) is what was actually applied. Different model
      // → different lookup → different snapshot, matching the wire. The two
      // lookups are independent, so resolve them together.
      const [fallbackModelParams, fallbackSpecs] = await Promise.all([
        success.authType
          ? this.modelParamsService.get(
              args.paramMergeContext.agentId,
              args.paramMergeContext.scopeKey,
              success.provider,
              success.authType,
              success.model,
            )
          : null,
        success.authType
          ? this.providerParamSpecs.getSpecs(success.provider, success.authType, success.model)
          : [],
      ]);
      const fallbackRequestParams = snapshotRequestParams({
        body: body as Record<string, unknown>,
        modelParams: fallbackModelParams,
        specs: fallbackSpecs,
      });
      return {
        forward: success.forward,
        meta: this.buildBaseMeta(resolved, success.model, {
          provider: success.provider,
          auth_type: success.authType,
          // The label of the connection that actually served the fallback —
          // buildBaseMeta would otherwise stamp the PRIMARY route's label
          // next to the fallback's tenant_provider_id.
          provider_key_label: success.keyLabel,
          fallbackFromModel: primaryModel,
          fallbackIndex: success.fallbackIndex,
          primaryErrorStatus: primaryStatus,
          primaryErrorBody,
          primaryProvider,
          primaryAuthType: primaryAuth,
          primaryTenantProviderId: args.primaryTenantProviderId,
          primaryAttempt: forward.attempt,
          primaryProviderCallStarted: forward.providerCallStarted,
          attempt: success.forward.attempt,
          providerCallStarted: success.forward.providerCallStarted,
          tenantProviderId: success.tenantProviderId,
          request_params: fallbackRequestParams,
        }),
        failedFallbacks: failures,
      };
    }

    // All fallbacks exhausted — preserve the primary provider's real HTTP status.
    // The gateway uses the X-Manifest-Fallback-Exhausted header (set by the
    // response handler) to detect this case.
    const safeHeaders = new Headers(forward.response.headers);
    safeHeaders.delete('content-encoding');
    safeHeaders.delete('content-length');
    safeHeaders.delete('transfer-encoding');
    const rebuilt = new Response(primaryErrorBody, { status: primaryStatus, headers: safeHeaders });

    // Fallback exhausted — recorded against the primary provider, so use
    // the primary-provider snapshot for the row. Look up the primary's
    // model-params one more time so the snapshot reflects what was sent
    // before the chain failed.
    const [primaryModelParams, exhaustedSpecs] = await Promise.all([
      primaryProvider && primaryAuth && resolved.route
        ? this.modelParamsService.get(
            args.paramMergeContext.agentId,
            args.paramMergeContext.scopeKey,
            primaryProvider,
            primaryAuth as 'api_key' | 'subscription' | 'local',
            primaryModel,
          )
        : null,
      primaryProvider && primaryAuth && resolved.route
        ? this.providerParamSpecs.getSpecs(
            primaryProvider,
            primaryAuth as 'api_key' | 'subscription' | 'local',
            primaryModel,
          )
        : [],
    ]);
    const exhaustedRequestParams = snapshotRequestParams({
      body: body as Record<string, unknown>,
      modelParams: primaryModelParams,
      specs: exhaustedSpecs,
    });
    return {
      forward: {
        response: rebuilt,
        isGoogle: forward.isGoogle,
        isAnthropic: forward.isAnthropic,
        isChatGpt: forward.isChatGpt,
        isResponses: forward.isResponses,
        isCodeAssist: forward.isCodeAssist,
      },
      meta: this.buildBaseMeta(resolved, primaryModel, {
        request_params: exhaustedRequestParams,
        // Exhausted chain is recorded against the primary connection.
        tenantProviderId: args.primaryTenantProviderId,
        primaryAttempt: forward.attempt,
        primaryProviderCallStarted: forward.providerCallStarted,
        attempt: failures[failures.length - 1]?.attempt ?? forward.attempt,
        providerCallStarted:
          failures[failures.length - 1]?.providerCallStarted ?? forward.providerCallStarted,
      }),
      failedFallbacks: failures,
    };
  }

  private buildBaseMeta(
    resolved: ResolvedRouting,
    model: string,
    overrides: Partial<RoutingMeta> = {},
  ): RoutingMeta {
    const directOverride = resolved.explicit_model_override === true;
    return {
      tier: directOverride ? 'direct' : resolved.tier,
      model,
      provider: overrides.provider ?? resolved.route?.provider ?? '',
      confidence: resolved.confidence,
      reason: directOverride ? 'direct' : resolved.reason,
      auth_type: resolved.route?.authType,
      specificity_category: resolved.specificity_category,
      provider_key_label: resolved.route?.keyLabel ?? undefined,
      header_tier_id: resolved.header_tier_id,
      header_tier_name: resolved.header_tier_name,
      header_tier_color: resolved.header_tier_color,
      output_modality: resolved.output_modality,
      response_mode: resolved.response_mode ?? DEFAULT_RESPONSE_MODE,
      ...overrides,
    };
  }

  private recordCategoryIfValid(sessionKey: string, category: string | undefined): void {
    if (!category) return;
    if (!(SPECIFICITY_CATEGORIES as readonly string[]).includes(category)) return;
    this.momentum.recordCategory(sessionKey, category as SpecificityCategory);
  }

  private async enforceLimits(tenantId: string, agentName?: string): Promise<string | null> {
    if (!agentName) return null;
    const exceeded = await this.limitCheck.checkLimits(tenantId, agentName);
    if (!exceeded) return null;

    const fmt =
      exceeded.metricType === 'cost'
        ? `$${Number(exceeded.actual).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : Number(exceeded.actual).toLocaleString(undefined, { maximumFractionDigits: 0 });
    const threshFmt =
      exceeded.metricType === 'cost'
        ? `$${Number(exceeded.threshold).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : Number(exceeded.threshold).toLocaleString(undefined, { maximumFractionDigits: 0 });
    const dashboardUrl = getDashboardUrl(this.config, agentName, 'limits');
    return formatManifestError('M200', {
      metric: exceeded.metricType,
      used: fmt,
      threshold: threshFmt,
      period: exceeded.period,
      dashboardUrl,
    });
  }

  private filterScoringMessages(messages: ScorerMessage[]): ScorerMessage[] {
    return messages
      .filter((m) => !SCORING_EXCLUDED_ROLES.has(m.role))
      .slice(-SCORING_RECENT_MESSAGES);
  }

  private detectHeartbeat(scoringMessages: ScorerMessage[]): boolean {
    const lastUser = [...scoringMessages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return false;
    if (typeof lastUser.content === 'string') return lastUser.content.includes('HEARTBEAT_OK');
    if (Array.isArray(lastUser.content)) {
      return (lastUser.content as { type?: string; text?: string }[]).some(
        (p) => p.type === 'text' && typeof p.text === 'string' && p.text.includes('HEARTBEAT_OK'),
      );
    }
    return false;
  }

  private buildNoProviderResult(stream: boolean, agentName?: string): ProxyResult {
    const dashboardUrl = getDashboardUrl(this.config, agentName, 'routing');
    const content = formatManifestError('M101', { dashboardUrl });
    return buildFriendlyResponse(content, stream, 'no_provider', 'M101');
  }

  private buildModelUnavailableResult(
    stream: boolean,
    agentName: string | undefined,
    model: string,
  ): ProxyResult {
    const dashboardUrl = getDashboardUrl(this.config, agentName, 'routing');
    const content = formatManifestError('M302', { model, dashboardUrl });
    return buildFriendlyResponse(content, stream, 'model_not_available', 'M302');
  }
}

/** Replace null content fields with empty string to avoid upstream rejections. */
function sanitizeNullContent(messages: Record<string, unknown>[]): void {
  for (const msg of messages) {
    if (msg && typeof msg === 'object' && msg.content === null) msg.content = '';
  }
}
