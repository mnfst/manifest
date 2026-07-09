import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UseFilters,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response as ExpressResponse } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { AgentKeyAuthGuard } from '../../otlp/guards/agent-key-auth.guard';
import { IngestionContext } from '../../otlp/interfaces/ingestion-context.interface';
import { ProxyService, type RoutingMeta } from './proxy.service';
import { ProxyRateLimiter } from './proxy-rate-limiter';
import { ProviderClient } from './provider-client';
import { ProxyMessageRecorder, type ManifestBlockedRequestReason } from './proxy-message-recorder';
import { ThoughtSignatureCache } from './thought-signature-cache';
import { ThinkingBlockCache } from './thinking-block-cache';
import { ReasoningContentCache } from './reasoning-content-cache';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { classifyCaller } from './caller-classifier';
import { sanitizeRequestHeaders } from './request-headers';
import {
  buildMetaHeaders,
  buildOpenAiCompatibleError,
  handleProviderError,
  recordFallbackFailures,
  handleStreamResponse,
  handleNonStreamResponse,
  recordSuccess,
} from './proxy-response-handler';
import { ProxyExceptionFilter, isChatRenderingClient } from './proxy-exception.filter';
import { sendFriendlyResponse } from './proxy-friendly-response';
import { formatManifestError } from '../../common/errors/error-codes';
import type { ProxyApiMode } from './proxy-types';
import { ResponsesSseError } from './chatgpt-adapter';
import { redactInlineImageDataUrls } from './inline-image-redaction';
import { openAiModelId } from './openai-model-id';
import { PlanService } from '../../billing/plan.service';

const MAX_SEEN_TENANTS = 10_000;
const SEEN_TENANT_TTL_MS = 24 * 60 * 60 * 1000;
const MODEL_CREATED_UNKNOWN = 0;

