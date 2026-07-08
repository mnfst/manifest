import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResolveService } from '../resolve/resolve.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import {
  ProviderKeyService,
  SYNTHETIC_OLLAMA_PROVIDER_ID,
} from '../routing-core/provider-key.service';
import { TierService } from '../routing-core/tier.service';
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
} from './proxy-types';
import { ThoughtSignatureCache } from './thought-signature-cache';
import { ThinkingBlockCache } from './thinking-block-cache';
import { ReasoningContentCache } from './reasoning-content-cache';
import { AgentModelParamsService } from '../routing-core/agent-model-params.service';
import { ProviderParamSpecService } from '../routing-core/provider-param-spec.service';
import { buildFriendlyResponse, getDashboardUrl } from './proxy-friendly-response';
import { formatManifestError } from '../../common/errors/error-codes';
import { peekStream, STREAM_WARMUP_MS } from './stream-warmup';
import { toChatCompletionsRequest } from './responses-adapter';
import { messagesToChatCompletionsRequest } from './anthropic-messages-adapter';
import { effectiveRoutesForResponseMode } from '../routing-core/response-mode-guard';
import { OPENAI_MODEL_ID_AUTO, routeForOpenAiModelId } from './openai-model-id';
import { AutofixService } from '../autofix/autofix.service';
import type { AutofixRecord } from '../autofix/autofix.types';

type ResolvedRouting = Awaited<ReturnType<ResolveService['resolve']>> & {
  explicit_model_override?: boolean;
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
  auth_type?: string;
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
  originalModel: string | undefined;
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
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly resolveService: ResolveService,
    private readonly modelDiscovery: ModelDiscoveryService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly tierService: TierService,
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
    const { agentId, tenantId, body, sessionKey, agentName, signal, specificityOverride, headers } =
      opts;
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
      return buildFriendlyResponse(limitMessage, routingBody.stream === true, 'limit_exceeded');
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
      return buildFriendlyResponse(content, stream, 'no_provider_key');
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
    });

    // Auto-fix runs BEFORE the fallback chain: heal a repairable 4xx and retry
    // the patched request, so a fixable request isn't sprayed across every
    // fallback provider. A no-op unless the agent opted in and the forward
    // failed with a repairable status, so successful traffic is untouched.
    const autofixAttempt = await this.autofixService.maybeHeal({
      forward,
      agentId,
      tenantId,
      provider: route.provider,
      apiMode,
      requestBody: body,
      // Report the resolved provider model to Phoenix (the body may carry the
      // `auto` routing alias, which Phoenix's model-keyed catalog can't map).
      resolvedModel: primaryModel,
      reforward: (healedBody) =>
        this.reforwardHealed(healedBody, {
          agentId,
          tenantId,
          apiMode,
          sessionKey,
          signal,
          stream,
          specificityOverride,
          headers,
          originalModel: typeof body.model === 'string' ? body.model : undefined,
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
        }),
    });
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
      });
      if (fallbackResult) return { ...fallbackResult, autofix: autofixRecord };
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
        };
        this.recordTierIfScoring(sessionKey, resolved.tier);
        this.recordCategoryIfValid(sessionKey, resolved.specificity_category);
        return {
          forward: peeked,
          meta: this.buildBaseMeta(resolved, primaryModel, {
            request_params: primaryRequestParams,
            tenantProviderId: credentials.tenantProviderId,
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
        isGoogle: forward.isGoogle,
        isAnthropic: forward.isAnthropic,
        isChatGpt: forward.isChatGpt,
        isResponses: forward.isResponses,
        isCodeAssist: forward.isCodeAssist,
        structuredOutputToolName: forward.structuredOutputToolName,
        responsesTextFormat: forward.responsesTextFormat,
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
        });
        if (fallbackResult) return { ...fallbackResult, autofix: autofixRecord };
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
   * Re-send an Auto-fix-healed body to a provider. Same model → reuse the
   * already-resolved route and re-apply the agent's param merge so configured
   * model params aren't dropped (M3). Model changed (e.g. an unknown-model fix)
   * → re-resolve so the new model reaches the right provider/key (M5).
   */
  private reforwardHealed(
    healedBody: Record<string, unknown>,
    ctx: HealedReforwardContext,
  ): Promise<ForwardResult> {
    const healedModel = typeof healedBody.model === 'string' ? healedBody.model : undefined;
    if (healedModel && healedModel !== ctx.originalModel) {
      return this.forwardResolvedHealed(healedBody, ctx);
    }
    return this.fallbackService.tryForwardToProvider({
      provider: ctx.provider,
      apiKey: ctx.apiKey,
      model: ctx.model,
      body: healedBody,
      chatBody: this.toChatBody(ctx.apiMode, healedBody),
      stream: ctx.stream,
      sessionKey: ctx.sessionKey,
      signal: ctx.signal,
      agentId: ctx.agentId,
      tenantId: ctx.tenantId,
      rawApiKey: ctx.rawApiKey,
      providerKeyLabel: ctx.keyLabel,
      authType: ctx.authType,
      apiMode: ctx.apiMode,
      resourceUrl: ctx.resourceUrl,
      providerRegion: ctx.providerRegion,
      signatureLookup: ctx.signatureLookup,
      thinkingLookup: ctx.thinkingLookup,
      reasoningContentLookup: ctx.reasoningContentLookup,
      paramMergeContext: ctx.paramMergeContext,
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
      throw new BadRequestException(formatManifestError('M300'));
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
      const models = await this.modelDiscovery.getModelsForAgent(tenantId, agentId);
      return {
        tier: 'default' as const,
        route: routeForOpenAiModelId(requestedModel, models),
        fallback_routes: null,
        response_mode: DEFAULT_RESPONSE_MODE,
        confidence: 1,
        score: 0,
        reason: 'default' as const,
        explicit_model_override: true,
      };
    }

    const messages = body.messages as ScorerMessage[];
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
    // Prefer the resolver's fallback_routes (which already contains the right
    // tier's routes); fall back to a fresh tier lookup if the resolver returned
    // null (e.g. the tier itself was missing).
    let fallbackRoutes = resolved.fallback_routes ?? null;
    if (!fallbackRoutes) {
      const tiers = await this.tierService.getTiers(agentId);
      const assignment = tiers.find((t) => t.tier === resolved.tier);
      fallbackRoutes = assignment?.fallback_routes ?? null;
    }
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
    return buildFriendlyResponse(content, stream, 'no_provider');
  }
}

/** Replace null content fields with empty string to avoid upstream rejections. */
function sanitizeNullContent(messages: Record<string, unknown>[]): void {
  for (const msg of messages) {
    if (msg && typeof msg === 'object' && msg.content === null) msg.content = '';
  }
}
