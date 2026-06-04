import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import type { Response as ExpressResponse } from 'express';
import type { AuthType, PlaygroundStreamEvent } from 'manifest-shared';
import { AgentMessage } from '../entities/agent-message.entity';
import { CustomProvider } from '../entities/custom-provider.entity';
import { ProviderClient } from '../routing/proxy/provider-client';
import { buildCustomEndpoint, buildEndpointOverride } from '../routing/proxy/provider-endpoints';
import { normalizeMinimaxSubscriptionBaseUrl } from '../routing/provider-base-url';
import { CustomProviderService } from '../routing/custom-provider/custom-provider.service';
import {
  isRefreshableOAuthCredential,
  refreshRejectedOAuthCredential,
  resolveApiKey,
} from '../routing/proxy/oauth-credentials';
import { ProviderKeyService } from '../routing/routing-core/provider-key.service';
import { ResolveAgentService } from '../routing/routing-core/resolve-agent.service';
import { OpenaiOauthService } from '../routing/oauth/openai-oauth.service';
import { MinimaxOauthService } from '../routing/oauth/minimax-oauth.service';
import { AnthropicOauthService } from '../routing/oauth/anthropic/anthropic-oauth.service';
import { GeminiOauthService } from '../routing/oauth/gemini-oauth.service';
import { KiroOauthService } from '../routing/oauth/kiro-oauth.service';
import { XaiOauthService } from '../routing/oauth/xai/xai-oauth.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { computeTokenCost } from '../common/utils/cost-calculator';
import { IngestEventBusService } from '../common/services/ingest-event-bus.service';
import { initSseHeaders } from '../routing/proxy/stream-writer';
import { whitelistResponseHeaders } from './playground-response-headers';
import { sanitizeRequestHeaders } from './request-header-sanitizer';
import { PlaygroundHistoryService } from './playground-history.service';
import { buildForwardBody, derivePromptForHistory } from './playground-payload';
import { consumeProviderStream } from './playground-stream';
import type { RunPlaygroundDto } from './dto/run-playground.dto';

@Injectable()
export class PlaygroundService {
  private readonly logger = new Logger(PlaygroundService.name);

  constructor(
    private readonly resolveAgent: ResolveAgentService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly providerClient: ProviderClient,
    private readonly openaiOauth: OpenaiOauthService,
    private readonly minimaxOauth: MinimaxOauthService,
    private readonly anthropicOauth: AnthropicOauthService,
    private readonly geminiOauth: GeminiOauthService,
    private readonly kiroOauth: KiroOauthService,
    private readonly xaiOauth: XaiOauthService,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly eventBus: IngestEventBusService,
    private readonly history: PlaygroundHistoryService,
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
    @InjectRepository(CustomProvider)
    private readonly customProviderRepo: Repository<CustomProvider>,
  ) {}

