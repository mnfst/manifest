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
import { Tier, ScorerMessage } from '../../scoring/types';
import type { SpecificityCategory } from 'manifest-shared';
import { SPECIFICITY_CATEGORIES } from 'manifest-shared';
import {
  ProxyFallbackService,
  FailedFallback,
  normalizeProviderModel,
  resolveApiKey,
} from './proxy-fallback.service';
import { ProxyRequestOptions, SignatureLookup, ThinkingBlockLookup } from './proxy-types';
import { ThoughtSignatureCache } from './thought-signature-cache';
import { ThinkingBlockCache } from './thinking-block-cache';
import { buildFriendlyResponse, getDashboardUrl } from './proxy-friendly-response';
import { estimateTokens } from './token-estimate';
import { REASON_CONTEXT_WINDOW_EXCEEDED } from '../dto/resolve-response';
import type { AuthType } from 'manifest-shared';

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

/**
 * Maximum estimated token count for a request to still be treated as a
 * heartbeat. Real heartbeats are tens of tokens at most; this ceiling is
 * generous (1000) but low enough to stop an adversarial/oversized payload
 * that happens to contain the `HEARTBEAT_OK` substring from bypassing
 * size-aware routing.
 */
const HEARTBEAT_TOKEN_CEILING = 1_000;

export interface RoutingMeta {
  tier: Tier;
  model: string;
  provider: string;
  confidence: number;
  reason: string;
  auth_type?: string;
  specificity_category?: string;
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
  /** Estimated tokens for the request. Surfaced in response headers. */
  estimatedTokens?: number;
  /** Context window of the chosen model. Surfaced in response headers. */
  usedContextWindow?: number;
  /**
   * Set when Phase 2 size check escalated the request out of its scored
   * tier because no model in the tier could fit. Carries the original
   * tier so the client can log what actually happened.
   */
  sizeEscalatedFrom?: Tier;
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
    const { agentId, userId, body, sessionKey, tenantId, agentName, signal, specificityOverride } =
      opts;
    this.validatePayload(body);

    const limitMessage = await this.enforceLimits(tenantId, agentName);
    if (limitMessage) {
      return buildFriendlyResponse(limitMessage, body.stream === true, 'limit_exceeded');
    }

    const resolved = await this.resolveRouting(agentId, body, sessionKey, specificityOverride);
    if (resolved.reason === REASON_CONTEXT_WINDOW_EXCEEDED) {
      return this.buildContextExceededResult(resolved, body.stream === true, agentName);
    }
    if (!resolved.model || !resolved.provider) {
      this.logger.warn(
        `No model available for agent=${agentId}: ` +
          `tier=${resolved.tier} model=${resolved.model} provider=${resolved.provider} ` +
          `confidence=${resolved.confidence} reason=${resolved.reason}`,
      );
      return this.buildNoProviderResult(body.stream === true, agentName);
    }

    const credentials = await this.resolveCredentials(agentId, userId, {
      provider: resolved.provider,
      auth_type: resolved.auth_type,
    });
    if (credentials === null) {
      const dashboardUrl = getDashboardUrl(this.config, agentName, 'routing');
      const content = `[🦚 Manifest] No ${resolved.provider} API key yet. Add one here: ${dashboardUrl}`;
      return buildFriendlyResponse(content, body.stream === true, 'no_provider_key');
    }

    const primaryModel = normalizeProviderModel(resolved.provider, resolved.model);
    this.logger.log(
      `Proxy: tier=${resolved.tier} model=${primaryModel} provider=${resolved.provider} auth_type=${resolved.auth_type} confidence=${resolved.confidence}`,
    );

    const stream = body.stream === true;
    const signatureLookup = (toolCallId: string) =>
      this.signatureCache.retrieve(sessionKey, toolCallId);
    const thinkingLookup = (firstToolUseId: string) =>
      this.thinkingCache.retrieve(sessionKey, firstToolUseId);

