import {
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  Logger,
  HttpException,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response as ExpressResponse } from 'express';
import { v4 as uuid } from 'uuid';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { OtlpAuthGuard } from '../../otlp/guards/otlp-auth.guard';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { AgentMessage } from '../../entities/agent-message.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { ProxyService, FailedFallback } from './proxy.service';
import { ProxyRateLimiter } from './proxy-rate-limiter';
import { ProviderClient } from './provider-client';
import { initSseHeaders, pipeStream, StreamUsage } from './stream-writer';
import { trackCloudEvent } from '../../common/utils/product-telemetry';

const MAX_SEEN_USERS = 10_000;

@Controller('v1')
@Public()
@UseGuards(OtlpAuthGuard)
@SkipThrottle()
export class ProxyController implements OnModuleDestroy {
  private readonly logger = new Logger(ProxyController.name);
  private readonly seenUsers = new Set<string>();
  private readonly rateLimitCooldown = new Map<string, number>();
  private readonly RATE_LIMIT_COOLDOWN_MS = 60_000;
  private readonly MAX_COOLDOWN_ENTRIES = 1_000;
  private readonly cooldownCleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    private readonly proxyService: ProxyService,
    private readonly rateLimiter: ProxyRateLimiter,
    private readonly providerClient: ProviderClient,
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    private readonly pricingCache: ModelPricingCacheService,
  ) {
    this.cooldownCleanupTimer = setInterval(() => this.evictExpiredCooldowns(), 60_000);
    if (typeof this.cooldownCleanupTimer === 'object' && 'unref' in this.cooldownCleanupTimer) {
      this.cooldownCleanupTimer.unref();
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cooldownCleanupTimer);
  }

  @Post('chat/completions')
  async chatCompletions(
    @Req() req: Request & { ingestionContext: IngestionContext },
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const { userId, agentId, tenantId, agentName } = req.ingestionContext;
    const body = req.body as Record<string, unknown>;
    const sessionKey = (req.headers['x-session-key'] as string) || 'default';
    const traceId = this.extractTraceId(req);
    const isStream = body.stream === true;
    let headersSent = false;
    let slotAcquired = false;

    const clientAbort = new AbortController();
    res.once('close', () => clientAbort.abort());

    try {
      this.rateLimiter.checkLimit(userId);
      this.rateLimiter.acquireSlot(userId);
      slotAcquired = true;
      const { forward, meta, failedFallbacks } = await this.proxyService.proxyRequest(
        agentId,
        userId,
        body,
        sessionKey,
        tenantId,
        agentName,
        clientAbort.signal,
      );

      this.trackFirstProxyRequest(userId, meta);

      const metaHeaders: Record<string, string> = {
        'X-Manifest-Tier': meta.tier,
        'X-Manifest-Model': meta.model,
        'X-Manifest-Provider': meta.provider,
        'X-Manifest-Confidence': String(meta.confidence),
        'X-Manifest-Reason': meta.reason,
      };
      if (meta.fallbackFromModel) {
        metaHeaders['X-Manifest-Fallback-From'] = meta.fallbackFromModel;
        metaHeaders['X-Manifest-Fallback-Index'] = String(meta.fallbackIndex ?? 0);
      }

      const providerResponse = forward.response;

      if (!providerResponse.ok) {
        const errorBody = await providerResponse.text();
        const errorStatus = providerResponse.status;

        if (failedFallbacks && failedFallbacks.length > 0 && !meta.fallbackFromModel) {
          // All fallbacks failed: primary is "handled" (orange), last fallback is "failed" (red).
          const baseTime = Date.now();
          this.recordFailedFallbacks(req.ingestionContext, meta.tier, meta.model, failedFallbacks, {
            traceId,
            baseTimeMs: baseTime,
            markHandled: true,
            lastAsError: true,
            authType: meta.auth_type,
          }).catch((e) => this.logger.warn(`Failed to record fallback errors: ${e}`));

          const primaryTs = new Date(baseTime + (failedFallbacks.length + 1) * 100).toISOString();
          this.recordPrimaryFailure(
            req.ingestionContext,
            meta.tier,
            meta.model,
            errorBody,
            primaryTs,
            meta.auth_type,
          ).catch((e) => this.logger.warn(`Failed to record primary failure: ${e}`));
        } else {
          this.recordProviderError(
            req.ingestionContext,
            errorStatus,
            errorBody,
            meta.model,
            meta.tier,
            traceId,
            meta.fallbackFromModel,
            meta.fallbackIndex,
            meta.auth_type,
          ).catch((e) => this.logger.warn(`Failed to record provider error: ${e}`));
        }

        res.status(errorStatus);
        for (const [k, v] of Object.entries(metaHeaders)) res.setHeader(k, v);
        const contentType = providerResponse.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        res.send(errorBody);
        return;
      }

      // Only count successful provider responses against the rate limit.
      // Failed upstream responses (retries by the gateway) are free.
      this.rateLimiter.recordSuccess(userId);

      // When a fallback was used, record the full chain with coordinated
      // timestamps so messages appear in order: primary (earliest) → intermediate
      // failures → fallback success (latest, appears first in list).
      if (meta.fallbackFromModel) {
        const baseTime = Date.now();
        const failures = failedFallbacks ?? [];

        this.recordPrimaryFailure(
          req.ingestionContext,
          meta.tier,
          meta.fallbackFromModel,
          meta.primaryErrorBody ?? `Provider returned HTTP ${meta.primaryErrorStatus ?? 500}`,
          new Date(baseTime).toISOString(),
          meta.auth_type,
        ).catch((e) => this.logger.warn(`Failed to record primary failure: ${e}`));

        if (failures.length > 0) {
          this.recordFailedFallbacks(
            req.ingestionContext,
            meta.tier,
            meta.fallbackFromModel,
            failures,
            { baseTimeMs: baseTime, markHandled: true, authType: meta.auth_type },
          ).catch((e) => this.logger.warn(`Failed to record fallback errors: ${e}`));
        }

        const successTs = new Date(baseTime + (failures.length + 1) * 100).toISOString();
        this.recordFallbackSuccess(
          req.ingestionContext,
          meta.model,
          meta.tier,
          traceId,
          meta.fallbackFromModel,
          meta.fallbackIndex ?? 0,
          successTs,
          meta.auth_type,
        ).catch((e) => this.logger.warn(`Failed to record fallback success: ${e}`));
      }

      let streamUsage: StreamUsage | null = null;

      if (isStream && providerResponse.body) {
        initSseHeaders(res, metaHeaders);
        headersSent = true;

        if (forward.isGoogle) {
          streamUsage = await pipeStream(providerResponse.body, res, (chunk) =>
            this.providerClient.convertGoogleStreamChunk(chunk, meta.model),
          );
        } else if (forward.isAnthropic) {
          streamUsage = await pipeStream(
            providerResponse.body,
            res,
            this.providerClient.createAnthropicStreamTransformer(meta.model),
          );
        } else if (forward.isChatGpt) {
          streamUsage = await pipeStream(providerResponse.body, res, (chunk) =>
            this.providerClient.convertChatGptStreamChunk(chunk, meta.model),
          );
        } else {
          streamUsage = await pipeStream(providerResponse.body, res);
        }
      } else {
        let responseBody: unknown;

        if (forward.isGoogle) {
          const googleData = (await providerResponse.json()) as Record<string, unknown>;
          responseBody = this.providerClient.convertGoogleResponse(googleData, meta.model);
        } else if (forward.isAnthropic) {
          const anthropicData = (await providerResponse.json()) as Record<string, unknown>;
          responseBody = this.providerClient.convertAnthropicResponse(anthropicData, meta.model);
        } else if (forward.isChatGpt) {
          const chatgptData = (await providerResponse.json()) as Record<string, unknown>;
          responseBody = this.providerClient.convertChatGptResponse(chatgptData, meta.model);
        } else {
          responseBody = await providerResponse.json();
        }

        // Extract usage from the OpenAI-format response body
        const body = responseBody as Record<string, unknown> | undefined;
        const usage = body?.usage as Record<string, number> | undefined;
        if (usage && typeof usage.prompt_tokens === 'number') {
          streamUsage = {
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens ?? 0,
            cache_read_tokens: usage.cache_read_tokens,
            cache_creation_tokens: usage.cache_creation_tokens,
          };
        }

        res.status(200);
        for (const [k, v] of Object.entries(metaHeaders)) res.setHeader(k, v);
        res.json(responseBody);
      }

      // Record successful message with real token data (non-fallback only).
      // For fallback successes, recordFallbackSuccess already creates the record.
      if (!meta.fallbackFromModel && streamUsage) {
        this.recordSuccessMessage(
          req.ingestionContext,
          meta.model,
          meta.tier,
          meta.reason,
          streamUsage,
          traceId,
          meta.auth_type,
        ).catch((e) => this.logger.warn(`Failed to record success message: ${e}`));
      }
    } catch (err: unknown) {
      if (clientAbort.signal.aborted) {
        if (!res.writableEnded) res.end();
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof HttpException ? err.getStatus() : 500;
      this.logger.error(`Proxy error: ${message}`);

      this.recordProviderError(
        req.ingestionContext,
        status,
        message,
        undefined,
        undefined,
        traceId,
      ).catch((e) => this.logger.warn(`Failed to record provider error: ${e}`));

      if (headersSent) {
        if (!res.writableEnded) res.end();
        return;
      }

      const clientMessage = status >= 500 ? 'Internal proxy error' : message;
      res.status(status).json({
        error: { message: clientMessage, type: 'proxy_error' },
      });
    } finally {
      if (slotAcquired) this.rateLimiter.releaseSlot(userId);
    }
  }

  private async recordProviderError(
    ctx: IngestionContext,
    httpStatus: number,
    errorMessage: string,
    model?: string,
    tier?: string,
    traceId?: string,
    fallbackFromModel?: string,
    fallbackIndex?: number,
    authType?: string,
  ): Promise<void> {
    if (httpStatus === 429) {
      const key = `${ctx.tenantId}:${ctx.agentId}`;
      const now = Date.now();
      const lastRecorded = this.rateLimitCooldown.get(key) ?? 0;
      if (now - lastRecorded < this.RATE_LIMIT_COOLDOWN_MS) return;
      this.rateLimitCooldown.set(key, now);

      if (this.rateLimitCooldown.size > this.MAX_COOLDOWN_ENTRIES) {
        for (const [k, v] of this.rateLimitCooldown) {
          if (now - v >= this.RATE_LIMIT_COOLDOWN_MS) this.rateLimitCooldown.delete(k);
        }
      }
    }

    const messageStatus = httpStatus === 429 ? 'rate_limited' : 'error';

    await this.messageRepo.insert({
      id: uuid(),
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      trace_id: traceId ?? null,
      timestamp: new Date().toISOString(),
      status: messageStatus,
      error_message: errorMessage.slice(0, 500),
      agent_name: ctx.agentName,
      model: model ?? null,
      routing_tier: tier ?? null,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      fallback_from_model: fallbackFromModel ?? null,
      fallback_index: fallbackIndex ?? null,
      auth_type: authType ?? null,
    });
  }

  private async recordFailedFallbacks(
    ctx: IngestionContext,
    tier: string,
    primaryModel: string,
    failures: FailedFallback[],
    opts?: {
      traceId?: string;
      baseTimeMs?: number;
      markHandled?: boolean;
      lastAsError?: boolean;
      authType?: string;
    },
  ): Promise<void> {
    const { traceId, baseTimeMs, markHandled = false, lastAsError = false, authType } = opts ?? {};
    for (let i = 0; i < failures.length; i++) {
      const f = failures[i];
      const ts = baseTimeMs
        ? new Date(baseTimeMs + (failures.length - i) * 100).toISOString()
        : new Date().toISOString();
      const isLast = i === failures.length - 1;
      const useHandledStatus = markHandled && !(lastAsError && isLast);
      const status = useHandledStatus
        ? 'fallback_error'
        : f.status === 429
          ? 'rate_limited'
          : 'error';
      await this.messageRepo.insert({
        id: uuid(),
        tenant_id: ctx.tenantId,
        agent_id: ctx.agentId,
        trace_id: traceId ?? null,
        timestamp: ts,
        status,
        error_message: f.errorBody.slice(0, 500),
        agent_name: ctx.agentName,
        model: f.model,
        routing_tier: tier,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        fallback_from_model: primaryModel,
        fallback_index: f.fallbackIndex,
        auth_type: authType ?? null,
      });
    }
  }

  private async recordPrimaryFailure(
    ctx: IngestionContext,
    tier: string,
    model: string,
    errorBody: string,
    timestamp: string,
    authType?: string,
  ): Promise<void> {
    await this.messageRepo.insert({
      id: uuid(),
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      trace_id: null,
      timestamp,
      status: 'fallback_error',
      error_message: errorBody.slice(0, 500),
      agent_name: ctx.agentName,
      model,
      routing_tier: tier,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      fallback_from_model: null,
      fallback_index: null,
      auth_type: authType ?? null,
    });
  }

  private async recordFallbackSuccess(
    ctx: IngestionContext,
    model: string,
    tier: string,
    traceId?: string,
    fallbackFromModel?: string,
    fallbackIndex?: number,
    timestamp?: string,
    authType?: string,
  ): Promise<void> {
    let costUsd: number | null = null;
    if (authType === 'subscription') {
      costUsd = 0;
    }

    await this.messageRepo.insert({
      id: uuid(),
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      trace_id: traceId ?? null,
      timestamp: timestamp ?? new Date().toISOString(),
      status: 'ok',
      agent_name: ctx.agentName,
      model,
      routing_tier: tier,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      cost_usd: costUsd,
      auth_type: authType ?? null,
      fallback_from_model: fallbackFromModel ?? null,
      fallback_index: fallbackIndex ?? null,
    });
  }

  private async recordSuccessMessage(
    ctx: IngestionContext,
    model: string,
    tier: string,
    reason: string,
    usage: StreamUsage,
    traceId?: string,
    authType?: string,
  ): Promise<void> {
    if (usage.prompt_tokens === 0 && usage.completion_tokens === 0) return;

    let costUsd: number | null = null;
    if (authType === 'subscription') {
      costUsd = 0;
    } else {
      const pricing = this.pricingCache.getByModel(model);
      if (pricing?.input_price_per_token != null && pricing?.output_price_per_token != null) {
        costUsd =
          usage.prompt_tokens * Number(pricing.input_price_per_token) +
          usage.completion_tokens * Number(pricing.output_price_per_token);
      }
    }

    await this.messageRepo.insert({
      id: uuid(),
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      trace_id: traceId ?? null,
      timestamp: new Date().toISOString(),
      status: 'ok',
      agent_name: ctx.agentName,
      model,
      routing_tier: tier,
      routing_reason: reason,
      input_tokens: usage.prompt_tokens,
      output_tokens: usage.completion_tokens,
      cache_read_tokens: usage.cache_read_tokens ?? 0,
      cache_creation_tokens: usage.cache_creation_tokens ?? 0,
      cost_usd: costUsd,
      auth_type: authType ?? null,
      fallback_from_model: null,
      fallback_index: null,
    });
  }

  private extractTraceId(req: Request): string | undefined {
    const header = req.headers['traceparent'] as string | undefined;
    if (!header) return undefined;
    const parts = header.split('-');
    return parts.length >= 2 ? parts[1] : undefined;
  }

  private evictExpiredCooldowns(): void {
    const now = Date.now();
    for (const [k, v] of this.rateLimitCooldown) {
      if (now - v >= this.RATE_LIMIT_COOLDOWN_MS) this.rateLimitCooldown.delete(k);
    }
  }

  private trackFirstProxyRequest(
    userId: string,
    meta: { provider: string; model: string; tier: string },
  ): void {
    if (this.seenUsers.has(userId)) return;
    if (this.seenUsers.size >= MAX_SEEN_USERS) {
      const oldest = this.seenUsers.values().next().value as string;
      this.seenUsers.delete(oldest);
    }
    this.seenUsers.add(userId);
    trackCloudEvent('routing_first_proxy_request', userId, {
      provider: meta.provider,
      model: meta.model,
      tier: meta.tier,
    });
  }
}
