import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UseFilters,
  Logger,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response as ExpressResponse } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { v4 as uuid } from 'uuid';
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
import { chooseAgentSessionKey, extractAgentRequestContext } from './agent-request-context';
import { ObservationReporter } from '../autofix/observation-reporter';
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
import { formatManifestError, type ManifestErrorCode } from '../../common/errors/error-codes';
import {
  MANIFEST_CODE_TO_REASON,
  ManifestError,
  isRecordableManifestCode,
} from '../../common/errors/manifest-error';
import type { ProxyApiMode } from './proxy-types';
import { ResponsesSseError } from './chatgpt-adapter';
import { redactInlineImageDataUrls } from './inline-image-redaction';
import { openAiModelId } from './openai-model-id';
import { PlanService } from '../../billing/plan.service';
import { isCodingClientApiMode, sendProxyProtocolError } from './proxy-protocol-error';
import type { MessagesStreamFailure } from './anthropic-messages-adapter';
import { countAnthropicInputTokens } from './anthropic-token-count';

const MAX_SEEN_TENANTS = 10_000;
const SEEN_TENANT_TTL_MS = 24 * 60 * 60 * 1000;
const MODEL_CREATED_UNKNOWN = 0;
const MANIFEST_STUB_STATUS: Partial<Record<ManifestErrorCode, number>> = {
  M100: 503,
  M101: 503,
  M200: 429,
  M302: 400,
};

interface OpenAiModelObject {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

interface OpenAiModelList {
  object: 'list';
  data: OpenAiModelObject[];
  /**
   * Codex uses the same endpoint but expects a top-level `models` field with
   * Codex-specific metadata. Keep this empty so Codex retains its bundled
   * model metadata while OpenAI-compatible clients use the authoritative
   * Manifest routes in `data`.
   */
  models: [];
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
    private readonly observationReporter: ObservationReporter,
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
      models: [],
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

  @Post('messages/count_tokens')
  @HttpCode(HttpStatus.OK)
  countMessageTokens(@Req() req: Request): { input_tokens: number } {
    return { input_tokens: countAnthropicInputTokens(req.body) };
  }

  private async handleProxyRequest(
    req: Request & { ingestionContext: IngestionContext },
    res: ExpressResponse,
    apiMode: ProxyApiMode,
  ): Promise<void> {
    const { tenantId } = req.ingestionContext;
    const body = req.body as Record<string, unknown>;
    const sessionKey = this.extractSessionKey(req);
    const requestContext = extractAgentRequestContext(req.headers);
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
          'plan_request_limit_exceeded',
          HttpStatus.PAYMENT_REQUIRED,
          'M204',
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
        apiMode,
      );
      return;
    }

