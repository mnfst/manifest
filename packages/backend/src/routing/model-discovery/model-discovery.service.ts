import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProvider } from '../../entities/user-provider.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { ProviderModelFetcherService } from './provider-model-fetcher.service';
import { DiscoveredModel } from './model-fetcher';
import { decrypt, getEncryptionSecret } from '../../common/utils/crypto.util';
import { computeQualityScore } from '../../database/quality-score.util';
import { PricingSyncService } from '../../database/pricing-sync.service';
import { parseOAuthTokenBlob } from '../openai-oauth.types';
import { inferProviderFromModel } from '../../common/utils/provider-inference';
import {
  findOpenRouterPrefix,
  lookupWithVariants,
  buildFallbackModels,
  buildSubscriptionFallbackModels,
  filterSubscriptionCatalogModels,
  supplementWithKnownModels,
  qualifyDiscoveredModelId,
} from './model-fallback';
// Import static helpers directly to avoid circular dependency with RoutingModule
const customProviderKey = (id: string) => `custom:${id}`;
const customModelKey = (id: string, modelName: string) => `custom:${id}/${modelName}`;
const qualifiedModelKey = (providerId: string, modelId: string) => `${providerId}/${modelId}`;

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
  ) {}

  async discoverModels(provider: UserProvider): Promise<DiscoveredModel[]> {
    let apiKey = '';
    let endpointOverride: string | undefined;
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
      const lowerProvider = provider.provider.toLowerCase();
      if (lowerProvider === 'openai' || lowerProvider === 'minimax') {
        const blob = parseOAuthTokenBlob(apiKey);
        if (blob?.t) {
          apiKey = blob.t;
          if (lowerProvider === 'minimax' && blob.u) {
            endpointOverride = blob.u;
          }
        }
      }
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

      // If native API returned no models, fall back to pricing data
      if (raw.length === 0) {
        raw =
          provider.auth_type === 'subscription'
            ? buildSubscriptionFallbackModels(this.pricingSync, provider.provider)
            : buildFallbackModels(this.pricingSync, provider.provider);
        if (raw.length > 0) {
          this.logger.log(
            `Native API returned 0 models for ${provider.provider} — using ${raw.length} ${provider.auth_type === 'subscription' ? 'subscription fallback' : 'pricing'} models`,
          );
        }
      }
    }

    // For subscription providers, supplement with knownModels so users can
    // always select them, even if the live API or OpenRouter didn't return them.
    if (provider.auth_type === 'subscription') {
      raw = filterSubscriptionCatalogModels(raw, provider.provider);
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
    const selectedByProviderAndModel = new Map<string, DiscoveredModel>();
    const providersByModelId = new Map<string, Set<string>>();

    for (const p of providers) {
      if (p.provider.startsWith('custom:')) continue;
      const cached = p.cached_models;
      if (!Array.isArray(cached)) continue;
      const providerId = p.provider.toLowerCase();
      const providerAuthType = p.auth_type === 'subscription' ? 'subscription' : 'api_key';
      for (const m of cached) {
        const qualifiedId = qualifyDiscoveredModelId(providerId, m.id);
        const effectiveAuthType = m.authType ?? providerAuthType;
        const providerModelKey = `${providerId}\u0000${qualifiedId}`;
        const current = selectedByProviderAndModel.get(providerModelKey);
        if (effectiveAuthType === 'subscription' && current?.authType !== 'subscription') {
          selectedByProviderAndModel.set(providerModelKey, {
            ...m,
            id: qualifiedId,
            authType: effectiveAuthType,
          });
        } else if (!current) {
          selectedByProviderAndModel.set(providerModelKey, {
            ...m,
            id: qualifiedId,
            authType: effectiveAuthType,
          });
        }
        const providerIds = providersByModelId.get(m.id) ?? new Set<string>();
        providerIds.add(providerId);
        providersByModelId.set(m.id, providerIds);
      }
    }

    const canonicalProviderByModelId = new Map<string, string>();
    for (const [modelId, providerIds] of providersByModelId) {
      if (providerIds.size < 2) continue;
      const inferredProvider = inferProviderFromModel(modelId)?.toLowerCase();
      canonicalProviderByModelId.set(
        modelId,
        inferredProvider && providerIds.has(inferredProvider)
          ? inferredProvider
          : [...providerIds].sort()[0]!,
      );
    }

    const seenProviderAndModel = new Set<string>();
    for (const p of providers) {
      if (p.provider.startsWith('custom:')) continue;
      const cached = p.cached_models;
      if (!Array.isArray(cached)) continue;
      const providerId = p.provider.toLowerCase();
      for (const m of cached) {
        const qualifiedId = qualifyDiscoveredModelId(providerId, m.id);
        const providerModelKey = `${providerId}\u0000${qualifiedId}`;
        if (seenProviderAndModel.has(providerModelKey)) continue;
        seenProviderAndModel.add(providerModelKey);

        const selected = selectedByProviderAndModel.get(providerModelKey);
        if (!selected) continue;

        const providerIds = providersByModelId.get(m.id);
        const canonicalProvider = canonicalProviderByModelId.get(m.id);
        const modelId =
          qualifiedId !== m.id
            ? qualifiedId
            : providerIds && providerIds.size > 1 && canonicalProvider !== providerId
              ? qualifiedModelKey(providerId, m.id)
              : m.id;

        models.push({
          ...selected,
          id: modelId,
        });
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
        if (models.some((model) => model.id === modelKey)) continue;
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
