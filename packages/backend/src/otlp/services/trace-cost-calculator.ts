import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProvider } from '../../entities/user-provider.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { isManifestUsableProvider } from '../../common/utils/subscription-support';
import { inferProviderFromModelName } from '../../common/utils/provider-aliases';
import { attrString, attrNumber, AttributeMap } from './otlp-helpers';

@Injectable()
export class TraceCostCalculator {
  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  /** Returns provider IDs that are subscription-only (no api_key counterpart) for an agent. */
  async getSubscriptionProviders(agentId: string): Promise<Set<string>> {
    const records = await this.providerRepo.find({
      where: { agent_id: agentId, is_active: true },
      select: ['provider', 'auth_type'],
    });
    const sub = new Set<string>();
    const apiKey = new Set<string>();
    for (const r of records) {
      if (!isManifestUsableProvider(r)) continue;
      if (r.auth_type === 'subscription') sub.add(r.provider);
      else if (r.auth_type === 'api_key') apiKey.add(r.provider);
    }
    // When both subscription and API key exist for the same provider,
    // remove from the subscription set: API key costs should always be shown.
    for (const p of apiKey) sub.delete(p);
    return sub;
  }

  computeCost(attrs: AttributeMap, subOnlyProviders?: Set<string>): number | null {
    const model =
      attrString(attrs, 'gen_ai.request.model') ?? attrString(attrs, 'gen_ai.response.model');
    if (!model) return null;

    const inputTok = attrNumber(attrs, 'gen_ai.usage.input_tokens') ?? 0;
    const outputTok = attrNumber(attrs, 'gen_ai.usage.output_tokens') ?? 0;
    if (inputTok === 0 && outputTok === 0) return null;

    // Check model prefix first (e.g. "copilot/gpt-4o" -> "copilot")
    const prefixProvider = inferProviderFromModelName(model);
    if (prefixProvider && subOnlyProviders?.has(prefixProvider)) return 0;

    const pricing = this.pricingCache.getByModel(model);
    if (!pricing) return null;

    if (subOnlyProviders?.has(pricing.provider?.toLowerCase())) return 0;

    return (
      inputTok * Number(pricing.input_price_per_token) +
      outputTok * Number(pricing.output_price_per_token)
    );
  }

  computeRollupCost(
    model: string | null,
    inputTokens: number,
    outputTokens: number,
    subOnlyProviders: Set<string>,
  ): number | null {
    if (!model) return null;

    // Check model prefix first (e.g. "copilot/gpt-4o" -> "copilot")
    const prefixProv = inferProviderFromModelName(model);
    const pricing = this.pricingCache.getByModel(model);
    if (prefixProv && subOnlyProviders.has(prefixProv)) {
      return 0;
    } else if (pricing && subOnlyProviders.has(pricing.provider?.toLowerCase())) {
      return 0;
    } else if (
      pricing &&
      pricing.input_price_per_token != null &&
      pricing.output_price_per_token != null
    ) {
      return (
        inputTokens * Number(pricing.input_price_per_token) +
        outputTokens * Number(pricing.output_price_per_token)
      );
    }
    return null;
  }

  inferAuthType(attrs: AttributeMap, subOnlyProviders: Set<string>): string | null {
    const model =
      attrString(attrs, 'gen_ai.request.model') ?? attrString(attrs, 'gen_ai.response.model');
    if (!model) return null;

    // Check model prefix first (e.g. "copilot/gpt-4o" -> "copilot")
    const prefixProvider = inferProviderFromModelName(model);
    if (prefixProvider && subOnlyProviders.has(prefixProvider)) return 'subscription';

    const pricing = this.pricingCache.getByModel(model);
    if (!pricing) return null;
    return subOnlyProviders.has(pricing.provider?.toLowerCase()) ? 'subscription' : 'api_key';
  }
}