    try {
      // Each of these throws its own ManifestError (M201 per-user, M202 per-IP,
      // M203 concurrency), so handleProxyError records which limit actually
      // fired instead of collapsing all three into one reason.
      this.rateLimiter.checkLimit(tenantId);
      this.rateLimiter.checkIpLimit(req.ip ?? '');
      this.rateLimiter.acquireSlot(tenantId);
      slotAcquired = true;
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
        requestContext,
        apiMode,
      });
      currentMeta = meta;

      this.trackFirstProxyRequest(tenantId);

      const metaHeaders = buildMetaHeaders(meta);
      const providerResponse = forward.response;

      if (meta.manifest_error_code && isCodingClientApiMode(apiMode)) {
        this.recordManifestStub(req, meta, traceId, sessionKey, callerAttribution, requestHeaders);
        for (const [name, value] of Object.entries(metaHeaders)) res.setHeader(name, value);
        sendProxyProtocolError(
          res,
          apiMode,
          MANIFEST_STUB_STATUS[meta.manifest_error_code] ?? 500,
          meta.manifest_error_message ?? formatManifestError(meta.manifest_error_code),
          { code: meta.manifest_error_code },
        );
        return;
      }

      if (!providerResponse.ok) {
        const errorBody = await providerResponse.text();
        // Evidence feed (AUTOFIX_REPORT_ALL_4XX). Auto-fix already hands Phoenix
        // the full body for the requests it heals; every other request-side 4xx
        // reaches Phoenix only via Peacock's hourly scrape, which carries the
        // model-parameter snapshot and not the messages. Report it live instead —
        // but only for agents that turned Auto-fix on (the reporter's own gate).
        //
        // `traceId` is the `traceparent` id Peacock's scrape reports for the same
        // row, so a scraped duplicate collapses onto this one in Phoenix's ledger.
        // Callers that send no `traceparent` get a fresh id, which the scrape
        // cannot match — those failures are recorded twice until the scrape is
        // retired for live traffic.
        //
        // Auto-fix reports the PRIMARY attempt itself. The fallback chain runs
        // after it, so when the response we're about to return came from a
        // fallback model it is a different provider/model failing and Phoenix has
        // never seen it — skipping on `autofix` alone would hide it.
        const alreadyReportedByAutofix = Boolean(autofix) && !meta.fallbackFromModel;
        if (!alreadyReportedByAutofix && meta.auth_type) {
          this.observationReporter.report({
            traceId: traceId ?? uuid(),
            tenantId,
            agentId: req.ingestionContext.agentId,
            provider: meta.provider,
            authType: meta.auth_type,
            apiMode,
            requestBody: routingBody,
            resolvedModel: meta.model,
            status: providerResponse.status,
            errorBody,
            responseTimeMs: Date.now() - startTime,
          });
        }
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
          {
            apiMode,
            isAnthropic: forward.isAnthropic,
            headers: providerResponse.headers,
          },
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
      let streamIntegrityFailure: MessagesStreamFailure | null = null;

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
          (failure) => {
            streamIntegrityFailure = failure;
          },
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

      // A friendly stub (no provider key, no providers, usage limit) leaves the
      // proxy as an HTTP 200 assistant message, so it lands here — but it is a
      // Manifest failure, not a completion. Record it as one.
      if (meta.manifest_error_code) {
        this.recordManifestStub(req, meta, traceId, sessionKey, callerAttribution, requestHeaders);
      } else if (streamIntegrityFailure) {
        const failure: MessagesStreamFailure = streamIntegrityFailure;
        this.logger.error(
          `Upstream stream integrity failure: provider=${meta.provider} model=${meta.model} ${failure.message}`,
        );
        this.recorder
          .recordProviderError(req.ingestionContext, failure.status, failure.message, {
            model: meta.model,
            provider: meta.provider,
            tier: meta.tier,
            traceId,
            fallbackFromModel: meta.fallbackFromModel,
            fallbackIndex: meta.fallbackIndex,
            authType: meta.auth_type,
            reason: meta.reason,
            specificityCategory: meta.specificity_category,
            providerKeyLabel: meta.provider_key_label,
            tenantProviderId: meta.tenantProviderId,
            callerAttribution,
            requestHeaders,
            requestParams: meta.request_params,
            headerTierId: meta.header_tier_id,
            headerTierName: meta.header_tier_name,
            headerTierColor: meta.header_tier_color,
            autofix,
          })
          .catch((e) => this.logger.warn(`Failed to record stream integrity error: ${e}`));
      } else {
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
      }
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
        apiMode,
        currentMeta,
      );
    } finally {
      if (slotAcquired) this.rateLimiter.releaseSlot(tenantId);
    }
  }

  /**
   * Record the HTTP-200 friendly stub Manifest returned in place of a completion.
   * `meta.manifest_error_message` is the rendered `[🦚 Manifest M100] …` text the
   * caller actually saw — persisting it verbatim (rather than a generic
   * "Provider API key missing") is what makes the row debuggable.
   */
  private recordManifestStub(
    req: Request & { ingestionContext: IngestionContext },
    meta: RoutingMeta,
    traceId: string | undefined,
    sessionKey: string | undefined,
    callerAttribution: ReturnType<typeof classifyCaller>,
    requestHeaders: ReturnType<typeof sanitizeRequestHeaders>,
  ): void {
    const code = meta.manifest_error_code;
    if (!code || !isRecordableManifestCode(code)) return;
    this.recorder
      .recordManifestBlockedRequest(req.ingestionContext, {
        errorMessage: meta.manifest_error_message ?? formatManifestError(code),
        errorCode: code,
        reason: MANIFEST_CODE_TO_REASON[code],
        model: this.extractRequestedModel(req.body as Record<string, unknown> | undefined),
        traceId,
        sessionKey,
        callerAttribution,
        requestHeaders,
      })
      .catch((e) => this.logger.warn(`Failed to record Manifest stub: ${e}`));
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
    apiMode: ProxyApiMode,
    meta?: RoutingMeta,
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

    // Who failed? A ManifestError says so explicitly. Everything a provider can
    // do reaches us as a response — even a dead socket or a timeout, which
    // proxy-transport turns into a synthetic 503/504 Response handled inline —
    // so the only *thrown* errors left are Manifest's own bugs (M500).
    //
    // An unrecordable ManifestError (M001–M003, M005) writes NOTHING: it has no
    // tenant to attribute, and falling through to recordProviderError would blame
    // the provider for someone presenting a bad key.
    if (err instanceof ManifestError) {
      if (isRecordableManifestCode(err.code)) {
        this.recordManifestBlockedRequest(
          err,
          req,
          traceId,
          callerAttribution,
          requestHeaders,
          MANIFEST_CODE_TO_REASON[err.code],
          status,
          err.code,
        );
      }
    } else if (!(err instanceof ResponsesSseError) && !(err instanceof HttpException)) {
      // A non-HTTP throw is Manifest's own bug, never a provider fault.
      this.recordManifestBlockedRequest(
        err,
        req,
        traceId,
        callerAttribution,
        requestHeaders,
        MANIFEST_CODE_TO_REASON.M500,
        status,
        'M500',
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
      if (apiMode === 'messages') {
        sendProxyProtocolError(res, apiMode, err.status, err.message);
        return;
      }
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
      if (isCodingClientApiMode(apiMode)) {
        sendProxyProtocolError(res, apiMode, status, message);
        return;
      }
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
    if (isCodingClientApiMode(apiMode)) {
      const clientMessage =
        status >= 500 ? 'Manifest encountered an internal error. Try again shortly.' : message;
      sendProxyProtocolError(res, apiMode, status, clientMessage);
      return;
    }
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
    return chooseAgentSessionKey(req.headers);
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
    errorCode?: ManifestErrorCode,
  ): void {
    const body = req.body as Record<string, unknown> | undefined;
    this.recorder
      .recordManifestBlockedRequest(req.ingestionContext, {
        httpStatus: httpStatus ?? (err instanceof HttpException ? err.getStatus() : 500),
        // The raw internal message, not the friendly M500 text the caller saw —
        // the dashboard row is where you go to find out what actually broke.
        errorMessage: this.extractErrorMessage(err),
        errorCode,
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
