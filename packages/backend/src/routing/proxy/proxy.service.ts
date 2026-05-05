import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResolveService } from '../resolve/resolve.service';
import { ProviderKeyService } from '../routing-core/provider-key.service';
import { TierService } from '../routing-core/tier.service';
import { OpenaiOauthService } from '../oauth/openai-oauth.service';
import { MinimaxOauthService } from '../oauth/minimax-oauth.service';
import { ForwardResult } from './provider-client';
import { SessionMomentumService } from './session-momentum.service';
import { LimitCheckService } from '../../notifications/services/limit-check.service';
import { shouldTriggerFallback } from './fallback-status-codes';
import { Tier, TIERS, ScorerMessage } from '../../scoring/types';
import type { SpecificityCategory, TierSlot } from 'manifest-shared';
import { SPECIFICITY_CATEGORIES, applyRequestParamDefaults } from 'manifest-shared';
import {
  ProxyFallbackService,
  FailedFallback,
  normalizeProviderModel,
  resolveApiKey,
} from './proxy-fallback.service';
import {
  ProxyApiMode,
  ProxyRequestOptions,
  SignatureLookup,
  ThinkingBlockLookup,
} from './proxy-types';
import { ThoughtSignatureCache } from './thought-signature-cache';
import { ThinkingBlockCache } from './thinking-block-cache';
import { buildFriendlyResponse, getDashboardUrl } from './proxy-friendly-response';
import { formatManifestError } from '../../common/errors/error-codes';
import { peekStream } from './stream-warmup';
import type { AuthType } from 'manifest-shared';
import { toChatCompletionsRequest } from './responses-adapter';

const STREAM_WARMUP_MS = 15_000;

type ResolvedRouting = Awaited<ReturnType<ResolveService['resolve']>>;

/**
 * Roles excluded from scoring. Personal AI agents (OpenClaw, Hermes, and
 * similar tools) inject a large, keyword-rich system prompt with every
 * request. Scoring it inflates every request to the most expensive tier.
 * We strip these before the scorer sees them, but forward the full
 * unmodified body to the real provider.
 */
const SCORING_EXCLUDED_ROLES = new Set(['system', 'developer']);
const SCORING_RECENT_MESSAGES = 10;
const MAX_MESSAGES_PER_REQUEST = 1000;

export interface RoutingMeta {
  tier: TierSlot;
  model: string;
  provider: string;
  confidence: number;
  reason: string;
  auth_type?: string;
  specificity_category?: string;
  header_tier_id?: string;
  header_tier_name?: string;
  header_tier_color?: string;
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
}

