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
import {
  ProxyFallbackService,
  FailedFallback,
  normalizeProviderModel,
  resolveApiKey,
} from './proxy-fallback.service';
import { ProxyRequestOptions } from './proxy-types';
import { ThoughtSignatureCache } from './thought-signature-cache';
import { ThinkingBlockCache } from './thinking-block-cache';
import { buildFriendlyResponse, getDashboardUrl } from './proxy-friendly-response';

export { FailedFallback } from './proxy-fallback.service';

/**
 * Roles excluded from scoring. Personal AI agents (OpenClaw, Hermes, and
 * similar tools) inject a large, keyword-rich system prompt with every
 * request. Scoring it inflates every request to the most expensive tier.
 * We strip these before the scorer sees them, but forward the full
 * unmodified body to the real provider.
 */
const SCORING_EXCLUDED_ROLES = new Set(['system', 'developer']);
const SCORING_RECENT_MESSAGES = 10;

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
    const messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestException('messages array is required');
    }
    sanitizeNullContent(messages as Record<string, unknown>[]);

    // Basic payload size guard — reject absurdly large message arrays
    if (messages.length > 1000) {
      throw new BadRequestException('messages array exceeds maximum length of 1000');
    }

    const limitMessage = await this.enforceLimits(tenantId, agentName);
    if (limitMessage) {
      return buildFriendlyResponse(limitMessage, body.stream === true, 'limit_exceeded');
    }

    const scoringMessages = this.filterScoringMessages(messages as ScorerMessage[]);
    const scoringTools = Array.isArray(body.tools) ? body.tools : undefined;
    const isHeartbeat = this.detectHeartbeat(scoringMessages);
    const recentTiers = this.momentum.getRecentTiers(sessionKey);

    const resolved = isHeartbeat
      ? await this.resolveService.resolveForTier(agentId, 'simple')
      : await this.resolveService.resolve(
          agentId,
          scoringMessages,
          scoringTools,
          body.tool_choice,
          body.max_tokens as number | undefined,
          recentTiers,
          specificityOverride,
        );

    if (!resolved.model || !resolved.provider) {
      this.logger.warn(
        `No model available for agent=${agentId}: ` +
          `tier=${resolved.tier} model=${resolved.model} provider=${resolved.provider} ` +
          `confidence=${resolved.confidence} reason=${resolved.reason}`,
      );
      return this.buildNoProviderResult(body.stream === true, agentName);
    }

    let apiKey = await this.providerKeyService.getProviderApiKey(
      agentId,
      resolved.provider,
      resolved.auth_type,
    );
    if (apiKey === null) {
      const dashboardUrl = getDashboardUrl(this.config, agentName, 'routing');
      const content = `[🦚 Manifest] No ${resolved.provider} API key yet. Add one here: ${dashboardUrl}`;
      return buildFriendlyResponse(content, body.stream === true, 'no_provider_key');
    }

    const resolvedCredentials = await resolveApiKey(
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
      apiKey: resolvedCredentials.apiKey,
      model: primaryModel,
      body,
      stream,
      sessionKey,
      signal,
      authType: resolved.auth_type,
      resourceUrl: resolvedCredentials.resourceUrl,
      providerRegion,
      signatureLookup,
      thinkingLookup,
    });

    if (!forward.response.ok && shouldTriggerFallback(forward.response.status)) {
      const tiers = await this.tierService.getTiers(agentId);
      const assignment = tiers.find((t) => t.tier === resolved.tier);
      const fallbackModels = assignment?.fallback_models;

      if (fallbackModels && fallbackModels.length > 0) {
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
          signatureLookup,
          thinkingLookup,
        );

        if (success) {
          this.momentum.recordTier(sessionKey, resolved.tier as Tier);
          return {
            forward: success.forward,
            meta: {
              tier: resolved.tier as Tier,
              model: success.model,
              provider: success.provider,
              confidence: resolved.confidence,
              reason: resolved.reason,
              auth_type: resolved.auth_type,
              specificity_category: resolved.specificity_category,
              fallbackFromModel: primaryModel,
              fallbackIndex: success.fallbackIndex,
              primaryErrorStatus: primaryStatus,
              primaryErrorBody: primaryErrorBody,
              primaryProvider: resolved.provider ?? undefined,
            },
            failedFallbacks: failures,
          };
        }

        // All fallbacks exhausted — preserve the primary provider's real
        // HTTP status. The gateway uses the X-Manifest-Fallback-Exhausted
        // header (set by the response handler) to detect this case.
        const safeHeaders = new Headers(forward.response.headers);
        safeHeaders.delete('content-encoding');
        safeHeaders.delete('content-length');
        safeHeaders.delete('transfer-encoding');

        const rebuilt = new Response(primaryErrorBody, {
          status: primaryStatus,
          headers: safeHeaders,
        });
        this.momentum.recordTier(sessionKey, resolved.tier as Tier);
        return {
          forward: {
            response: rebuilt,
            isGoogle: forward.isGoogle,
            isAnthropic: forward.isAnthropic,
            isChatGpt: forward.isChatGpt,
          },
          meta: {
            tier: resolved.tier as Tier,
            model: primaryModel,
            provider: resolved.provider,
            confidence: resolved.confidence,
            reason: resolved.reason,
            auth_type: resolved.auth_type,
            specificity_category: resolved.specificity_category,
          },
          failedFallbacks: failures,
        };
      }
    }

    this.momentum.recordTier(sessionKey, resolved.tier as Tier);

    return {
      forward,
      meta: {
        tier: resolved.tier as Tier,
        model: primaryModel,
        provider: resolved.provider,
        confidence: resolved.confidence,
        reason: resolved.reason,
        auth_type: resolved.auth_type,
        specificity_category: resolved.specificity_category,
      },
    };
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
}

/** Replace null content fields with empty string to avoid upstream rejections. */
function sanitizeNullContent(messages: Record<string, unknown>[]): void {
  for (const msg of messages) {
    if (msg && typeof msg === 'object' && msg.content === null) msg.content = '';
  }
}
