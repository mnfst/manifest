import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import type { BenchmarkRunResult } from 'manifest-shared';
import { AgentMessage } from '../entities/agent-message.entity';
import { ProviderClient } from '../routing/proxy/provider-client';
import { ProviderKeyService } from '../routing/routing-core/provider-key.service';
import { ResolveAgentService } from '../routing/routing-core/resolve-agent.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { computeTokenCost } from '../common/utils/cost-calculator';
import { IngestEventBusService } from '../common/services/ingest-event-bus.service';
import { whitelistResponseHeaders } from './benchmark-response-headers';
import { sanitizeRequestHeaders } from './request-header-sanitizer';
import { BenchmarkHistoryService } from './benchmark-history.service';
import type { RunBenchmarkDto, BenchmarkMessageDto } from './dto/run-benchmark.dto';

interface OpenAiChoice {
  message?: { content?: unknown };
}

interface OpenAiBody {
  choices?: OpenAiChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cache_read_tokens?: number;
    cache_creation_tokens?: number;
  };
}

interface ProviderFormatFlags {
  isGoogle: boolean;
  isAnthropic: boolean;
  isChatGpt: boolean;
}

type AuthType = 'api_key' | 'subscription';

interface ResolvedAgent {
  id: string;
  tenant_id: string;
  name: string;
}

interface ForwardOutcome {
  response: Response;
  flags: ProviderFormatFlags;
}

