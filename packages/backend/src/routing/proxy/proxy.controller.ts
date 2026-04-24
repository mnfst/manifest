import {
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  UseFilters,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Request, Response as ExpressResponse } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { AgentKeyAuthGuard } from '../../otlp/guards/agent-key-auth.guard';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { ProxyService } from './proxy.service';
import { ProxyRateLimiter } from './proxy-rate-limiter';
import { ProviderClient } from './provider-client';
import { ProxyMessageRecorder } from './proxy-message-recorder';
import { ThoughtSignatureCache } from './thought-signature-cache';
import { ThinkingBlockCache } from './thinking-block-cache';
import { classifyCaller } from './caller-classifier';
import { sanitizeRequestHeaders } from './request-headers';
import {
  buildMetaHeaders,
  handleProviderError,
  recordFallbackFailures,
  handleStreamResponse,
  handleNonStreamResponse,
  recordSuccess,
} from './proxy-response-handler';
import { ProxyExceptionFilter, isChatRenderingClient } from './proxy-exception.filter';
import { sendFriendlyResponse } from './proxy-friendly-response';

const MAX_SEEN_USERS = 10_000;
const SEEN_USER_TTL_MS = 24 * 60 * 60 * 1000;

@Controller('v1')
@Public()
@UseGuards(AgentKeyAuthGuard)
@UseFilters(ProxyExceptionFilter)
@SkipThrottle()
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);
  private readonly seenUsers = new Map<string, number>();

  constructor(
    private readonly proxyService: ProxyService,
    private readonly rateLimiter: ProxyRateLimiter,
    private readonly providerClient: ProviderClient,
    private readonly recorder: ProxyMessageRecorder,
    private readonly signatureCache: ThoughtSignatureCache,
    private readonly thinkingCache: ThinkingBlockCache,
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
    const callerAttribution = classifyCaller(req.headers);
    const requestHeaders = sanitizeRequestHeaders(req.headers);
    const isStream = body.stream === true;
    let headersSent = false;
    let slotAcquired = false;

    const clientAbort = new AbortController();
    res.once('close', () => clientAbort.abort());
    const startTime = Date.now();

    try {
      this.rateLimiter.checkLimit(userId);
      this.rateLimiter.checkIpLimit(req.ip ?? '');
      this.rateLimiter.acquireSlot(userId);
      slotAcquired = true;
      const specificityOverride = req.headers['x-manifest-specificity'] as string | undefined;
      const { forward, meta, failedFallbacks } = await this.proxyService.proxyRequest({
        agentId: req.ingestionContext.agentId,
        userId,
        body,
        sessionKey,
        tenantId: req.ingestionContext.tenantId,
        agentName: req.ingestionContext.agentName,
        signal: clientAbort.signal,
        specificityOverride,
        headers: req.headers,
      });

      this.trackFirstProxyRequest(userId);

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
          callerAttribution,
          requestHeaders,
        );
        return;
      }

      const fallbackSuccessTs = recordFallbackFailures(
        req.ingestionContext,
        meta,
        failedFallbacks,
        this.recorder,
        callerAttribution,
        requestHeaders,
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
          this.signatureCache,
          sessionKey,
          this.thinkingCache,
        );
      } else {
        streamUsage = await handleNonStreamResponse(
          res,
          forward,
          meta,
          metaHeaders,
          this.providerClient,
          this.signatureCache,
          sessionKey,
          this.thinkingCache,
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
        callerAttribution,
        requestHeaders,
      );
    } catch (err: unknown) {
      this.handleProxyError(
        err,
        req,
        res,
        clientAbort,
        headersSent,
        traceId,
        callerAttribution,
        requestHeaders,
      );
    } finally {
      if (slotAcquired) this.rateLimiter.releaseSlot(userId);
    }
  }

  private handleProxyError(
    err: unknown,
    req: Request & { ingestionContext: IngestionContext },
    res: ExpressResponse,
    clientAbort: AbortController,
    headersSent: boolean,
    traceId: string | undefined,
    callerAttribution: ReturnType<typeof classifyCaller>,
    requestHeaders: ReturnType<typeof sanitizeRequestHeaders>,
  ): void {
    if (clientAbort.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof HttpException ? err.getStatus() : 500;
    this.logger.error(`Proxy error: ${message}`);

    this.recorder
      .recordProviderError(req.ingestionContext, status, message, {
        traceId,
        callerAttribution,
        requestHeaders,
      })
      .catch((e) => this.logger.warn(`Failed to record provider error: ${e}`));

    if (headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }

    // Rate limit errors stay as HTTP 429 so clients can backoff
    if (status === 429) {
      const response = err instanceof HttpException ? err.getResponse() : message;
      res
        .status(429)
        .json(
          typeof response === 'string'
            ? { error: { message: response, type: 'proxy_error' } }
            : response,
        );
      return;
    }

    const isStream = (req.body as Record<string, unknown>)?.stream === true;
    if (isChatRenderingClient(req)) {
      const clientMessage =
        status >= 500
          ? '[🦚 Manifest] Something broke on our end. Try again in a moment.'
          : message;
      sendFriendlyResponse(res, clientMessage, isStream);
      return;
    }

    // Tool/monitor caller — surface the real HTTP status with a structured
    // envelope so CI pipelines can detect failures instead of treating the
    // friendly stub as success.
    const errorMessage =
      status >= 500 ? 'Manifest encountered an internal error. Try again shortly.' : message;
    res.status(status).json({
      error: {
        message: errorMessage,
        type: status >= 500 ? 'server_error' : 'invalid_request_error',
      },
    });
  }

  private extractTraceId(req: Request): string | undefined {
    const header = req.headers['traceparent'] as string | undefined;
    if (!header) return undefined;
    const parts = header.split('-');
    return parts.length >= 2 ? parts[1] : undefined;
  }

  private trackFirstProxyRequest(userId: string): void {
    const now = Date.now();
    if (this.seenUsers.has(userId)) return;
    this.evictExpiredUsers(now);
    if (this.seenUsers.size >= MAX_SEEN_USERS) {
      const oldest = this.seenUsers.keys().next().value as string;
      this.seenUsers.delete(oldest);
    }
    this.seenUsers.set(userId, now);
  }

  private evictExpiredUsers(now: number): void {
    for (const [key, timestamp] of this.seenUsers) {
      if (now - timestamp > SEEN_USER_TTL_MS) {
        this.seenUsers.delete(key);
      } else {
        break;
      }
    }
  }
}
