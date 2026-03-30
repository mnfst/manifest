import { randomUUID } from 'crypto';
import { Injectable, Logger, BadRequestException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResolveService } from '../resolve/resolve.service';
import { ProviderKeyService } from '../routing-core/provider-key.service';
import { TierService } from '../routing-core/tier.service';
import { OpenaiOauthService } from '../oauth/openai-oauth.service';
import { MinimaxOauthService } from '../oauth/minimax-oauth.service';
import { ForwardResult } from './provider-client';
import { SessionMomentumService } from './session-momentum.service';
import { LimitCheckService } from '../../notifications/services/limit-check.service';
import { FALLBACK_EXHAUSTED_STATUS, shouldTriggerFallback } from './fallback-status-codes';
import { Tier, ScorerMessage } from '../../scoring/types';
import {
  ProxyFallbackService,
  FailedFallback,
  normalizeProviderModel,
  resolveApiKey,
} from './proxy-fallback.service';
import { ProxyRequestOptions } from './proxy-types';
import { ThoughtSignatureCache } from './thought-signature-cache';

export { FailedFallback } from './proxy-fallback.service';

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
  ) {}

  async proxyRequest(opts: ProxyRequestOptions): Promise<ProxyResult> {
    const { agentId, userId, body, sessionKey, tenantId, agentName, signal } = opts;
    const messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestException('messages array is required');
    }
    sanitizeNullContent(messages as Record<string, unknown>[]);

    await this.enforceLimits(tenantId, agentName);

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
      throw new BadRequestException(
        `No API key found for provider: ${resolved.provider}. Re-connect the provider with an API key.`,
      );
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
    });

    if (!forward.response.ok && shouldTriggerFallback(forward.response.status)) {
      const tiers = await this.tierService.getTiers(agentId);
      const assignment = tiers.find((t) => t.tier === resolved.tier);
      const fallbackModels = assignment?.fallback_models;

      if (fallbackModels && fallbackModels.length > 0) {
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
              fallbackFromModel: primaryModel,
              fallbackIndex: success.fallbackIndex,
              primaryErrorStatus: forward.response.status,
              primaryErrorBody: primaryErrorBody,
            },
            failedFallbacks: failures,
          };
        }

        // All fallbacks exhausted -- return non-retriable 424 so the gateway
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
            model: primaryModel,
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
        model: primaryModel,
        provider: resolved.provider,
        confidence: resolved.confidence,
        reason: resolved.reason,
        auth_type: resolved.auth_type,
      },
    };
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

  private getDashboardUrl(agentName?: string): string {
    const baseUrl =
      this.config.get<string>('app.betterAuthUrl') ||
      `http://localhost:${this.config.get<number>('app.port', 3001)}`;
    const path = agentName ? `/agents/${encodeURIComponent(agentName)}` : '/routing';
    return `${baseUrl}${path}`;
  }

  private buildNoProviderResult(stream: boolean, agentName?: string): ProxyResult {
    const id = `chatcmpl-manifest-${randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);
    const dashboardUrl = this.getDashboardUrl(agentName);
    const content = `Manifest is connected successfully. To start routing requests, connect a model provider: ${dashboardUrl}`;

    const meta: RoutingMeta = {
      tier: 'simple' as Tier,
      model: 'manifest',
      provider: 'manifest',
      confidence: 1,
      reason: 'no_provider',
    };

    if (stream) {
      const chunk = {
        id,
        object: 'chat.completion.chunk',
        created,
        model: 'manifest',
        choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: 'stop' }],
      };
      const ssePayload = `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(ssePayload));
          controller.close();
        },
      });
      return {
        forward: {
          response: new Response(body, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
          isGoogle: false,
          isAnthropic: false,
          isChatGpt: false,
        },
        meta,
      };
    }

    const responseBody = {
      id,
      object: 'chat.completion',
      created,
      model: 'manifest',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };

    return {
      forward: {
        response: new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      },
      meta,
    };
  }
}

/** Replace null content fields with empty string to avoid upstream rejections. */
function sanitizeNullContent(messages: Record<string, unknown>[]): void {
  for (const msg of messages) {
    if (msg && typeof msg === 'object' && msg.content === null) msg.content = '';
  }
}