interface SuccessMetrics {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cost: number | null;
  durationMs: number;
}

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(
    private readonly resolveAgent: ResolveAgentService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly providerClient: ProviderClient,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly eventBus: IngestEventBusService,
    private readonly history: BenchmarkHistoryService,
    @InjectRepository(AgentMessage)
    private readonly messageRepo: Repository<AgentMessage>,
  ) {}

  async run(userId: string, dto: RunBenchmarkDto): Promise<BenchmarkRunResult> {
    const { agent, authType, apiKey } = await this.resolveCredentials(userId, dto);
    const extraHeaders = sanitizeRequestHeaders(dto.requestHeaders);
    const body = this.buildRequestBody(dto);

    const startedAt = Date.now();
    const { response, flags } = await this.forwardRequest({
      provider: dto.provider,
      apiKey,
      model: dto.model,
      body,
      authType,
      extraHeaders,
    });
    const durationMs = Date.now() - startedAt;

    const responseHeaders = whitelistResponseHeaders(response.headers);
    const bodyText = await response.text();

    if (!response.ok) {
      await this.handleErrorResponse({
        userId,
        agent,
        dto,
        authType,
        status: response.status,
        bodyText,
        responseHeaders,
        durationMs,
      });
      // handleErrorResponse always throws — unreachable.
      throw new BadGatewayException('Provider request failed');
    }

    const { content, metrics } = this.processSuccess(bodyText, dto.model, flags, {
      authType,
      model: dto.model,
      durationMs,
    });
    await this.persistSuccess({
      userId,
      agent,
      dto,
      authType,
      metrics,
      content,
      responseHeaders,
    });

    return {
      content,
      metrics: {
        cost: metrics.cost,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        durationMs: metrics.durationMs,
      },
      headers: responseHeaders,
    };
  }

  private async resolveCredentials(
    userId: string,
    dto: RunBenchmarkDto,
  ): Promise<{ agent: ResolvedAgent; authType: AuthType; apiKey: string }> {
    const agent = await this.resolveAgent.resolve(userId, dto.agentName);
    const hasProvider = await this.providerKeyService.hasActiveProvider(agent.id, dto.provider);
    if (!hasProvider) {
      throw new NotFoundException(`Provider "${dto.provider}" is not connected for this agent`);
    }
    const authType =
      dto.authType ?? (await this.providerKeyService.getAuthType(agent.id, dto.provider));
    const apiKey = await this.providerKeyService.getProviderApiKey(
      agent.id,
      dto.provider,
      authType,
    );
    if (apiKey === null) {
      throw new NotFoundException(`No usable API key found for provider "${dto.provider}"`);
    }
    return { agent, authType, apiKey };
  }

  /**
   * Pick the outgoing request body: the verbatim recorded request when
   * `rawRequestBody` is supplied (replay flow), otherwise the simple
   * `{ messages }` payload built from the DTO. Always force non-streaming
   * and drop anything that would override the target model so the column
   * actually hits the model the user picked.
   */
  private buildRequestBody(dto: RunBenchmarkDto): Record<string, unknown> {
    if (dto.rawRequestBody) {
      const cloned = { ...dto.rawRequestBody };
      delete cloned['stream'];
      delete cloned['stream_options'];
      delete cloned['model'];
      return cloned;
    }
    return { messages: dto.messages };
  }

  private async forwardRequest(args: {
    provider: string;
    apiKey: string;
    model: string;
    body: Record<string, unknown>;
    authType: AuthType;
    extraHeaders: Record<string, string> | undefined;
  }): Promise<ForwardOutcome> {
    try {
      const fwd = await this.providerClient.forward({
        provider: args.provider,
        apiKey: args.apiKey,
        model: args.model,
        body: args.body,
        stream: false,
        authType: args.authType,
        extraHeaders: args.extraHeaders,
      });
      return {
        response: fwd.response,
        flags: {
          isGoogle: fwd.isGoogle,
          isAnthropic: fwd.isAnthropic,
          isChatGpt: fwd.isChatGpt,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadGatewayException(`Provider request failed: ${message}`);
    }
  }

  private processSuccess(
    bodyText: string,
    model: string,
    flags: ProviderFormatFlags,
    ctx: { authType: AuthType; model: string; durationMs: number },
  ): { content: string; metrics: SuccessMetrics } {
    const openaiBody = this.normalizeResponseBody(bodyText, model, flags);
    const content = this.extractContent(openaiBody);
    const inputTokens = openaiBody.usage?.prompt_tokens ?? 0;
    const outputTokens = openaiBody.usage?.completion_tokens ?? 0;
    const cacheReadTokens = openaiBody.usage?.cache_read_tokens ?? 0;
    const cacheCreationTokens = openaiBody.usage?.cache_creation_tokens ?? 0;
    const cost = computeTokenCost({
      inputTokens,
      outputTokens,
      model: ctx.model,
      pricing: this.pricingCache.getByModel(ctx.model),
      isSubscription: ctx.authType === 'subscription',
    });
    return {
      content,
      metrics: {
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        cost,
        durationMs: ctx.durationMs,
      },
    };
  }

  private async persistSuccess(args: {
    userId: string;
    agent: ResolvedAgent;
    dto: RunBenchmarkDto;
    authType: AuthType;
    metrics: SuccessMetrics;
    content: string;
    responseHeaders: Record<string, string>;
  }): Promise<void> {
    await this.recordSuccess(args.userId, args.agent, args.dto, args.authType, args.metrics);
    await this.history.saveColumn({
      userId: args.userId,
      agent: args.agent,
      runId: args.dto.runId,
      prompt: this.extractPrompt(args.dto.messages),
      model: args.dto.model,
      provider: args.dto.provider,
      authType: args.authType,
      displayName: null,
      position: args.dto.position ?? 0,
      status: 'success',
      content: args.content,
      headers: args.responseHeaders,
      errorMessage: null,
      metrics: {
        inputTokens: args.metrics.inputTokens,
        outputTokens: args.metrics.outputTokens,
        cost: args.metrics.cost,
        durationMs: args.metrics.durationMs,
      },
    });
  }

  private async handleErrorResponse(args: {
    userId: string;
    agent: ResolvedAgent;
    dto: RunBenchmarkDto;
    authType: AuthType;
    status: number;
    bodyText: string;
    responseHeaders: Record<string, string>;
    durationMs: number;
  }): Promise<never> {
    await this.recordError(
      args.userId,
      args.agent,
      args.dto,
      args.authType,
      args.status,
      args.bodyText,
      args.durationMs,
    );
    const errorSummary = this.truncateError(args.bodyText, args.status);
    await this.history.saveColumn({
      userId: args.userId,
      agent: args.agent,
      runId: args.dto.runId,
      prompt: this.extractPrompt(args.dto.messages),
      model: args.dto.model,
      provider: args.dto.provider,
      authType: args.authType,
      displayName: null,
      position: args.dto.position ?? 0,
      status: 'error',
      content: null,
      headers: args.responseHeaders,
      errorMessage: errorSummary,
      metrics: null,
    });
    throw new BadGatewayException(errorSummary);
  }

  private extractPrompt(messages: BenchmarkMessageDto[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.role === 'user' && typeof m.content === 'string') return m.content;
    }
    return messages[messages.length - 1]?.content ?? '';
  }

  private normalizeResponseBody(
    bodyText: string,
    model: string,
    flags: ProviderFormatFlags,
  ): OpenAiBody {
    let parsed: Record<string, unknown>;
    try {
      parsed = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {};
    } catch {
      throw new BadGatewayException('Provider returned a non-JSON response');
    }
    if (flags.isGoogle)
      return this.providerClient.convertGoogleResponse(parsed, model) as OpenAiBody;
    if (flags.isAnthropic)
      return this.providerClient.convertAnthropicResponse(parsed, model) as OpenAiBody;
    if (flags.isChatGpt)
      return this.providerClient.convertChatGptResponse(parsed, model) as OpenAiBody;
    return parsed as OpenAiBody;
  }

  /**
   * Flatten the assistant reply's content into a single string for storage.
   * Not using the shared `coerceContentToText` here because it joins parts
   * with `\n` for the display renderer; the benchmark column expects the
   * parts concatenated as one stream (assistant text was sent contiguous).
   */
  private extractContent(body: OpenAiBody): string {
    const raw = body.choices?.[0]?.message?.content;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) {
      return raw
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
            return part.text;
          }
          return '';
        })
        .join('');
    }
    return '';
  }

  private async recordSuccess(
    userId: string,
    agent: ResolvedAgent,
    dto: RunBenchmarkDto,
    authType: AuthType,
    metrics: SuccessMetrics,
  ): Promise<void> {
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
      routing_tier: 'benchmark',
      routing_reason: null,
      auth_type: authType,
      input_tokens: metrics.inputTokens,
      output_tokens: metrics.outputTokens,
      cache_read_tokens: metrics.cacheReadTokens,
      cache_creation_tokens: metrics.cacheCreationTokens,
      cost_usd: metrics.cost,
      duration_ms: metrics.durationMs,
      // Benchmark runs are explicit side-by-side experiments, not proxy traffic.
      // They bypass the agent's record_messages toggle by design.
      recorded: false,
    });
    this.eventBus.emit(userId);
  }

  private async recordError(
    userId: string,
    agent: ResolvedAgent,
    dto: RunBenchmarkDto,
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
        routing_tier: 'benchmark',
        routing_reason: null,
        auth_type: authType,
        duration_ms: durationMs,
        recorded: false,
      });
      this.eventBus.emit(userId);
    } catch (err) {
      this.logger.warn(
        `Failed to record benchmark error: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private truncateError(bodyText: string, status: number): string {
    const snippet = bodyText.slice(0, 500).trim();
    return snippet ? `Provider returned ${status}: ${snippet}` : `Provider returned ${status}`;
  }
}