  /**
   * Streams one model's response over SSE. Failures *before* the stream opens
   * (bad agent/provider/key, upstream non-2xx) are returned as a plain JSON
   * HTTP error — the client hasn't committed to an event stream yet. Failures
   * *after* the stream opens are delivered as a terminal `error` event.
   */
  async runStream(userId: string, dto: RunPlaygroundDto, res: ExpressResponse): Promise<void> {
    let agent: { id: string; tenant_id: string; name: string };
    let authType: AuthType;
    let apiKey: string;
    let rawApiKey: string;
    let providerKeyLabel: string | undefined;
    let providerResource: string | undefined;
    // MiniMax OAuth tokens carry the chosen region in the blob's resource_url.
    // The proxy turns it into a base-URL override; keep that here so Playground
    // subscription requests hit the right region endpoint.
    let oauthResourceUrl: string | undefined;
    try {
      agent = await this.resolveAgent.resolve(userId, dto.agentName);
      const hasProvider = await this.providerKeyService.hasActiveProvider(agent.id, dto.provider);
      if (!hasProvider) {
        return this.sendPreStreamError(
          res,
          404,
          `Provider "${dto.provider}" is not connected for this agent`,
        );
      }
      authType =
        dto.authType ?? (await this.providerKeyService.getAuthType(agent.id, dto.provider));
      const keys = await this.providerKeyService.getProviderKeys(agent.id, dto.provider, authType);
      const key = keys[0];
      if (!key || key.apiKey === null) {
        return this.sendPreStreamError(
          res,
          404,
          `No usable API key found for provider "${dto.provider}"`,
        );
      }
      rawApiKey = key.apiKey;
      providerKeyLabel = key.label;
      const resolved = await resolveApiKey(
        dto.provider,
        rawApiKey,
        authType,
        agent.id,
        userId,
        this.openaiOauth,
        this.minimaxOauth,
        this.anthropicOauth,
        this.geminiOauth,
        this.kiroOauth,
        this.xaiOauth,
        providerKeyLabel,
      );
      if (resolved.apiKey === null) {
        return this.sendPreStreamError(
          res,
          404,
          `No usable API key found for provider "${dto.provider}"`,
        );
      }
      apiKey = resolved.apiKey;
      if (authType === 'subscription' && isRefreshableOAuthCredential(rawApiKey)) {
        rawApiKey =
          (await this.providerKeyService.getProviderApiKey(
            agent.id,
            dto.provider,
            authType,
            providerKeyLabel,
          )) ?? rawApiKey;
      }
      oauthResourceUrl = authType === 'subscription' ? resolved.resourceUrl : undefined;
      // Gemini OAuth stores the CodeAssist project id (not a URL) in the same
      // field; it is forwarded as providerResource. MiniMax's resource URL is
      // applied as a base-URL override below, not here.
      providerResource =
        authType === 'subscription' && dto.provider.toLowerCase() === 'gemini'
          ? resolved.resourceUrl
          : undefined;
    } catch (err) {
      const status = err instanceof HttpException ? err.getStatus() : 500;
      const message = err instanceof Error ? err.message : String(err);
      return this.sendPreStreamError(res, status, message);
    }

    const extraHeaders = sanitizeRequestHeaders(dto.requestHeaders);
    const abort = new AbortController();
    res.on('close', () => abort.abort());

    // Custom providers carry their endpoint (base URL + API kind) on the
    // CustomProvider row, not in the static registry — resolve it the same
    // way the proxy does, otherwise ProviderClient has no endpoint to forward
    // to and crashes on `endpoint.format`.
    let customEndpoint: ReturnType<typeof buildCustomEndpoint> | undefined;
    let forwardModel = dto.model;
    if (CustomProviderService.isCustom(dto.provider)) {
      const cp = await this.customProviderRepo.findOne({
        where: { id: CustomProviderService.extractId(dto.provider) },
      });
      if (cp) {
        customEndpoint = buildCustomEndpoint(cp.base_url, cp.api_kind ?? 'openai');
        forwardModel = CustomProviderService.rawModelName(dto.model);
      }
    } else if (
      authType === 'subscription' &&
      dto.provider.toLowerCase() === 'minimax' &&
      oauthResourceUrl
    ) {
      // Route MiniMax subscription requests through the region base URL carried
      // in the OAuth resource_url, matching the proxy. Without this the request
      // hits the default region endpoint.
      const minimaxBaseUrl = normalizeMinimaxSubscriptionBaseUrl(oauthResourceUrl);
      if (minimaxBaseUrl) {
        customEndpoint = buildEndpointOverride(minimaxBaseUrl, 'minimax-subscription');
      } else {
        this.logger.warn('Ignoring invalid MiniMax subscription resource URL');
      }
    }

    const startedAt = Date.now();
    let forward;
    try {
      const forwardOptions = {
        provider: dto.provider,
        apiKey,
        model: forwardModel,
        body: buildForwardBody(dto),
        stream: true,
        authType,
        extraHeaders,
        customEndpoint,
        signal: abort.signal,
        providerResource,
      };
      forward = await this.providerClient.forward(forwardOptions);
      if (forward.response.status === 401 && authType === 'subscription') {
        const refreshed = await refreshRejectedOAuthCredential(
          dto.provider,
          rawApiKey,
          agent.id,
          userId,
          providerKeyLabel,
          {
            openaiOauth: this.openaiOauth,
            minimaxOauth: this.minimaxOauth,
            anthropicOauth: this.anthropicOauth,
            geminiOauth: this.geminiOauth,
            kiroOauth: this.kiroOauth,
            xaiOauth: this.xaiOauth,
          },
        );
        if (refreshed?.apiKey && refreshed.apiKey !== apiKey) {
          this.logger.log(
            `OAuth token rejected upstream in Playground; refreshed provider=${dto.provider} agent=${agent.id}`,
          );
          apiKey = refreshed.apiKey;
          providerResource =
            authType === 'subscription' && dto.provider.toLowerCase() === 'gemini'
              ? (refreshed.resourceUrl ?? providerResource)
              : providerResource;
          forward = await this.providerClient.forward({
            ...forwardOptions,
            apiKey,
            providerResource,
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.sendPreStreamError(res, 502, `Provider request failed: ${message}`);
    }

    const headers = whitelistResponseHeaders(forward.response.headers);

    if (!forward.response.ok) {
      let bodyText = '';
      try {
        bodyText = await forward.response.text();
      } catch {
        // A failed error-body read must not bypass provider-error handling —
        // fall through with an empty body so we still record + respond.
      }
      const durationMs = Date.now() - startedAt;
      const errorSummary = this.truncateError(bodyText, forward.response.status);
      await this.recordError(
        userId,
        agent,
        dto,
        authType,
        forward.response.status,
        bodyText,
        durationMs,
      );
      await this.history.saveColumn(
        this.errorColumn(userId, agent, dto, authType, headers, errorSummary),
      );
      return this.sendPreStreamError(res, 502, errorSummary);
    }

    // Committed to SSE from here — every further failure is an in-band event.
    initSseHeaders(res, {});
    const send = (event: PlaygroundStreamEvent): void => {
      if (res.writableEnded) return;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    if (!forward.response.body) {
      const message = 'Provider returned an empty stream';
      await this.recordError(userId, agent, dto, authType, 502, message, Date.now() - startedAt);
      await this.history.saveColumn(
        this.errorColumn(userId, agent, dto, authType, headers, message),
      );
      send({ type: 'error', message });
      res.end();
      return;
    }

    try {
      const { content, usage, ttftMs, totalMs } = await consumeProviderStream(
        forward.response.body,
        forward,
        dto.model,
        this.providerClient,
        (text) => send({ type: 'delta', text }),
        startedAt,
      );

      const inputTokens = usage?.prompt_tokens ?? 0;
      const outputTokens = usage?.completion_tokens ?? 0;
      const cacheReadTokens = usage?.cache_read_tokens ?? 0;
      const cacheCreationTokens = usage?.cache_creation_tokens ?? 0;
      const cost = computeTokenCost({
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        model: dto.model,
        pricing: this.pricingCache.getByModel(dto.model),
        isSubscription: authType === 'subscription',
      });
      const tokensPerSec = outputTokens > 0 ? outputTokens / (Math.max(totalMs, 1) / 1000) : null;

      await this.recordSuccess(userId, agent, dto, authType, {
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        cost,
        durationMs: totalMs,
      });

      const columnId = await this.history.saveColumn({
        userId,
        agent,
        runId: dto.runId,
        prompt: derivePromptForHistory(dto),
        model: dto.model,
        provider: dto.provider,
        authType,
        displayName: null,
        position: dto.position ?? 0,
        status: 'success',
        content,
        headers,
        errorMessage: null,
        metrics: { inputTokens, outputTokens, cost, durationMs: totalMs },
      });

      send({
        type: 'done',
        columnId,
        content,
        metrics: { cost, inputTokens, outputTokens, durationMs: totalMs, ttftMs, tokensPerSec },
        headers,
      });
      res.end();
    } catch (err) {
      // Client navigated away / removed the column — the request was aborted.
      // Nothing to report and the row would just be noise.
      if (abort.signal.aborted) {
        if (!res.writableEnded) res.end();
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - startedAt;
      await this.recordError(userId, agent, dto, authType, 502, message, durationMs);
      await this.history.saveColumn(
        this.errorColumn(userId, agent, dto, authType, headers, message),
      );
      send({ type: 'error', message });
      if (!res.writableEnded) res.end();
    }
  }

  private sendPreStreamError(res: ExpressResponse, status: number, message: string): void {
    if (res.headersSent || res.writableEnded) return;
    res.status(status).json({ statusCode: status, message });
  }

  private errorColumn(
    userId: string,
    agent: { id: string; tenant_id: string; name: string },
    dto: RunPlaygroundDto,
    authType: AuthType,
    headers: Record<string, string>,
    errorMessage: string,
  ): Parameters<PlaygroundHistoryService['saveColumn']>[0] {
    return {
      userId,
      agent,
      runId: dto.runId,
      prompt: derivePromptForHistory(dto),
      model: dto.model,
      provider: dto.provider,
      authType,
      displayName: null,
      position: dto.position ?? 0,
      status: 'error',
      content: null,
      headers,
      errorMessage,
      metrics: null,
    };
  }

  private async recordSuccess(
    userId: string,
    agent: { id: string; tenant_id: string; name: string },
    dto: RunPlaygroundDto,
    authType: AuthType,
    metrics: {
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheCreationTokens: number;
      cost: number | null;
      durationMs: number;
    },
  ): Promise<void> {
    // Guarded: the model already produced (and was billed for) a completion we
    // just streamed to the user. A telemetry-insert blip must not turn that
    // into a user-visible failure.
    try {
      await this.messageRepo.insert({
        id: uuid(),
        tenant_id: agent.tenant_id,
        agent_id: agent.id,
        agent_name: agent.name,
        user_id: userId,
        timestamp: new Date().toISOString(),
        status: 'ok',
        model: dto.model,
        provider: dto.provider,
        routing_tier: 'playground',
        routing_reason: null,
        auth_type: authType,
        input_tokens: metrics.inputTokens,
        output_tokens: metrics.outputTokens,
        cache_read_tokens: metrics.cacheReadTokens,
        cache_creation_tokens: metrics.cacheCreationTokens,
        cost_usd: metrics.cost,
        duration_ms: metrics.durationMs,
      });
      this.eventBus.emit(userId);
    } catch (err) {
      this.logger.warn(
        `Failed to record playground success: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async recordError(
    userId: string,
    agent: { id: string; tenant_id: string; name: string },
    dto: RunPlaygroundDto,
    authType: AuthType,
    status: number,
    errorBody: string,
    durationMs: number,
  ): Promise<void> {
    try {
      await this.messageRepo.insert({
        id: uuid(),
        tenant_id: agent.tenant_id,
        agent_id: agent.id,
        agent_name: agent.name,
        user_id: userId,
        timestamp: new Date().toISOString(),
        status: 'error',
        error_message: errorBody.slice(0, 2000),
        error_http_status: status,
        model: dto.model,
        provider: dto.provider,
        routing_tier: 'playground',
        routing_reason: null,
        auth_type: authType,
        duration_ms: durationMs,
      });
      this.eventBus.emit(userId);
    } catch (err) {
      this.logger.warn(
        `Failed to record playground error: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private truncateError(bodyText: string, status: number): string {
    const snippet = bodyText.slice(0, 500).trim();
    return snippet ? `Provider returned ${status}: ${snippet}` : `Provider returned ${status}`;
  }
}
