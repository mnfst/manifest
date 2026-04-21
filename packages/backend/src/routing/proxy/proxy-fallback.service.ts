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
import {
  buildCustomEndpoint,
  buildEndpointOverride,
  ProviderEndpoint,
  resolveEndpointKey,
} from './provider-endpoints';
import { CopilotTokenService } from './copilot-token.service';
import { buildProviderExtraHeaders } from './provider-hooks';
import { shouldTriggerFallback } from './fallback-status-codes';
import { inferProviderFromModelName } from '../../common/utils/provider-aliases';
import { normalizeMinimaxSubscriptionBaseUrl } from '../provider-base-url';
import { getQwenCompatibleBaseUrl, isQwenResolvedRegion } from '../qwen-region';
import { normalizeAnthropicShortModelId } from '../../common/utils/anthropic-model-id';
import {
  isTransportError,
  buildTransportErrorResponse,
  describeTransportError,
} from './proxy-transport';
import type { SignatureLookup, ThinkingBlockLookup } from './proxy-types';

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
    primaryProvider?: string,
    primaryAuthType?: string,
    signatureLookup?: SignatureLookup,
    thinkingLookup?: ThinkingBlockLookup,
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

    // Track auth types that already failed per provider so fallbacks for the
    // same provider try a different credential (fixes #1272).
    const failedAuthByProvider = new Map<string, Set<string>>();
    if (primaryProvider && primaryAuthType) {
      failedAuthByProvider.set(primaryProvider.toLowerCase(), new Set([primaryAuthType]));
    }

    for (let i = 0; i < fallbackModels.length; i++) {
      const requestedModel = fallbackModels[i];
      const pricing = this.pricingCache.getByModel(requestedModel);

      // Determine provider: custom prefix -> model name inference -> pricing cache -> user's connected providers
      let provider: string | undefined;
      if (CustomProviderService.isCustom(requestedModel)) {
        const slashIdx = requestedModel.indexOf('/');
        provider = slashIdx > 0 ? requestedModel.substring(0, slashIdx) : requestedModel;
      } else {
        const prefix = inferProviderFromModelName(requestedModel);
        provider =
          (prefix && (await this.providerKeyService.hasActiveProvider(agentId, prefix))
            ? prefix
            : undefined) ??
          pricing?.provider ??
          (await this.providerKeyService.findProviderForModel(agentId, requestedModel));
      }

      if (!provider) {
        this.logger.debug(`Fallback ${i}: skipping model=${requestedModel} (no provider data)`);
        continue;
      }
      const model = normalizeProviderModel(provider, requestedModel);
      const excludeAuth = failedAuthByProvider.get(provider.toLowerCase());
      const authType = await this.providerKeyService.getAuthType(agentId, provider, excludeAuth);
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
      const providerRegion = await this.providerKeyService.getProviderRegion(
        agentId,
        provider,
        authType,
      );

      this.logger.log(
        `Fallback ${i}: trying model=${model} provider=${provider} auth_type=${authType} (primary=${primaryModel})`,
      );

      const forward = await this.tryForwardToProvider({
        provider,
        apiKey: resolvedCredentials.apiKey,
        model,
        body,
        stream,
        sessionKey,
        signal,
        authType,
        resourceUrl: resolvedCredentials.resourceUrl,
        providerRegion,
        signatureLookup,
        thinkingLookup,
      });

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

      // Record this auth type as failed for the provider so subsequent
      // fallback models from the same provider try a different credential.
      // Create a new Set to avoid mutating the reference passed to getAuthType.
      const existing = failedAuthByProvider.get(provider.toLowerCase());
      const updated = new Set(existing);
      updated.add(authType);
      failedAuthByProvider.set(provider.toLowerCase(), updated);

      if (!shouldTriggerFallback(forward.response.status)) break;
    }
    return { success: null, failures };
  }

  async tryForwardToProvider(opts: {
    provider: string;
    apiKey: string;
    model: string;
    body: Record<string, unknown>;
    stream: boolean;
    sessionKey: string;
    signal?: AbortSignal;
    authType?: string;
    resourceUrl?: string;
    providerRegion?: string | null;
    signatureLookup?: SignatureLookup;
    thinkingLookup?: ThinkingBlockLookup;
  }): Promise<ForwardResult> {
    try {
      return await this.forwardToProvider(opts);
    } catch (error) {
      if (opts.signal?.aborted) throw error;
      if (!isTransportError(error)) throw error;

      const failureResponse = buildTransportErrorResponse(error);
      const message = describeTransportError(error);
      this.logger.warn(
        `Provider transport failure: provider=${opts.provider} model=${opts.model} status=${failureResponse.status} message=${message}`,
      );

      return {
        response: failureResponse,
        isGoogle: false,
        isAnthropic: false,
        isChatGpt: false,
      };
    }
  }

  private async forwardToProvider(opts: {
    provider: string;
    apiKey: string;
    model: string;
    body: Record<string, unknown>;
    stream: boolean;
    sessionKey: string;
    signal?: AbortSignal;
    authType?: string;
    resourceUrl?: string;
    providerRegion?: string | null;
    signatureLookup?: SignatureLookup;
    thinkingLookup?: ThinkingBlockLookup;
  }): Promise<ForwardResult> {
    const {
      provider,
      body,
      stream,
      signal,
      authType,
      resourceUrl,
      providerRegion,
      signatureLookup,
      thinkingLookup,
    } = opts;

    const extraHeaders = buildProviderExtraHeaders(provider, opts.sessionKey);

    // Copilot: exchange the stored GitHub OAuth token for a short-lived API token
    let effectiveKey = opts.apiKey;
    if (provider.toLowerCase() === 'copilot') {
      effectiveKey = await this.copilotToken.getCopilotToken(opts.apiKey);
    }

    let customEndpoint: ProviderEndpoint | undefined;
    let forwardModel = opts.model;

    // Strip the "copilot/" prefix -- the Copilot API expects bare model names
    if (provider.toLowerCase() === 'copilot' && forwardModel.startsWith('copilot/')) {
      forwardModel = forwardModel.substring('copilot/'.length);
    }

    if (CustomProviderService.isCustom(provider)) {
      const cpId = CustomProviderService.extractId(provider);
      const cp = await this.customProviderRepo.findOne({ where: { id: cpId } });
      if (cp) {
        customEndpoint = buildCustomEndpoint(cp.base_url);
        forwardModel = CustomProviderService.rawModelName(opts.model);
      }
    } else if (resolveEndpointKey(provider) === 'qwen' && isQwenResolvedRegion(providerRegion)) {
      customEndpoint = buildEndpointOverride(getQwenCompatibleBaseUrl(providerRegion), 'qwen');
    } else if (authType === 'subscription' && provider.toLowerCase() === 'minimax' && resourceUrl) {
      const minimaxBaseUrl = normalizeMinimaxSubscriptionBaseUrl(resourceUrl);
      if (minimaxBaseUrl) {
        customEndpoint = buildEndpointOverride(minimaxBaseUrl, 'minimax-subscription');
      } else {
        this.logger.warn('Ignoring invalid MiniMax subscription resource URL');
      }
    }

    return this.providerClient.forward({
      provider,
      apiKey: effectiveKey,
      model: forwardModel,
      body,
      stream,
      signal,
      extraHeaders,
      customEndpoint,
      authType,
      signatureLookup,
      thinkingLookup,
    });
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