    const forward = await this.fallbackService.tryForwardToProvider({
      provider: resolved.provider,
      apiKey: credentials.apiKey,
      model: primaryModel,
      body,
      stream,
      sessionKey,
      signal,
      authType: resolved.auth_type,
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
        body,
        stream,
        sessionKey,
        signal,
        signatureLookup,
        thinkingLookup,
      });
      if (fallbackResult) return fallbackResult;
    }

    this.momentum.recordTier(sessionKey, resolved.tier as Tier);
    this.recordCategoryIfValid(sessionKey, resolved.specificity_category);
    return {
      forward,
      meta: this.buildBaseMeta(resolved, primaryModel),
    };
  }

  private validatePayload(body: ProxyRequestOptions['body']): void {
    const messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestException('messages array is required');
    }
    sanitizeNullContent(messages as Record<string, unknown>[]);
    if (messages.length > MAX_MESSAGES_PER_REQUEST) {
      throw new BadRequestException(
        `messages array exceeds maximum length of ${MAX_MESSAGES_PER_REQUEST}`,
      );
    }
  }

  private async resolveRouting(
    agentId: string,
    body: ProxyRequestOptions['body'],
    sessionKey: string,
    specificityOverride: ProxyRequestOptions['specificityOverride'],
  ) {
    const messages = body.messages as ScorerMessage[];
    const scoringMessages = this.filterScoringMessages(messages);
    const scoringTools = Array.isArray(body.tools) ? body.tools : undefined;
    const recentTiers = this.momentum.getRecentTiers(sessionKey);
    const recentCategories = this.momentum.getRecentCategories(sessionKey);

    // Estimate against the full message array and tool list — the scoring
    // window is a subset of the payload, but the *fit* check must reflect
    // what will actually be forwarded to the provider. Heartbeat detection
    // uses `.includes('HEARTBEAT_OK')` so a legitimate user message that
    // happens to mention the sentinel in a large payload would otherwise
    // bypass size-aware routing and fire at the `simple` tier regardless
    // of whether it can fit. Gate on the full request budget (estimated
    // input + max_tokens reserve) so a tiny prompt with huge max_tokens
    // can't slip through either — real heartbeats never request a large
    // output.
    const estimatedTokens = estimateTokens(messages, scoringTools);
    const reservedOutput =
      typeof body.max_tokens === 'number' && body.max_tokens > 0 ? body.max_tokens : 0;
    const isHeartbeat =
      this.detectHeartbeat(scoringMessages) &&
      estimatedTokens + reservedOutput <= HEARTBEAT_TOKEN_CEILING;
    if (isHeartbeat) return this.resolveService.resolveForTier(agentId, 'simple');

    return this.resolveService.resolve(
      agentId,
      scoringMessages,
      scoringTools,
      body.tool_choice,
      body.max_tokens as number | undefined,
      recentTiers,
      specificityOverride,
      recentCategories,
      estimatedTokens,
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
    stream: boolean;
    sessionKey: string;
    signal?: AbortSignal;
    signatureLookup: SignatureLookup;
    thinkingLookup: ThinkingBlockLookup;
  }): Promise<ProxyResult | null> {
    const { agentId, userId, resolved, primaryModel, forward, body, stream, sessionKey, signal } =
      args;
    const tiers = await this.tierService.getTiers(agentId);
    const assignment = tiers.find((t) => t.tier === resolved.tier);
    const fallbackModels = resolved.fallback_models ?? assignment?.fallback_models;
    if (!fallbackModels || fallbackModels.length === 0) return null;

    const primaryStatus = forward.response.status;
    const primaryErrorBody = await forward.response.text();
    const { success, failures } = await this.fallbackService.tryFallbacks(
      agentId,
      userId,
      fallbackModels,
      body,
      stream,
      sessionKey,
      primaryModel,
      signal,
      resolved.provider ?? undefined,
      resolved.auth_type,
      args.signatureLookup,
      args.thinkingLookup,
    );

    this.momentum.recordTier(sessionKey, resolved.tier as Tier);
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
          primaryProvider: resolved.provider ?? undefined,
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
    resolved: {
      tier: string;
      confidence: number;
      reason: string;
      auth_type?: string;
      specificity_category?: string;
      provider?: string | null;
      estimated_tokens?: number;
      used_context_window?: number;
      size_escalated_from?: Tier;
    },
    model: string,
    overrides: Partial<RoutingMeta> = {},
  ): RoutingMeta {
    return {
      tier: resolved.tier as Tier,
      model,
      provider: overrides.provider ?? resolved.provider ?? '',
      confidence: resolved.confidence,
      reason: resolved.reason,
      auth_type: resolved.auth_type,
      specificity_category: resolved.specificity_category,
      estimatedTokens: resolved.estimated_tokens,
      usedContextWindow: resolved.used_context_window,
      sizeEscalatedFrom: resolved.size_escalated_from,
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
    return `[🦚 Manifest] You hit your ${exceeded.metricType} limit: ${fmt} used, ${threshFmt}/${exceeded.period} allowed. Adjust it here: ${dashboardUrl}`;
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
    const content = `[🦚 Manifest] You're connected, but no providers are set up yet. Add one here: ${dashboardUrl}`;
    return buildFriendlyResponse(content, stream, 'no_provider');
  }

  /**
   * Phase 2: no model in any connected tier can fit this request. Tell
   * the user exactly what the budget looked like — breaking out input
   * vs reserved output matters because they're independently actionable:
   * "shorten the conversation" fixes input overshoot, "lower max_tokens"
   * fixes reserve overshoot. Lumping them together made the message
   * nonsensical when the reserve was the real blocker.
   */
  private buildContextExceededResult(
    resolved: ResolvedRouting,
    stream: boolean,
    agentName?: string,
  ): ProxyResult {
    const dashboardUrl = getDashboardUrl(this.config, agentName, 'routing');
    const estimated = resolved.estimated_tokens ?? 0;
    const reserved = resolved.reserved_output_tokens ?? 0;
    const total = estimated + reserved;
    const largest = resolved.largest_available_context ?? 0;
    const reservedSuffix =
      reserved > 0 ? ` + ${reserved.toLocaleString()} reserved for output` : '';
    const content =
      `[🦚 Manifest] Request needs ~${total.toLocaleString()} tokens ` +
      `(${estimated.toLocaleString()} input${reservedSuffix}), ` +
      `but the largest connected model's context window is ${largest.toLocaleString()}. ` +
      `Shorten the conversation, lower \`max_tokens\`, or connect a larger-context provider: ${dashboardUrl}`;
    return buildFriendlyResponse(content, stream, REASON_CONTEXT_WINDOW_EXCEEDED);
  }
}

/** Replace null content fields with empty string to avoid upstream rejections. */
function sanitizeNullContent(messages: Record<string, unknown>[]): void {
  for (const msg of messages) {
    if (msg && typeof msg === 'object' && msg.content === null) msg.content = '';
  }
}
