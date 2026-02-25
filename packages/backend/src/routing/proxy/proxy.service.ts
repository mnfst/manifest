import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ResolveService } from '../resolve.service';
import { RoutingService } from '../routing.service';
import { ProviderClient, ForwardResult } from './provider-client';
import { SessionMomentumService } from './session-momentum.service';
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
  ) {}

  async proxyRequest(
    userId: string,
    body: Record<string, unknown>,
    sessionKey: string,
  ): Promise<ProxyResult> {
    const messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestException('messages array is required');
    }

    const recentTiers = this.momentum.getRecentTiers(sessionKey);
    const stream = body.stream === true;

    // Strip system/developer messages and take only recent ones for scoring.
    // OpenClaw injects a large system prompt that inflates every score.
    // The full unmodified body is still forwarded to the real provider.
    const scoringMessages = (messages as ScorerMessage[])
      .filter((m) => !SCORING_EXCLUDED_ROLES.has(m.role))
      .slice(-SCORING_RECENT_MESSAGES);

    // Heartbeat detection: OpenClaw heartbeats include "HEARTBEAT_OK" in the
    // user prompt. These are cheap status checks — bypass the scorer entirely.
    let lastUserMsg: ScorerMessage | undefined;
    for (let i = scoringMessages.length - 1; i >= 0; i--) {
      if (scoringMessages[i].role === 'user') {
        lastUserMsg = scoringMessages[i];
        break;
      }
    }
    const isHeartbeat =
      lastUserMsg &&
      typeof lastUserMsg.content === 'string' &&
      lastUserMsg.content.includes('HEARTBEAT_OK');

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
      },
    };
  }
}
