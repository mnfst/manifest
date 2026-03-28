import { Controller, Post, Req, Res, UseGuards, Logger, HttpException } from '@nestjs/common';
import { Request, Response as ExpressResponse } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { AgentKeyAuthGuard } from '../../otlp/guards/agent-key-auth.guard';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { ProxyService } from './proxy.service';
import { ProxyRateLimiter } from './proxy-rate-limiter';
import { ProviderClient } from './provider-client';
import { ProxyMessageRecorder } from './proxy-message-recorder';
import {
  buildMetaHeaders,
  handleProviderError,
  recordFallbackFailures,
  handleStreamResponse,
  handleNonStreamResponse,
  recordSuccess,
} from './proxy-response-handler';

const MAX_SEEN_USERS = 10_000;

@Controller('v1')
@Public()
@UseGuards(AgentKeyAuthGuard)
@SkipThrottle()
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);
  private readonly seenUsers = new Set<string>();

  constructor(
    private readonly proxyService: ProxyService,
    private readonly rateLimiter: ProxyRateLimiter,
    private readonly providerClient: ProviderClient,
    private readonly recorder: ProxyMessageRecorder,
  ) {}

  @Post('chat/completions')
  async chatCompletions(
    @Req() req: Request & { ingestionContext: IngestionContext },
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const { userId } = req.ingestionContext;
    const body = req.body as Record<string, unknown>;
    const sessionKey = (req.headers['x-session-key'] as string) || 'default';
    const traceId = this.extractTraceId(req);
    const isStream = body.stream === true;
    let headersSent = false;
    let slotAcquired = false;

    const clientAbort = new AbortController();
    res.once('close', () => clientAbort.abort());
    const startTime = Date.now();

    try {
      this.rateLimiter.checkLimit(userId);
      this.rateLimiter.acquireSlot(userId);
      slotAcquired = true;
      const { forward, meta, failedFallbacks } = await this.proxyService.proxyRequest({
        agentId: req.ingestionContext.agentId,
        userId,
        body,
        sessionKey,
        tenantId: req.ingestionContext.tenantId,
        agentName: req.ingestionContext.agentName,
        signal: clientAbort.signal,
      });

      this.trackFirstProxyRequest(userId, meta);

      const metaHeaders = buildMetaHeaders(meta);
      const providerResponse = forward.response;

      if (!providerResponse.ok) {
        const errorBody = await providerResponse.text();
        await handleProviderError(
          res,
          req.ingestionContext,
          meta,
          metaHeaders,
          providerResponse.status,
          errorBody,
          failedFallbacks,
          this.recorder,
          traceId,
        );
        return;
      }

      const fallbackSuccessTs = recordFallbackFailures(
        req.ingestionContext,
        meta,
        failedFallbacks,
        this.recorder,
      );

      let streamUsage = null;

      if (isStream && providerResponse.body) {
        headersSent = true;
        streamUsage = await handleStreamResponse(
          res,
          forward,
          meta,
          metaHeaders,
          this.providerClient,
        );
      } else {
        streamUsage = await handleNonStreamResponse(
          res,
          forward,
          meta,
          metaHeaders,
          this.providerClient,
        );
      }

      recordSuccess(
        req.ingestionContext,
        meta,
        streamUsage,
        fallbackSuccessTs,
        this.recorder,
        traceId,
        sessionKey,
        startTime,
      );
    } catch (err: unknown) {
      if (clientAbort.signal.aborted) {
        if (!res.writableEnded) res.end();
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof HttpException ? err.getStatus() : 500;
      this.logger.error(`Proxy error: ${message}`);

      this.recorder
        .recordProviderError(req.ingestionContext, status, message, undefined, undefined, traceId)
        .catch((e) => this.logger.warn(`Failed to record provider error: ${e}`));

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

  private extractTraceId(req: Request): string | undefined {
    const header = req.headers['traceparent'] as string | undefined;
    if (!header) return undefined;
    const parts = header.split('-');
    return parts.length >= 2 ? parts[1] : undefined;
  }

  private trackFirstProxyRequest(
    userId: string,
    _meta: { provider: string; model: string; tier: string },
  ): void {
    if (this.seenUsers.has(userId)) return;
    if (this.seenUsers.size >= MAX_SEEN_USERS) {
      const oldest = this.seenUsers.values().next().value as string;
      this.seenUsers.delete(oldest);
    }
    this.seenUsers.add(userId);
  }
}
