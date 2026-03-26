import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProvider } from '../../entities/user-provider.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { ProviderModelFetcherService } from './provider-model-fetcher.service';
import { ProviderModelRegistryService } from './provider-model-registry.service';
import { DiscoveredModel } from './model-fetcher';
import { decrypt, getEncryptionSecret } from '../../common/utils/crypto.util';
import { computeQualityScore } from '../../database/quality-score.util';
import { PricingSyncService } from '../../database/pricing-sync.service';
import { parseOAuthTokenBlob } from '../openai-oauth.types';
import { getQwenCompatibleBaseUrl, isQwenResolvedRegion } from '../qwen-region';
import { CopilotTokenService } from '../proxy/copilot-token.service';
import {
  findOpenRouterPrefix,
  lookupWithVariants,
  buildFallbackModels,
  buildSubscriptionFallbackModels,
  supplementWithKnownModels,
} from './model-fallback';
// Import static helpers directly to avoid circular dependency with RoutingModule
const customProviderKey = (id: string) => `custom:${id}`;
const customModelKey = (id: string, modelName: string) => `custom:${id}/${modelName}`;

function isQwenProvider(providerId: string): boolean {
  const lower = providerId.toLowerCase();
  return lower === 'qwen' || lower === 'alibaba';
}

@Injectable()
export class ModelDiscoveryService {
  private readonly logger = new Logger(ModelDiscoveryService.name);

  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(CustomProvider)
    private readonly customProviderRepo: Repository<CustomProvider>,
    private readonly fetcher: ProviderModelFetcherService,
    @Optional()
    @Inject(PricingSyncService)
    private readonly pricingSync: PricingSyncService | null,
    @Optional()
    @Inject(ProviderModelRegistryService)
    private readonly modelRegistry: ProviderModelRegistryService | null,
    @Optional()
    @Inject(CopilotTokenService)
    private readonly copilotTokenService: CopilotTokenService | null,
  ) {}

  async discoverModels(provider: UserProvider): Promise<DiscoveredModel[]> {
    let apiKey = '';
    let endpointOverride: string | undefined;
    const lowerProvider = provider.provider.toLowerCase();
    if (provider.api_key_encrypted) {
      try {
        apiKey = decrypt(provider.api_key_encrypted, getEncryptionSecret());
      } catch {
        this.logger.warn(`Failed to decrypt key for provider ${provider.provider}`);
        return [];
      }
    }

    // OAuth-backed subscription providers store an encrypted token blob.
    // Unwrap it so model discovery can call the provider-native /models endpoint.
    if (provider.auth_type === 'subscription' && apiKey) {
      if (lowerProvider === 'openai' || lowerProvider === 'minimax') {
        const blob = parseOAuthTokenBlob(apiKey);
        if (blob?.t) {
          apiKey = blob.t;
          if (lowerProvider === 'minimax' && blob.u) {
            endpointOverride = blob.u;
          }
        }
      } else if (lowerProvider === 'copilot' && this.copilotTokenService) {
        try {
          apiKey = await this.copilotTokenService.getCopilotToken(apiKey);
        } catch {
          this.logger.warn(
            'Copilot token exchange failed for model discovery — falling back to known models',
          );
          apiKey = '';
        }
      }
    }
    if (isQwenProvider(provider.provider) && isQwenResolvedRegion(provider.region)) {
      endpointOverride = getQwenCompatibleBaseUrl(provider.region);
    }

    let raw: DiscoveredModel[];

    // Subscription providers without a token: use curated fallback
    if (provider.auth_type === 'subscription' && !apiKey) {
      raw = buildSubscriptionFallbackModels(this.pricingSync, provider.provider);
      if (raw.length > 0) {
        this.logger.log(
          `No token for subscription provider ${provider.provider} — using ${raw.length} fallback models`,
        );
      }
    } else {
      raw = await this.fetcher.fetch(
        provider.provider,
        apiKey,
        provider.auth_type,
        endpointOverride,
      );

      // Register confirmed model IDs from native API for future fallback filtering
      if (raw.length > 0 && this.modelRegistry) {
        this.modelRegistry.registerModels(
          provider.provider,
          raw.map((m) => m.id),
        );
      }

      // If native API returned no models, fall back to OpenRouter filtered by confirmed models
      // Qwen is excluded because OpenRouter/pricing ids can diverge from DashScope ids.
      if (raw.length === 0 && !isQwenProvider(provider.provider)) {
        const confirmed = this.modelRegistry?.getConfirmedModels(provider.provider) ?? null;
        raw = buildFallbackModels(this.pricingSync, provider.provider, confirmed);
        if (raw.length > 0) {
          this.logger.log(
            `Native API returned 0 models for ${provider.provider} — using ${raw.length} models from pricing data`,
          );
        }
      }
    }

    // For subscription providers, supplement with knownModels so users can
    // always select them, even if the live API or OpenRouter didn't return them.
    if (provider.auth_type === 'subscription') {
      raw = supplementWithKnownModels(raw, provider.provider);
    }

    const authType = provider.auth_type === 'subscription' ? 'subscription' : 'api_key';
    const enriched = raw.map((model) => ({
      ...this.enrichModel(model, provider.provider),
      authType: authType as 'api_key' | 'subscription',
    }));

    provider.cached_models = enriched;
    provider.models_fetched_at = new Date().toISOString();
    await this.providerRepo.save(provider);

    this.logger.log(
      `Discovered ${enriched.length} models for provider ${provider.provider} (agent ${provider.agent_id})`,
    );
    return enriched;
  }

  async discoverAllForAgent(agentId: string): Promise<void> {
    const providers = await this.providerRepo.find({
      where: { agent_id: agentId, is_active: true },
    });
    await Promise.all(
      providers
        .filter((p) => !p.provider.startsWith('custom:'))
        .map((p) =>
          this.discoverModels(p).catch((err) => {
            this.logger.warn(`Discovery failed for ${p.provider}: ${err}`);
          }),
        ),
    );
  }

  async getModelsForAgent(agentId: string): Promise<DiscoveredModel[]> {
    const providers = await this.providerRepo.find({
      where: { agent_id: agentId, is_active: true },
    });

    const models: DiscoveredModel[] = [];
    const seen = new Map<string, number>();

    for (const p of providers) {
      if (p.provider.startsWith('custom:')) continue;
      const cached = p.cached_models;
      if (!Array.isArray(cached)) continue;
      const providerAuthType = p.auth_type === 'subscription' ? 'subscription' : 'api_key';
      for (const m of cached) {
        const effectiveAuthType = m.authType ?? providerAuthType;
        if (!seen.has(m.id)) {
          seen.set(m.id, models.length);
          models.push(m);
        } else if (
          effectiveAuthType === 'subscription' &&
          models[seen.get(m.id)!]?.authType !== 'subscription'
        ) {
          models[seen.get(m.id)!] = m;
        }
      }
    }

    // Merge custom provider models
    const customProviders = await this.customProviderRepo.find({
      where: { agent_id: agentId },
    });
    for (const cp of customProviders) {
      if (!Array.isArray(cp.models)) continue;
      const cpKey = customProviderKey(cp.id);
      for (const m of cp.models) {
        const modelKey = customModelKey(cp.id, m.model_name);
        if (seen.has(modelKey)) continue;
        seen.set(modelKey, models.length);
        const inputPerToken =
          m.input_price_per_million_tokens != null
            ? m.input_price_per_million_tokens / 1_000_000
            : null;
        const outputPerToken =
          m.output_price_per_million_tokens != null
            ? m.output_price_per_million_tokens / 1_000_000
            : null;
        models.push({
          id: modelKey,
          displayName: m.model_name,
          provider: cpKey,
          contextWindow: m.context_window ?? 128000,
          inputPricePerToken: inputPerToken,
          outputPricePerToken: outputPerToken,
          capabilityReasoning: false,
          capabilityCode: false,
          qualityScore: 2,
        });
      }
    }

    return models;
  }

  async getModelForAgent(agentId: string, modelName: string): Promise<DiscoveredModel | undefined> {
    const all = await this.getModelsForAgent(agentId);
    return all.find((m) => m.id === modelName);
  }

  private enrichModel(model: DiscoveredModel, providerId: string): DiscoveredModel {
    if (model.inputPricePerToken !== null && model.inputPricePerToken > 0) {
      return this.computeScore(model);
    }

    if (this.pricingSync) {
      const orPrefix = findOpenRouterPrefix(providerId);
      if (orPrefix) {
        const orPricing = lookupWithVariants(this.pricingSync, orPrefix, model.id);
        if (orPricing) {
          return this.computeScore({
            ...model,
            inputPricePerToken: orPricing.input,
            outputPricePerToken: orPricing.output,
            contextWindow: orPricing.contextWindow ?? model.contextWindow,
            displayName: orPricing.displayName || model.displayName,
          });
        }
      }
      const exactPricing = this.pricingSync.lookupPricing(model.id);
      if (exactPricing) {
        return this.computeScore({
          ...model,
          inputPricePerToken: exactPricing.input,
          outputPricePerToken: exactPricing.output,
          contextWindow: exactPricing.contextWindow ?? model.contextWindow,
          displayName: exactPricing.displayName || model.displayName,
        });
      }
    }

    return this.computeScore(model);
  }

  private computeScore(model: DiscoveredModel): DiscoveredModel {
    const score = computeQualityScore({
      model_name: model.id,
      input_price_per_token: model.inputPricePerToken,
      output_price_per_token: model.outputPricePerToken,
      capability_reasoning: model.capabilityReasoning,
      capability_code: model.capabilityCode,
      context_window: model.contextWindow,
    });
    return { ...model, qualityScore: score };
  }
}
