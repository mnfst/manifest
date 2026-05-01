import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import type { AuthType, BenchmarkRunResult } from 'manifest-shared';
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

  private extractPrompt(messages: BenchmarkMessageDto[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.role === 'user' && typeof m.content === 'string') return m.content;
    }
    return messages[messages.length - 1]?.content ?? '';
  }

  async run(userId: string, dto: RunBenchmarkDto): Promise<BenchmarkRunResult> {
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

    const extraHeaders = sanitizeRequestHeaders(dto.requestHeaders);

    const startedAt = Date.now();
    let rawResponse: Response;
    let formatFlags: { isGoogle: boolean; isAnthropic: boolean; isChatGpt: boolean };
    try {
      const fwd = await this.providerClient.forward({
        provider: dto.provider,
        apiKey,
        model: dto.model,
        body: { messages: dto.messages },
        stream: false,
        authType,
        extraHeaders,
      });
      rawResponse = fwd.response;
      formatFlags = {
        isGoogle: fwd.isGoogle,
        isAnthropic: fwd.isAnthropic,
        isChatGpt: fwd.isChatGpt,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadGatewayException(`Provider request failed: ${message}`);
    }
    const durationMs = Date.now() - startedAt;

    const headers = whitelistResponseHeaders(rawResponse.headers);
    const bodyText = await rawResponse.text();

    if (!rawResponse.ok) {
      await this.recordError(
        userId,
        agent,
        dto,
        authType,
        rawResponse.status,
        bodyText,
        durationMs,
      );
      const errorSummary = this.truncateError(bodyText, rawResponse.status);
      await this.history.saveColumn({
        userId,
        agent,
        runId: dto.runId,
        prompt: this.extractPrompt(dto.messages),
        model: dto.model,
        provider: dto.provider,
        authType,
        displayName: null,
        position: dto.position ?? 0,
        status: 'error',
        content: null,
        headers,
        errorMessage: errorSummary,
        metrics: null,
      });
      throw new BadGatewayException(errorSummary);
    }

    const openaiBody = this.normalizeResponseBody(bodyText, dto.model, formatFlags);
    const content = this.extractContent(openaiBody);
    const inputTokens = openaiBody.usage?.prompt_tokens ?? 0;
    const outputTokens = openaiBody.usage?.completion_tokens ?? 0;
    const cacheReadTokens = openaiBody.usage?.cache_read_tokens ?? 0;
    const cacheCreationTokens = openaiBody.usage?.cache_creation_tokens ?? 0;

    const cost = computeTokenCost({
      inputTokens,
      outputTokens,
      model: dto.model,
      pricing: this.pricingCache.getByModel(dto.model),
      isSubscription: authType === 'subscription',
    });

    await this.recordSuccess(userId, agent, dto, authType, {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      cost,
      durationMs,
    });

    await this.history.saveColumn({
      userId,
      agent,
      runId: dto.runId,
      prompt: this.extractPrompt(dto.messages),
      model: dto.model,
      provider: dto.provider,
      authType,
      displayName: null,
      position: dto.position ?? 0,
      status: 'success',
      content,
      headers,
      errorMessage: null,
      metrics: { inputTokens, outputTokens, cost, durationMs },
    });

    return {
      content,
      metrics: {
        cost,
        inputTokens,
        outputTokens,
        durationMs,
      },
      headers,
    };
  }

  private normalizeResponseBody(
    bodyText: string,
    model: string,
    flags: { isGoogle: boolean; isAnthropic: boolean; isChatGpt: boolean },
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
    agent: { id: string; tenant_id: string; name: string },
    dto: RunBenchmarkDto,
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
      routing_tier: null,
      routing_reason: 'benchmark',
      auth_type: authType,
      input_tokens: metrics.inputTokens,
      output_tokens: metrics.outputTokens,
      cache_read_tokens: metrics.cacheReadTokens,
      cache_creation_tokens: metrics.cacheCreationTokens,
      cost_usd: metrics.cost,
      duration_ms: metrics.durationMs,
    });
    this.eventBus.emit(userId);
  }

  private async recordError(
    userId: string,
    agent: { id: string; tenant_id: string; name: string },
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
        routing_tier: null,
        routing_reason: 'benchmark',
        auth_type: authType,
        duration_ms: durationMs,
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