export interface ProxyResult {
  forward: ForwardResult;
  meta: RoutingMeta;
  failedFallbacks?: FailedFallback[];
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly resolveService: ResolveService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly tierService: TierService,
    private readonly openaiOauth: OpenaiOauthService,
    private readonly minimaxOauth: MinimaxOauthService,
    private readonly momentum: SessionMomentumService,
    private readonly limitCheck: LimitCheckService,
    private readonly fallbackService: ProxyFallbackService,
    private readonly config: ConfigService,
    private readonly signatureCache: ThoughtSignatureCache,
    private readonly thinkingCache: ThinkingBlockCache,
  ) {}

  async proxyRequest(opts: ProxyRequestOptions): Promise<ProxyResult> {
    const {
      agentId,
      userId,
      body,
      sessionKey,
      tenantId,
      agentName,
      signal,
      specificityOverride,
      headers,
    } = opts;
    const apiMode = opts.apiMode ?? 'chat_completions';
    const chatBody = apiMode === 'responses' ? toChatCompletionsRequest(body) : undefined;
    const routingBody = chatBody ?? body;
    this.validatePayload(routingBody);

    const limitMessage = await this.enforceLimits(tenantId, agentName);
    if (limitMessage) {
      return buildFriendlyResponse(limitMessage, routingBody.stream === true, 'limit_exceeded');
    }

    const resolved = await this.resolveRouting(
      agentId,
      routingBody,
      sessionKey,
      specificityOverride,
      headers,
    );
    if (!resolved.route) {
      this.logger.warn(
        `No route available for agent=${agentId}: ` +
          `tier=${resolved.tier} confidence=${resolved.confidence} reason=${resolved.reason}`,
      );
      return this.buildNoProviderResult(body.stream === true, agentName);
    }

    const route = resolved.route;
    const credentials = await this.resolveCredentials(agentId, userId, {
      provider: route.provider,
      auth_type: route.authType,
    });
    if (credentials === null) {
      const dashboardUrl = getDashboardUrl(this.config, agentName, 'routing');
      const content = formatManifestError('M100', { provider: route.provider, dashboardUrl });
      return buildFriendlyResponse(content, body.stream === true, 'no_provider_key');
    }

    const primaryModel = normalizeProviderModel(route.provider, route.model);
    this.logger.log(
      `Proxy: tier=${resolved.tier} model=${primaryModel} provider=${route.provider} auth_type=${route.authType} confidence=${resolved.confidence}`,
    );

    const stream = body.stream === true;
    const signatureLookup = (toolCallId: string) =>
      this.signatureCache.retrieve(sessionKey, toolCallId);
    const thinkingLookup = (firstToolUseId: string) =>
      this.thinkingCache.retrieve(sessionKey, firstToolUseId);

    // Merge per-assignment defaults (e.g. DeepSeek's thinking-mode toggle)
    // into the outbound bodies. Client-supplied fields win by presence.
    // Done once here so primary forward, stream warmup retries, and the
    // fallback chain all use the same merged payload.
    const effectiveBody = applyRequestParamDefaults(body, resolved.param_defaults);
    const effectiveChatBody = chatBody
      ? applyRequestParamDefaults(chatBody, resolved.param_defaults)
      : undefined;

    const forward = await this.fallbackService.tryForwardToProvider({
      provider: route.provider,
      apiKey: credentials.apiKey,
      model: primaryModel,
      body: effectiveBody,
      chatBody: effectiveChatBody,
      stream,
      sessionKey,
      signal,
      authType: route.authType,
      apiMode,
      resourceUrl: credentials.resourceUrl,
      providerRegion: credentials.providerRegion,
      signatureLookup,
      thinkingLookup,
    });

    if (!forward.response.ok && shouldTriggerFallback(forward.response.status)) {
      const fallbackResult = await this.tryFallbackChain({
        agentId,
        userId,
        resolved,
        primaryModel,
        forward,
        body: effectiveBody,
        chatBody: effectiveChatBody,
        stream,
        sessionKey,
        signal,
        signatureLookup,
        thinkingLookup,
        apiMode,
      });
      if (fallbackResult) return fallbackResult;
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
        };
        this.recordTierIfScoring(sessionKey, resolved.tier);
        this.recordCategoryIfValid(sessionKey, resolved.specificity_category);
        return { forward: peeked, meta: this.buildBaseMeta(resolved, primaryModel) };
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
      };
      const fallbackResult = await this.tryFallbackChain({
        agentId,
        userId,
        resolved,
        primaryModel,
        forward: syntheticForward,
        body: effectiveBody,
        chatBody: effectiveChatBody,
        stream,
        sessionKey,
        signal,
        signatureLookup,
        thinkingLookup,
        apiMode,
      });
      if (fallbackResult) return fallbackResult;

      // Warmup failed and no fallbacks available: return the synthetic 502
      // instead of the original forward (whose body was consumed by peekStream).
      this.recordTierIfScoring(sessionKey, resolved.tier);
      this.recordCategoryIfValid(sessionKey, resolved.specificity_category);
      return { forward: syntheticForward, meta: this.buildBaseMeta(resolved, primaryModel) };
    }

    this.recordTierIfScoring(sessionKey, resolved.tier);
    this.recordCategoryIfValid(sessionKey, resolved.specificity_category);
    return {
      forward,
      meta: this.buildBaseMeta(resolved, primaryModel),
    };
  }

  private recordTierIfScoring(sessionKey: string, tier: TierSlot): void {
    if ((TIERS as readonly string[]).includes(tier)) {
      this.momentum.recordTier(sessionKey, tier as Tier);
    }
  }

  private validatePayload(body: ProxyRequestOptions['body']): void {
    const messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestException(formatManifestError('M300'));
    }
    sanitizeNullContent(messages as Record<string, unknown>[]);
    if (messages.length > MAX_MESSAGES_PER_REQUEST) {
      throw new BadRequestException(formatManifestError('M301', { max: MAX_MESSAGES_PER_REQUEST }));
    }
  }

  private async resolveRouting(
    agentId: string,
    body: ProxyRequestOptions['body'],
    sessionKey: string,
    specificityOverride: ProxyRequestOptions['specificityOverride'],
    headers: ProxyRequestOptions['headers'],
  ) {
    const messages = body.messages as ScorerMessage[];
    const scoringMessages = this.filterScoringMessages(messages);
    const scoringTools = Array.isArray(body.tools) ? body.tools : undefined;
    const isHeartbeat = this.detectHeartbeat(scoringMessages);
    const recentTiers = this.momentum.getRecentTiers(sessionKey);
    const recentCategories = this.momentum.getRecentCategories(sessionKey);

    return isHeartbeat
      ? this.resolveService.resolveForTier(agentId, 'simple')
      : this.resolveService.resolve(
          agentId,
          scoringMessages,
          scoringTools,
          body.tool_choice,
          body.max_tokens as number | undefined,
          recentTiers,
          specificityOverride,
          recentCategories,
          headers,
        );
  }

  private async resolveCredentials(
    agentId: string,
    userId: string,
    resolved: { provider: string; auth_type?: AuthType },
  ): Promise<{ apiKey: string; resourceUrl?: string; providerRegion?: string | null } | null> {
    const apiKey = await this.providerKeyService.getProviderApiKey(
      agentId,
      resolved.provider,
      resolved.auth_type,
    );
    if (apiKey === null) return null;

    const unwrapped = await resolveApiKey(
      resolved.provider,
      apiKey,
      resolved.auth_type,
      agentId,
      userId,
      this.openaiOauth,
      this.minimaxOauth,
    );
    const providerRegion = await this.providerKeyService.getProviderRegion(
      agentId,
      resolved.provider,
      resolved.auth_type,
    );
    return { ...unwrapped, providerRegion };
  }

  private async tryFallbackChain(args: {
    agentId: string;
    userId: string;
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
    apiMode: ProxyApiMode;
  }): Promise<ProxyResult | null> {
    const {
      agentId,
      userId,
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
    if (!fallbackRoutes || fallbackRoutes.length === 0) return null;
    const fallbackModels = fallbackRoutes.map((r) => r.model);

    const primaryStatus = forward.response.status;
    const primaryErrorBody = await forward.response.text();
    const primaryProvider = resolved.route?.provider;
    const primaryAuth = resolved.route?.authType;
    const { success, failures } = await this.fallbackService.tryFallbacks(
      agentId,
      userId,
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
    );

    this.recordTierIfScoring(sessionKey, resolved.tier);
    this.recordCategoryIfValid(sessionKey, resolved.specificity_category);

    if (success) {
      return {
        forward: success.forward,
        meta: this.buildBaseMeta(resolved, success.model, {
          provider: success.provider,
          fallbackFromModel: primaryModel,
          fallbackIndex: success.fallbackIndex,
          primaryErrorStatus: primaryStatus,
          primaryErrorBody,
          primaryProvider,
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

    return {
      forward: {
        response: rebuilt,
        isGoogle: forward.isGoogle,
        isAnthropic: forward.isAnthropic,
        isChatGpt: forward.isChatGpt,
      },
      meta: this.buildBaseMeta(resolved, primaryModel),
      failedFallbacks: failures,
    };
  }

  private buildBaseMeta(
    resolved: ResolvedRouting,
    model: string,
    overrides: Partial<RoutingMeta> = {},
  ): RoutingMeta {
    return {
      tier: resolved.tier,
      model,
      provider: overrides.provider ?? resolved.route?.provider ?? '',
      confidence: resolved.confidence,
      reason: resolved.reason,
      auth_type: resolved.route?.authType,
      specificity_category: resolved.specificity_category,
      header_tier_id: resolved.header_tier_id,
      header_tier_name: resolved.header_tier_name,
      header_tier_color: resolved.header_tier_color,
      ...overrides,
    };
  }

  private recordCategoryIfValid(sessionKey: string, category: string | undefined): void {
    if (!category) return;
    if (!(SPECIFICITY_CATEGORIES as readonly string[]).includes(category)) return;
    this.momentum.recordCategory(sessionKey, category as SpecificityCategory);
  }

  private async enforceLimits(tenantId?: string, agentName?: string): Promise<string | null> {
    if (!tenantId || !agentName) return null;
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
