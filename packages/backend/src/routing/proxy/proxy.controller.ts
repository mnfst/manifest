import {
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  Logger,
  HttpException,
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
import { ProxyService } from './proxy.service';
import { ProxyRateLimiter } from './proxy-rate-limiter';
import { ProviderClient } from './provider-client';
import { initSseHeaders, pipeStream } from './stream-writer';
import { trackCloudEvent } from '../../common/utils/product-telemetry';

const MAX_SEEN_USERS = 10_000;

@Controller('v1')
@Public()
@UseGuards(OtlpAuthGuard)
@SkipThrottle()
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);
  private readonly seenUsers = new Set<string>();
  private readonly rateLimitCooldown = new Map<string, number>();
  private readonly RATE_LIMIT_COOLDOWN_MS = 60_000;
  private readonly MAX_COOLDOWN_ENTRIES = 1_000;

  constructor(
    private readonly proxyService: ProxyService,
    private readonly rateLimiter: ProxyRateLimiter,
    private readonly providerClient: ProviderClient,
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
  ) {}

  @Post('chat/completions')
  async chatCompletions(
    @Req() req: Request & { ingestionContext: IngestionContext },
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const { userId, tenantId, agentName } = req.ingestionContext;
    const body = req.body as Record<string, unknown>;
    const sessionKey = (req.headers['x-session-key'] as string) || 'default';
    const isStream = body.stream === true;
    let headersSent = false;
    let slotAcquired = false;

    const clientAbort = new AbortController();
    res.on('close', () => clientAbort.abort());

    try {
      this.rateLimiter.checkLimit(userId);
      this.rateLimiter.acquireSlot(userId);
      slotAcquired = true;
      const { forward, meta } = await this.proxyService.proxyRequest(
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
      };

      const providerResponse = forward.response;

      if (!providerResponse.ok) {
        const errorBody = await providerResponse.text();
        res.status(providerResponse.status);
        for (const [k, v] of Object.entries(metaHeaders)) res.setHeader(k, v);
        const contentType = providerResponse.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        res.send(errorBody);
        return;
      }

      if (isStream && providerResponse.body) {
        initSseHeaders(res, metaHeaders);
        headersSent = true;

        if (forward.isGoogle) {
          await pipeStream(
            providerResponse.body,
            res,
            (chunk) => this.providerClient.convertGoogleStreamChunk(chunk, meta.model),
          );
        } else {
          await pipeStream(providerResponse.body, res);
        }
      } else {
        let responseBody: unknown;

        if (forward.isGoogle) {
          const googleData = await providerResponse.json() as Record<string, unknown>;
          responseBody = this.providerClient.convertGoogleResponse(googleData, meta.model);
        } else {
          responseBody = await providerResponse.json();
        }

        res.status(200);
        for (const [k, v] of Object.entries(metaHeaders)) res.setHeader(k, v);
        res.json(responseBody);
      }
    } catch (err: unknown) {
      if (clientAbort.signal.aborted) {
        if (!res.writableEnded) res.end();
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof HttpException ? err.getStatus() : 500;
      this.logger.error(`Proxy error: ${message}`);

      if (status === 429) {
        this.recordRateLimited(req.ingestionContext, message).catch((e) =>
          this.logger.warn(`Failed to record rate_limited message: ${e}`),
        );
      }

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

  private async recordRateLimited(ctx: IngestionContext, errorMessage: string): Promise<void> {
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

    await this.messageRepo.insert({
      id: uuid(),
      tenant_id: ctx.tenantId,
      agent_id: ctx.agentId,
      timestamp: new Date().toISOString(),
      status: 'rate_limited',
      error_message: errorMessage,
      agent_name: ctx.agentName,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
    });
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
