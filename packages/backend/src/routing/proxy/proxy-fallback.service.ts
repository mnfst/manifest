import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderKeyService } from '../routing-core/provider-key.service';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { CustomProviderService } from '../custom-provider/custom-provider.service';
import { OpenaiOauthService } from '../oauth/openai-oauth.service';
import { MinimaxOauthService } from '../oauth/minimax-oauth.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { ProviderClient, ForwardResult } from './provider-client';
import { buildCustomEndpoint, buildEndpointOverride, ProviderEndpoint } from './provider-endpoints';
import { CopilotTokenService } from './copilot-token.service';
import { shouldTriggerFallback } from './fallback-status-codes';
import { inferProviderFromModelName } from '../../common/utils/provider-aliases';
import { normalizeMinimaxSubscriptionBaseUrl } from '../provider-base-url';
import { normalizeAnthropicShortModelId } from '../../common/utils/anthropic-model-id';
import {
  isTransportError,
  buildTransportErrorResponse,
  describeTransportError,
} from './proxy-transport';

export interface FailedFallback {
  model: string;
  provider: string;
  fallbackIndex: number;
  status: number;
  errorBody: string;
}

@Injectable()
export class ProxyFallbackService {
  private readonly logger = new Logger(ProxyFallbackService.name);

  constructor(
    private readonly providerKeyService: ProviderKeyService,
    @InjectRepository(CustomProvider)
    private readonly customProviderRepo: Repository<CustomProvider>,
    private readonly openaiOauth: OpenaiOauthService,
    private readonly minimaxOauth: MinimaxOauthService,
    private readonly providerClient: ProviderClient,
    private readonly copilotToken: CopilotTokenService,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  async tryFallbacks(
    agentId: string,
    userId: string,
    fallbackModels: string[],
    body: Record<string, unknown>,
    stream: boolean,
    sessionKey: string,
    primaryModel: string,
    signal?: AbortSignal,
  ): Promise<{
    success: {
      forward: ForwardResult;
      model: string;
      provider: string;
      fallbackIndex: number;
    } | null;
    failures: FailedFallback[];
  }> {
    const failures: FailedFallback[] = [];
    for (let i = 0; i < fallbackModels.length; i++) {
      const requestedModel = fallbackModels[i];
      const pricing = this.pricingCache.getByModel(requestedModel);

      // Determine provider: custom prefix -> model name inference -> pricing cache -> user's connected providers
      let provider: string | undefined;
      if (CustomProviderService.isCustom(requestedModel)) {
        const slashIdx = requestedModel.indexOf('/');
        provider = slashIdx > 0 ? requestedModel.substring(0, slashIdx) : requestedModel;
      } else {
        provider =
          inferProviderFromModelName(requestedModel) ??
          pricing?.provider ??
          (await this.providerKeyService.findProviderForModel(agentId, requestedModel));
      }

      if (!provider) {
        this.logger.debug(`Fallback ${i}: skipping model=${requestedModel} (no provider data)`);
        continue;
      }
      const model = normalizeProviderModel(provider, requestedModel);
      const authType = await this.providerKeyService.getAuthType(agentId, provider);
      let apiKey = await this.providerKeyService.getProviderApiKey(agentId, provider, authType);
      if (apiKey === null) {
        this.logger.debug(
          `Fallback ${i}: skipping model=${model} provider=${provider} (no API key)`,
        );
        continue;
      }

      const resolvedCredentials = await resolveApiKey(
        provider,
        apiKey,
        authType,
        agentId,
        userId,
        this.openaiOauth,
        this.minimaxOauth,
      );

      this.logger.log(
        `Fallback ${i}: trying model=${model} provider=${provider} auth_type=${authType} (primary=${primaryModel})`,
      );

      const forward = await this.tryForwardToProvider(
        provider,
        resolvedCredentials.apiKey,
        model,
        body,
        stream,
        sessionKey,
        signal,
        authType,
        resolvedCredentials.resourceUrl,
      );

      if (forward.response.ok) {
        return { success: { forward, model, provider, fallbackIndex: i }, failures };
      }

      const errorBody = await forward.response.text();
      failures.push({
        model,
        provider,
        fallbackIndex: i,
        status: forward.response.status,
        errorBody,
      });
      if (!shouldTriggerFallback(forward.response.status)) break;
    }
    return { success: null, failures };
  }

  async tryForwardToProvider(
    provider: string,
    apiKey: string,
    model: string,
    body: Record<string, unknown>,
    stream: boolean,
    sessionKey: string,
    signal?: AbortSignal,
    authType?: string,
    resourceUrl?: string,
  ): Promise<ForwardResult> {
    try {
      return await this.forwardToProvider(
        provider,
        apiKey,
        model,
        body,
        stream,
        sessionKey,
        signal,
        authType,
        resourceUrl,
      );
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!isTransportError(error)) throw error;

      const failureResponse = buildTransportErrorResponse(error);
      const message = describeTransportError(error);
      this.logger.warn(
        `Provider transport failure: provider=${provider} model=${model} status=${failureResponse.status} message=${message}`,
      );

      return {
        response: failureResponse,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      };
    }
  }

