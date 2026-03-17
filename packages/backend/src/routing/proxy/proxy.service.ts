import { Injectable, Logger, BadRequestException, HttpException } from '@nestjs/common';
import { ResolveService } from '../resolve.service';
import { RoutingService } from '../routing.service';
import { CustomProviderService } from '../custom-provider.service';
import { OpenaiOauthService } from '../openai-oauth.service';
import { MinimaxOauthService } from '../minimax-oauth.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { ProviderClient, ForwardResult } from './provider-client';
import { buildCustomEndpoint, buildEndpointOverride, ProviderEndpoint } from './provider-endpoints';
import { SessionMomentumService } from './session-momentum.service';
import { LimitCheckService } from '../../notifications/services/limit-check.service';
import { shouldTriggerFallback, FALLBACK_EXHAUSTED_STATUS } from './fallback-status-codes';
import { inferProviderFromModelName } from '../provider-aliases';
import { Tier, ScorerMessage } from '../scorer/types';
import { normalizeMinimaxSubscriptionBaseUrl } from '../provider-base-url';

/**
 * Roles excluded from scoring. OpenClaw (and similar tools) inject a large,
 * keyword-rich system prompt with every request. Scoring it inflates every
 * request to the most expensive tier. We strip these before the scorer sees
 * them, but forward the full unmodified body to the real provider.
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
  fallbackFromModel?: string;
  fallbackIndex?: number;
  primaryErrorStatus?: number;
  primaryErrorBody?: string;
}

export interface FailedFallback {
  model: string;
  provider: string;
  fallbackIndex: number;
  status: number;
  errorBody: string;
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
    private readonly routingService: RoutingService,
    private readonly customProviderService: CustomProviderService,
    private readonly openaiOauth: OpenaiOauthService,
    private readonly minimaxOauth: MinimaxOauthService,
    private readonly providerClient: ProviderClient,
    private readonly momentum: SessionMomentumService,
    private readonly limitCheck: LimitCheckService,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  async proxyRequest(
    agentId: string,
    userId: string,
    body: Record<string, unknown>,
    sessionKey: string,
    tenantId?: string,
    agentName?: string,
    signal?: AbortSignal,
  ): Promise<ProxyResult> {
    const messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestException('messages array is required');
    }

    await this.enforceLimits(tenantId, agentName);

    const scoringMessages = this.filterScoringMessages(messages as ScorerMessage[]);
    const isHeartbeat = this.detectHeartbeat(scoringMessages);
    const recentTiers = this.momentum.getRecentTiers(sessionKey);

    const resolved = isHeartbeat
      ? await this.resolveService.resolveForTier(agentId, 'simple')
      : await this.resolveService.resolve(
          agentId,
          scoringMessages,
          undefined,
          undefined,
          body.max_tokens as number | undefined,
          recentTiers,
        );

    if (!resolved.model || !resolved.provider) {
      this.logger.warn(
        `No model available for agent=${agentId}: ` +
          `tier=${resolved.tier} model=${resolved.model} provider=${resolved.provider} ` +
          `confidence=${resolved.confidence} reason=${resolved.reason}`,
      );
      throw new BadRequestException(
        'No model available. Connect a provider in the Manifest dashboard.',
      );
    }

    let apiKey = await this.routingService.getProviderApiKey(
      agentId,
      resolved.provider,
      resolved.auth_type,
    );
    if (apiKey === null) {
      throw new BadRequestException(
        `No API key found for provider: ${resolved.provider}. Re-connect the provider with an API key.`,
      );
    }

    const resolvedCredentials = await this.resolveApiKey(
      resolved.provider,
      apiKey,
      resolved.auth_type,
      agentId,
      userId,
    );

    this.logger.log(
      `Proxy: tier=${resolved.tier} model=${resolved.model} provider=${resolved.provider} auth_type=${resolved.auth_type} confidence=${resolved.confidence}`,
    );

    const stream = body.stream === true;
    const forward = await this.forwardToProvider(
      resolved.provider,
      resolvedCredentials.apiKey,
      resolved.model,
      body,
      stream,
      sessionKey,
      signal,
      resolved.auth_type,
      resolvedCredentials.resourceUrl,
    );

    if (!forward.response.ok && shouldTriggerFallback(forward.response.status)) {
      const tiers = await this.routingService.getTiers(agentId);
      const assignment = tiers.find((t) => t.tier === resolved.tier);
      const fallbackModels = assignment?.fallback_models;

      if (fallbackModels && fallbackModels.length > 0) {
        const primaryErrorBody = await forward.response.text();
        const { success, failures } = await this.tryFallbacks(
          agentId,
          userId,
          fallbackModels,
          body,
          stream,
          sessionKey,
          resolved.model,
          signal,
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
              fallbackFromModel: resolved.model,
              fallbackIndex: success.fallbackIndex,
              primaryErrorStatus: forward.response.status,
              primaryErrorBody: primaryErrorBody,
            },
            failedFallbacks: failures,
          };
        }

        // All fallbacks exhausted — return non-retriable 424 so the gateway
        // does not retry the entire chain in an infinite loop.
        const safeHeaders = new Headers(forward.response.headers);
        safeHeaders.delete('content-encoding');
        safeHeaders.delete('content-length');
        safeHeaders.delete('transfer-encoding');

        const rebuilt = new Response(primaryErrorBody, {
          status: FALLBACK_EXHAUSTED_STATUS,
          statusText: 'Failed Dependency',
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
            model: resolved.model,
            provider: resolved.provider,
            confidence: resolved.confidence,
            reason: resolved.reason,
            auth_type: resolved.auth_type,
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
        model: resolved.model,
        provider: resolved.provider,
        confidence: resolved.confidence,
        reason: resolved.reason,
        auth_type: resolved.auth_type,
      },
    };
  }

  private async tryFallbacks(
    agentId: string,
    userId: string,
    fallbackModels: string[],
    body: Record<string, unknown>,
    stream: boolean,
    sessionKey: string,
    primaryModel: string,
    signal?: AbortSignal,
  ): Promise<{
    success: {
      forward: ForwardResult;
      model: string;
      provider: string;
      fallbackIndex: number;
    } | null;
    failures: FailedFallback[];
  }> {
    const failures: FailedFallback[] = [];
    for (let i = 0; i < fallbackModels.length; i++) {
      const model = fallbackModels[i];
      const pricing = this.pricingCache.getByModel(model);

      // Determine provider: custom prefix → model name inference → pricing cache → user's connected providers
      let provider: string | undefined;
      if (CustomProviderService.isCustom(model)) {
        const slashIdx = model.indexOf('/');
        provider = slashIdx > 0 ? model.substring(0, slashIdx) : model;
      } else {
        provider =
          inferProviderFromModelName(model) ??
          pricing?.provider ??
          (await this.routingService.findProviderForModel(agentId, model));
      }

      if (!provider) {
        this.logger.debug(`Fallback ${i}: skipping model=${model} (no provider data)`);
        continue;
      }
      const authType = await this.routingService.getAuthType(agentId, provider);
      let apiKey = await this.routingService.getProviderApiKey(agentId, provider, authType);
      if (apiKey === null) {
        this.logger.debug(
          `Fallback ${i}: skipping model=${model} provider=${provider} (no API key)`,
        );
        continue;
      }

      const resolvedCredentials = await this.resolveApiKey(
        provider,
        apiKey,
        authType,
        agentId,
        userId,
      );

      this.logger.log(
        `Fallback ${i}: trying model=${model} provider=${provider} auth_type=${authType} (primary=${primaryModel})`,
      );

      const forward = await this.forwardToProvider(
        provider,
        resolvedCredentials.apiKey,
        model,
        body,
        stream,
        sessionKey,
        signal,
        authType,
        resolvedCredentials.resourceUrl,
      );

      if (forward.response.ok) {
        return { success: { forward, model, provider, fallbackIndex: i }, failures };
      }

      const errorBody = await forward.response.text();
      failures.push({
        model,
        provider,
        fallbackIndex: i,
        status: forward.response.status,
        errorBody,
      });
      if (!shouldTriggerFallback(forward.response.status)) break;
    }
    return { success: null, failures };
  }

  private async resolveApiKey(
    provider: string,
    apiKey: string,
    authType: string | undefined,
    agentId: string,
    userId: string,
  ): Promise<{ apiKey: string; resourceUrl?: string }> {
    if (authType === 'subscription') {
      const lower = provider.toLowerCase();
      if (lower === 'openai') {
        const unwrapped = await this.openaiOauth.unwrapToken(apiKey, agentId, userId);
        if (unwrapped) return { apiKey: unwrapped };
      }
      if (lower === 'minimax') {
        const unwrapped = await this.minimaxOauth.unwrapToken(apiKey, agentId, userId);
        if (unwrapped) return { apiKey: unwrapped.t, resourceUrl: unwrapped.u };
      }
    }
    return { apiKey };
  }

  private async enforceLimits(tenantId?: string, agentName?: string): Promise<void> {
    if (!tenantId || !agentName) return;
    const exceeded = await this.limitCheck.checkLimits(tenantId, agentName);
    if (!exceeded) return;

    const fmt =
      exceeded.metricType === 'cost'
        ? `$${Number(exceeded.actual).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : Number(exceeded.actual).toLocaleString(undefined, { maximumFractionDigits: 0 });
    const threshFmt =
      exceeded.metricType === 'cost'
        ? `$${Number(exceeded.threshold).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : Number(exceeded.threshold).toLocaleString(undefined, { maximumFractionDigits: 0 });
    throw new HttpException(
      {
        error: {
          message: `Limit exceeded: ${exceeded.metricType} usage (${fmt}) exceeds ${threshFmt} per ${exceeded.period}`,
          type: 'rate_limit_exceeded',
          code: 'limit_exceeded',
        },
      },
      429,
    );
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

  private async forwardToProvider(
    provider: string,
    apiKey: string,
    model: string,
    body: Record<string, unknown>,
    stream: boolean,
    sessionKey: string,
    signal?: AbortSignal,
    authType?: string,
    resourceUrl?: string,
  ): Promise<ForwardResult> {
    const extraHeaders: Record<string, string> = {};
    if (provider === 'xai') {
      extraHeaders['x-grok-conv-id'] = sessionKey;
    }
    const hasExtraHeaders = Object.keys(extraHeaders).length > 0;

    let customEndpoint: ProviderEndpoint | undefined;
    let forwardModel = model;

    if (CustomProviderService.isCustom(provider)) {
      const cpId = CustomProviderService.extractId(provider);
      const cp = await this.customProviderService.getById(cpId);
      if (cp) {
        customEndpoint = buildCustomEndpoint(cp.base_url);
        forwardModel = CustomProviderService.rawModelName(model);
      }
    } else if (
      authType === 'subscription' &&
      provider.toLowerCase() === 'minimax' &&
      resourceUrl
    ) {
      const minimaxBaseUrl = normalizeMinimaxSubscriptionBaseUrl(resourceUrl);
      if (minimaxBaseUrl) {
        customEndpoint = buildEndpointOverride(minimaxBaseUrl, 'minimax-subscription');
      } else {
        this.logger.warn('Ignoring invalid MiniMax subscription resource URL');
      }
    }

    return this.providerClient.forward(
      provider,
      apiKey,
      forwardModel,
      body,
      stream,
      signal,
      hasExtraHeaders ? extraHeaders : undefined,
      customEndpoint,
      authType,
    );
  }
}
