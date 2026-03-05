import { Injectable, Logger, BadRequestException, HttpException } from '@nestjs/common';
import { ResolveService } from '../resolve.service';
import { RoutingService } from '../routing.service';
import { CustomProviderService } from '../custom-provider.service';
import { ProviderClient, ForwardResult } from './provider-client';
import { buildCustomEndpoint, ProviderEndpoint } from './provider-endpoints';
import { SessionMomentumService } from './session-momentum.service';
import { LimitCheckService } from '../../notifications/services/limit-check.service';
import { Tier, ScorerMessage } from '../scorer/types';

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
}

export interface ProxyResult {
  forward: ForwardResult;
  meta: RoutingMeta;
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly resolveService: ResolveService,
    private readonly routingService: RoutingService,
    private readonly customProviderService: CustomProviderService,
    private readonly providerClient: ProviderClient,
    private readonly momentum: SessionMomentumService,
    private readonly limitCheck: LimitCheckService,
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

    const apiKey = await this.routingService.getProviderApiKey(agentId, resolved.provider);
    if (apiKey === null) {
      throw new BadRequestException(
        `No API key found for provider: ${resolved.provider}. Re-connect the provider with an API key.`,
      );
    }

    this.logger.log(
      `Proxy: tier=${resolved.tier} model=${resolved.model} provider=${resolved.provider} confidence=${resolved.confidence}`,
    );

    const forward = await this.forwardToProvider(
      resolved.provider,
      apiKey,
      resolved.model,
      body,
      body.stream === true,
      sessionKey,
      signal,
    );

    this.momentum.recordTier(sessionKey, resolved.tier as Tier);

    return {
      forward,
      meta: {
        tier: resolved.tier as Tier,
        model: resolved.model,
        provider: resolved.provider,
        confidence: resolved.confidence,
        reason: resolved.reason,
      },
    };
  }

  private async enforceLimits(tenantId?: string, agentName?: string): Promise<void> {
    if (!tenantId || !agentName) return;
    const exceeded = await this.limitCheck.checkLimits(tenantId, agentName);
    if (!exceeded) return;

    const fmt =
      exceeded.metricType === 'cost'
        ? `$${exceeded.actual.toFixed(2)}`
        : exceeded.actual.toLocaleString();
    const threshFmt =
      exceeded.metricType === 'cost'
        ? `$${exceeded.threshold.toFixed(2)}`
        : exceeded.threshold.toLocaleString();
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
    return scoringMessages.some((m) => {
      if (m.role !== 'user') return false;
      if (typeof m.content === 'string') return m.content.includes('HEARTBEAT_OK');
      if (Array.isArray(m.content)) {
        return m.content.some(
          (p: { type?: string; text?: string }) =>
            p.type === 'text' && typeof p.text === 'string' && p.text.includes('HEARTBEAT_OK'),
        );
      }
      return false;
    });
  }

  private async forwardToProvider(
    provider: string,
    apiKey: string,
    model: string,
    body: Record<string, unknown>,
    stream: boolean,
    sessionKey: string,
    signal?: AbortSignal,
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
    );
  }
}