interface OpenAiModelObject {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

interface OpenAiModelList {
  object: 'list';
  data: OpenAiModelObject[];
}

@Controller('v1')
@Public()
@UseGuards(AgentKeyAuthGuard)
@UseFilters(ProxyExceptionFilter)
@SkipThrottle()
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);
  private readonly seenTenants = new Map<string, number>();

  constructor(
    private readonly proxyService: ProxyService,
    private readonly rateLimiter: ProxyRateLimiter,
    private readonly providerClient: ProviderClient,
    private readonly recorder: ProxyMessageRecorder,
    private readonly signatureCache: ThoughtSignatureCache,
    private readonly thinkingCache: ThinkingBlockCache,
    private readonly reasoningCache: ReasoningContentCache,
    private readonly modelDiscovery: ModelDiscoveryService,
    private readonly planService: PlanService,
  ) {}

  @Get('models')
  async models(
    @Req() req: Request & { ingestionContext: IngestionContext },
  ): Promise<OpenAiModelList> {
    const models = await this.modelDiscovery.getModelsForAgent(
      req.ingestionContext.tenantId,
      req.ingestionContext.agentId,
    );
    const data: OpenAiModelObject[] = [
      {
        id: 'auto',
        object: 'model',
        created: MODEL_CREATED_UNKNOWN,
        owned_by: 'manifest',
      },
    ];
    const seen = new Set(data.map((model) => model.id));

    for (const model of models) {
      const id = openAiModelId(model);
      if (seen.has(id)) continue;
      seen.add(id);
      data.push({
        id,
        object: 'model',
        created: MODEL_CREATED_UNKNOWN,
        owned_by: model.provider,
      });
    }

    return {
      object: 'list',
      data,
    };
  }

  @Post('chat/completions')
  async chatCompletions(
    @Req() req: Request & { ingestionContext: IngestionContext },
    @Res() res: ExpressResponse,
  ): Promise<void> {
    await this.handleProxyRequest(req, res, 'chat_completions');
  }

  @Post('responses')
  async responses(
    @Req() req: Request & { ingestionContext: IngestionContext },
    @Res() res: ExpressResponse,
  ): Promise<void> {
    await this.handleProxyRequest(req, res, 'responses');
  }

  @Post('messages')
  async messages(
    @Req() req: Request & { ingestionContext: IngestionContext },
    @Res() res: ExpressResponse,
  ): Promise<void> {
    await this.handleProxyRequest(req, res, 'messages');
  }

  private async handleProxyRequest(
    req: Request & { ingestionContext: IngestionContext },
    res: ExpressResponse,
    apiMode: ProxyApiMode,
  ): Promise<void> {
    const { tenantId } = req.ingestionContext;
    const body = req.body as Record<string, unknown>;
    const sessionKey = this.extractSessionKey(req);
    const traceId = this.extractTraceId(req);
    const callerAttribution = classifyCaller(req.headers);
    const requestHeaders = sanitizeRequestHeaders(req.headers);
    const isStream = body.stream === true;
    let routingBody = body;
    let headersSent = false;
    let slotAcquired = false;
    let currentMeta: RoutingMeta | undefined;

    const clientAbort = new AbortController();
    res.once('close', () => clientAbort.abort());
    const startTime = Date.now();

    // Plan request-limit gate. A 402 must reach ProxyExceptionFilter (friendly
    // upgrade message / real 402), but still gets a Manifest-policy row in
    // agent_messages so the Messages tab explains why the request never routed.
    // Billing counters exclude Manifest-origin rows, so this does not consume
    // quota or push the tenant further over the limit.
    try {
      await this.planService.assertWithinRequestLimit(req.ingestionContext);
    } catch (err: unknown) {
      if (err instanceof HttpException && err.getStatus() === HttpStatus.PAYMENT_REQUIRED) {
        this.recordManifestBlockedRequest(
          err,
          req,
          traceId,
          callerAttribution,
          requestHeaders,
          'limit_exceeded',
        );
        throw err;
      }
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
      return;
    }

    let manifestBlockReason: ManifestBlockedRequestReason | undefined = 'manifest_rate_limited';
    try {
      this.rateLimiter.checkLimit(tenantId);
      this.rateLimiter.checkIpLimit(req.ip ?? '');
      this.rateLimiter.acquireSlot(tenantId);
      slotAcquired = true;
      manifestBlockReason = undefined;
      routingBody = redactInlineImageDataUrls(body);
      const specificityOverride = req.headers['x-manifest-specificity'] as string | undefined;
      const { forward, meta, failedFallbacks, autofix } = await this.proxyService.proxyRequest({
        agentId: req.ingestionContext.agentId,
        tenantId,
        // Attribution only — the recorder writes it to agent_messages.user_id.
        userId: req.ingestionContext.userId,
        body,
        routingBody,
        sessionKey,
        agentName: req.ingestionContext.agentName,
        signal: clientAbort.signal,
        specificityOverride,
        headers: req.headers,
        apiMode,
      });
      currentMeta = meta;

      this.trackFirstProxyRequest(tenantId);

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
          autofix,
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
        autofix,
      );

      let streamUsage = null;

      const shouldStreamResponse = isStream || meta.response_mode === 'stream';

      if (shouldStreamResponse && providerResponse.body) {
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
          apiMode,
          this.reasoningCache,
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
          apiMode,
          this.reasoningCache,
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
        autofix,
      );
    } catch (err: unknown) {
      const recordAsManifestBlock =
        manifestBlockReason &&
        err instanceof HttpException &&
        err.getStatus() === HttpStatus.TOO_MANY_REQUESTS
          ? manifestBlockReason
          : undefined;
      this.handleProxyError(
        err,
        req,
        res,
        clientAbort,
        headersSent,
        traceId,
        callerAttribution,
        requestHeaders,
        currentMeta,
        recordAsManifestBlock,
      );
    } finally {
      if (slotAcquired) this.rateLimiter.releaseSlot(tenantId);
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
    meta?: RoutingMeta,
    manifestBlockReason?: ManifestBlockedRequestReason,
  ): void {
    if (clientAbort.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }

    const message = this.extractErrorMessage(err);
    const status =
      err instanceof ResponsesSseError
        ? err.status
        : err instanceof HttpException
          ? err.getStatus()
          : 500;
    const providerErrorBody = err instanceof ResponsesSseError ? err.body : message;
    this.logger.error(`Proxy error: ${message}`);

    if (manifestBlockReason) {
      this.recordManifestBlockedRequest(
        err,
        req,
        traceId,
        callerAttribution,
        requestHeaders,
        manifestBlockReason,
        status,
      );
    } else {
      this.recorder
        .recordProviderError(req.ingestionContext, status, providerErrorBody, {
          ...(meta
            ? {
                model: meta.model,
                provider: meta.provider,
                tier: meta.tier,
                fallbackFromModel: meta.fallbackFromModel,
                fallbackIndex: meta.fallbackIndex,
                authType: meta.auth_type,
                reason: meta.reason,
                specificityCategory: meta.specificity_category,
                providerKeyLabel: meta.provider_key_label,
                tenantProviderId: meta.tenantProviderId,
                requestParams: meta.request_params,
                headerTierId: meta.header_tier_id,
                headerTierName: meta.header_tier_name,
                headerTierColor: meta.header_tier_color,
              }
            : {}),
          traceId,
          callerAttribution,
          requestHeaders,
        })
        .catch((e) => this.logger.warn(`Failed to record provider error: ${e}`));
    }

    if (headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }

    if (err instanceof ResponsesSseError) {
      res.status(err.status).json({
        error: buildOpenAiCompatibleError(
          err.status,
          err.body,
          meta ? { provider: meta.provider, model: meta.model } : {},
        ),
      });
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
      const clientMessage = status >= 500 ? formatManifestError('M500') : message;
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

  private extractSessionKey(req: Request): string {
    return (req.headers['x-session-key'] as string) || 'default';
  }

  private extractRequestedModel(body: Record<string, unknown> | undefined): string | undefined {
    const model = body?.model;
    return typeof model === 'string' && model.length > 0 ? model : undefined;
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof ResponsesSseError) return err.body;
    if (err instanceof HttpException) {
      const response = err.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object') {
        const record = response as Record<string, unknown>;
        const message = record.message;
        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return message.filter((m) => typeof m === 'string').join(', ');
        const error = record.error;
        if (typeof error === 'string') return error;
        if (error && typeof error === 'object') {
          const nested = (error as Record<string, unknown>).message;
          if (typeof nested === 'string') return nested;
        }
        const code = record.code;
        if (code === 'PLAN_LIMIT_REQUESTS') return 'Free plan monthly request limit reached';
        if (typeof code === 'string') return code;
      }
    }
    return err instanceof Error ? err.message : String(err);
  }

  private recordManifestBlockedRequest(
    err: unknown,
    req: Request & { ingestionContext: IngestionContext },
    traceId: string | undefined,
    callerAttribution: ReturnType<typeof classifyCaller>,
    requestHeaders: ReturnType<typeof sanitizeRequestHeaders>,
    reason: ManifestBlockedRequestReason,
    httpStatus?: number,
  ): void {
    const body = req.body as Record<string, unknown> | undefined;
    this.recorder
      .recordManifestBlockedRequest(req.ingestionContext, {
        httpStatus: httpStatus ?? (err instanceof HttpException ? err.getStatus() : 500),
        errorMessage: this.extractErrorMessage(err),
        reason,
        model: this.extractRequestedModel(body),
        traceId,
        sessionKey: this.extractSessionKey(req),
        callerAttribution,
        requestHeaders,
      })
      .catch((e) => this.logger.warn(`Failed to record Manifest-blocked request: ${e}`));
  }

  private trackFirstProxyRequest(tenantId: string): void {
    const now = Date.now();
    if (this.seenTenants.has(tenantId)) return;
    this.evictExpiredTenants(now);
    if (this.seenTenants.size >= MAX_SEEN_TENANTS) {
      const oldest = this.seenTenants.keys().next().value as string;
      this.seenTenants.delete(oldest);
    }
    this.seenTenants.set(tenantId, now);
  }

  private evictExpiredTenants(now: number): void {
    for (const [key, timestamp] of this.seenTenants) {
      if (now - timestamp > SEEN_TENANT_TTL_MS) {
        this.seenTenants.delete(key);
      } else {
        break;
      }
    }
  }
}