  private async forwardToProvider(
    provider: string,
    apiKey: string,
    model: string,
    body: Record<string, unknown>,
    stream: boolean,
    sessionKey: string,
    signal?: AbortSignal,
    authType?: string,
    resourceUrl?: string,
  ): Promise<ForwardResult> {
    const extraHeaders: Record<string, string> = {};
    if (provider === 'xai') {
      extraHeaders['x-grok-conv-id'] = sessionKey;
    }
    const hasExtraHeaders = Object.keys(extraHeaders).length > 0;

    // Copilot: exchange the stored GitHub OAuth token for a short-lived API token
    let effectiveKey = apiKey;
    if (provider.toLowerCase() === 'copilot') {
      effectiveKey = await this.copilotToken.getCopilotToken(apiKey);
    }

    let customEndpoint: ProviderEndpoint | undefined;
    let forwardModel = model;

    // Strip the "copilot/" prefix -- the Copilot API expects bare model names
    if (provider.toLowerCase() === 'copilot' && forwardModel.startsWith('copilot/')) {
      forwardModel = forwardModel.substring('copilot/'.length);
    }

    if (CustomProviderService.isCustom(provider)) {
      const cpId = CustomProviderService.extractId(provider);
      const cp = await this.customProviderRepo.findOne({ where: { id: cpId } });
      if (cp) {
        customEndpoint = buildCustomEndpoint(cp.base_url);
        forwardModel = CustomProviderService.rawModelName(model);
      }
    } else if (authType === 'subscription' && provider.toLowerCase() === 'minimax' && resourceUrl) {
      const minimaxBaseUrl = normalizeMinimaxSubscriptionBaseUrl(resourceUrl);
      if (minimaxBaseUrl) {
        customEndpoint = buildEndpointOverride(minimaxBaseUrl, 'minimax-subscription');
      } else {
        this.logger.warn('Ignoring invalid MiniMax subscription resource URL');
      }
    }

    return this.providerClient.forward(
      provider,
      effectiveKey,
      forwardModel,
      body,
      stream,
      signal,
      hasExtraHeaders ? extraHeaders : undefined,
      customEndpoint,
      authType,
    );
  }
}

// ---------------------------------------------------------------------------
// Shared helpers (used by both ProxyService and ProxyFallbackService)
// ---------------------------------------------------------------------------

export function normalizeProviderModel(provider: string, model: string): string {
  return provider.toLowerCase() === 'anthropic' ? normalizeAnthropicShortModelId(model) : model;
}

export async function resolveApiKey(
  provider: string,
  apiKey: string,
  authType: string | undefined,
  agentId: string,
  userId: string,
  openaiOauth: OpenaiOauthService,
  minimaxOauth: MinimaxOauthService,
): Promise<{ apiKey: string; resourceUrl?: string }> {
  if (authType === 'subscription') {
    const lower = provider.toLowerCase();
    if (lower === 'openai') {
      const unwrapped = await openaiOauth.unwrapToken(apiKey, agentId, userId);
      if (unwrapped) return { apiKey: unwrapped };
    }
    if (lower === 'minimax') {
      const unwrapped = await minimaxOauth.unwrapToken(apiKey, agentId, userId);
      if (unwrapped) return { apiKey: unwrapped.t, resourceUrl: unwrapped.u };
    }
  }
  return { apiKey };
}
