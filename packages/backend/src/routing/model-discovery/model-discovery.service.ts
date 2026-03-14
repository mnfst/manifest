import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProvider } from '../../entities/user-provider.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { ProviderModelFetcherService } from './provider-model-fetcher.service';
import { DiscoveredModel } from './model-fetcher';
import { MANUAL_PRICING } from './manual-pricing-reference';
import { decrypt, getEncryptionSecret } from '../../common/utils/crypto.util';
import { computeQualityScore } from '../../database/quality-score.util';
// Import static helpers directly to avoid circular dependency with RoutingModule
const customProviderKey = (id: string) => `custom:${id}`;
const customModelKey = (id: string, modelName: string) => `custom:${id}/${modelName}`;

@Injectable()
export class ModelDiscoveryService {
  private readonly logger = new Logger(ModelDiscoveryService.name);

  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(CustomProvider)
    private readonly customProviderRepo: Repository<CustomProvider>,
    private readonly fetcher: ProviderModelFetcherService,
  ) {}

  /**
   * OpenRouter pricing lookup cache, injected lazily to avoid circular deps.
   * Set by ModelDiscoveryModule via setOpenRouterLookup().
   */
  private openRouterLookup:
    | ((
        modelId: string,
      ) => { input: number; output: number; contextWindow?: number; displayName?: string } | null)
    | null = null;

  setOpenRouterLookup(
    fn: (
      modelId: string,
    ) => { input: number; output: number; contextWindow?: number; displayName?: string } | null,
  ): void {
    this.openRouterLookup = fn;
  }

  async discoverModels(provider: UserProvider): Promise<DiscoveredModel[]> {
    let apiKey = '';
    if (provider.api_key_encrypted) {
      try {
        apiKey = decrypt(provider.api_key_encrypted, getEncryptionSecret());
      } catch {
        this.logger.warn(`Failed to decrypt key for provider ${provider.provider}`);
        return [];
      }
    }

    const raw = await this.fetcher.fetch(provider.provider, apiKey, provider.auth_type);

    const enriched = raw.map((model) => this.enrichModel(model));

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
    const seen = new Set<string>();

    for (const p of providers) {
      if (p.provider.startsWith('custom:')) continue;
      const cached = p.cached_models;
      if (!Array.isArray(cached)) continue;
      for (const m of cached) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          models.push(m);
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
        seen.add(modelKey);
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

  private enrichModel(model: DiscoveredModel): DiscoveredModel {
    // If the fetcher already provided pricing, use it
    if (model.inputPricePerToken !== null && model.inputPricePerToken > 0) {
      return this.computeScore(model);
    }

    // Try OpenRouter lookup
    if (this.openRouterLookup) {
      const orPricing = this.openRouterLookup(model.id);
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

    // Try manual pricing reference
    const manual = MANUAL_PRICING.get(model.id);
    if (manual) {
      return this.computeScore({
        ...model,
        inputPricePerToken: manual.input,
        outputPricePerToken: manual.output,
      });
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
