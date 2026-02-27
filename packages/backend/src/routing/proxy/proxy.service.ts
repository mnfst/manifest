import { Injectable, Logger, BadRequestException, HttpException } from '@nestjs/common';
import { ResolveService } from '../resolve.service';
import { RoutingService } from '../routing.service';
import { ProviderClient, ForwardResult } from './provider-client';
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
    private readonly providerClient: ProviderClient,
    private readonly momentum: SessionMomentumService,
    private readonly limitCheck: LimitCheckService,
  ) {}

  async proxyRequest(
    userId: string,
    body: Record<string, unknown>,
    sessionKey: string,
    tenantId?: string,
    agentName?: string,
  ): Promise<ProxyResult> {
    const messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestException('messages array is required');
    }

    if (tenantId && agentName) {
      const exceeded = await this.limitCheck.checkLimits(tenantId, agentName);
      if (exceeded) {
        const fmt = exceeded.metricType === 'cost'
          ? `$${exceeded.actual.toFixed(2)}`
          : exceeded.actual.toLocaleString();
        const threshFmt = exceeded.metricType === 'cost'
          ? `$${exceeded.threshold.toFixed(2)}`
          : exceeded.threshold.toLocaleString();
        throw new HttpException({
          error: {
            message: `Limit exceeded: ${exceeded.metricType} usage (${fmt}) exceeds ${threshFmt} per ${exceeded.period}`,
            type: 'rate_limit_exceeded',
            code: 'limit_exceeded',
          },
        }, 429);
      }
    }

    const recentTiers = this.momentum.getRecentTiers(sessionKey);
    const stream = body.stream === true;

    // Strip system/developer messages and take only recent ones for scoring.
    // OpenClaw injects a large system prompt that inflates every score.
    // The full unmodified body is still forwarded to the real provider.
    const scoringMessages = (messages as ScorerMessage[])
      .filter((m) => !SCORING_EXCLUDED_ROLES.has(m.role))
      .slice(-SCORING_RECENT_MESSAGES);

    // Heartbeat detection: OpenClaw heartbeats include "HEARTBEAT_OK" in a
    // user message. The sentinel may appear in an earlier message (not just the
    // last one) because the agent appends its own messages after. Check ALL
    // user messages so the detection works regardless of position.
    // Content can be a string or array of content parts (multi-modal format).
    const isHeartbeat = scoringMessages.some((m) => {
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

    // Resolve model via scorer (using filtered messages, no tools —
    // tool presence always inflates scores since gateways send tools
    // with every request regardless of user intent)
    const resolved = isHeartbeat
      ? await this.resolveService.resolveForTier(userId, 'simple')
      : await this.resolveService.resolve(
          userId,
          scoringMessages,
          undefined,
          undefined,
          body.max_tokens as number | undefined,
          recentTiers,
        );

    if (!resolved.model || !resolved.provider) {
      throw new BadRequestException(
        'No model available. Connect a provider in the Manifest dashboard.',
      );
    }

    // Get the provider's API key
    const apiKey = await this.routingService.getProviderApiKey(
      userId,
      resolved.provider,
    );
    if (apiKey === null) {
      throw new BadRequestException(
        `No API key found for provider: ${resolved.provider}. Re-connect the provider with an API key.`,
      );
    }

    this.logger.log(
      `Proxy: tier=${resolved.tier} model=${resolved.model} provider=${resolved.provider} confidence=${resolved.confidence}`,
    );

    // Forward to real provider
    const forward = await this.providerClient.forward(
      resolved.provider,
      apiKey,
      resolved.model,
      body,
      stream,
    );

    // Record momentum
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
}
