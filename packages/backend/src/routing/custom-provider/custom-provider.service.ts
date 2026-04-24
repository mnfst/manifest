import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  CANONICAL_LOCAL_IDS,
  SHARED_PROVIDER_BY_ID_OR_ALIAS,
  normalizeProviderName,
} from 'manifest-shared';
import type { AuthType } from 'manifest-shared';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { ProviderService } from '../routing-core/provider.service';
import { RoutingCacheService } from '../routing-core/routing-cache.service';
import { TierAutoAssignService } from '../routing-core/tier-auto-assign.service';
import { CreateCustomProviderDto, UpdateCustomProviderDto } from '../dto/custom-provider.dto';
import { validatePublicUrl } from '../../common/utils/url-validation';
import { isSelfHosted } from '../../common/utils/detect-self-hosted';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { classifyProbeError } from './probe-error';

const PROBE_TIMEOUT_MS = 5000;

/**
 * OpenAI-compatible `/v1/models` endpoints return every model the server
 * knows about — including embedding / reranker / moderation models that
 * can't serve `/v1/chat/completions`. LM Studio silently redirects chat
 * calls to its loaded LLM, masking the problem; strict OpenAI-compatible
 * servers reject the call with 400. Either way, surfacing embedders in
 * the routing UI is misleading, so we filter them out at probe time.
 */
const EMBEDDING_MODEL_PATTERN =
  /(?:^|[\/_\-])embed(?:ding|dings|ed)?(?:[\/_\-]|$)|text[_\-]embedding|embedder|reranker|moderation/i;

export function isEmbeddingModel(id: string): boolean {
  return EMBEDDING_MODEL_PATTERN.test(id);
}

/**
 * A custom provider whose display name resolves to a canonical local
 * runner (Ollama, LM Studio) belongs under the Local tab, not API Keys.
 * Used to stamp `auth_type: 'local'` on the companion user_providers row
 * so messages routed through it carry the grey-house badge in the UI.
 */
export function isLocalCustomProviderName(name: string): boolean {
  const normalized = normalizeProviderName(name);
  const shared =
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(normalized) ??
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(name) ??
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(name.toLowerCase());
  return !!shared && CANONICAL_LOCAL_IDS.has(shared.id);
}

function authTypeForCustomProvider(name: string): AuthType {
  return isLocalCustomProviderName(name) ? 'local' : 'api_key';
}

@Injectable()
export class CustomProviderService {
  constructor(
    @InjectRepository(CustomProvider)
    private readonly repo: Repository<CustomProvider>,
    private readonly providerService: ProviderService,
    private readonly routingCache: RoutingCacheService,
    private readonly autoAssign: TierAutoAssignService,
    private readonly pricingCache: ModelPricingCacheService,
  ) {}

  /** Provider key used in UserProvider tables. */
  static providerKey(id: string): string {
    return `custom:${id}`;
  }

  /** Unique model name for model lookups. */
  static modelKey(id: string, modelName: string): string {
    return `custom:${id}/${modelName}`;
  }

  /** Strip the custom prefix to get the raw model name for upstream API. */
  static rawModelName(prefixedName: string): string {
    const slash = prefixedName.indexOf('/');
    return slash !== -1 ? prefixedName.substring(slash + 1) : prefixedName;
  }

  /** Check if a provider key is a custom provider. */
  static isCustom(provider: string): boolean {
    return provider.startsWith('custom:');
  }

  /** Extract the custom provider UUID from a provider key. */
  static extractId(providerKey: string): string {
    return providerKey.replace('custom:', '');
  }

  async list(agentId: string): Promise<CustomProvider[]> {
    const cached = this.routingCache.getCustomProviders(agentId);
    if (cached) return cached;

    const result = await this.repo.find({ where: { agent_id: agentId } });
    this.routingCache.setCustomProviders(agentId, result);
    return result;
  }

  async create(
    agentId: string,
    userId: string,
    dto: CreateCustomProviderDto,
  ): Promise<CustomProvider> {
    const existing = await this.repo.findOne({
      where: { agent_id: agentId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Custom provider "${dto.name}" already exists for this agent`);
    }

    try {
      await validatePublicUrl(dto.base_url, { allowPrivate: isSelfHosted() });
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const id = randomUUID();
    const provKey = CustomProviderService.providerKey(id);

    const cp = Object.assign(new CustomProvider(), {
      id,
      agent_id: agentId,
      user_id: userId,
      name: dto.name,
      base_url: dto.base_url,
      models: dto.models.map((m) => ({
        model_name: m.model_name,
        input_price_per_million_tokens: m.input_price_per_million_tokens,
        output_price_per_million_tokens: m.output_price_per_million_tokens,
        context_window: m.context_window ?? 128000,
      })),
      created_at: new Date().toISOString(),
    });
    await this.repo.insert(cp);

    // Create UserProvider + trigger tier recalculation. When the display
    // name resolves to Ollama / LM Studio we tag the row `'local'` so
    // routed messages carry the grey-house badge and the row shows up
    // under the Local tab.
    await this.providerService.upsertProvider(
      agentId,
      userId,
      provKey,
      dto.apiKey,
      authTypeForCustomProvider(dto.name),
    );

    // Rebuild the shared pricing cache so the proxy can compute cost for
    // requests routed to this custom provider's models immediately (without
    // waiting for the daily 5am reload).
    await this.pricingCache.reload();

    return cp;
  }

  async update(
    agentId: string,
    id: string,
    userId: string,
    dto: UpdateCustomProviderDto,
  ): Promise<CustomProvider> {
    const cp = await this.repo.findOne({ where: { id, agent_id: agentId } });
    if (!cp) {
      throw new NotFoundException('Custom provider not found');
    }

    const previousName = cp.name;
    if (dto.name !== undefined && dto.name !== cp.name) {
      const dup = await this.repo.findOne({
        where: { agent_id: agentId, name: dto.name },
      });
      if (dup) {
        throw new ConflictException(`Custom provider "${dto.name}" already exists for this agent`);
      }
      cp.name = dto.name;
    }

    if (dto.base_url !== undefined) {
      try {
        await validatePublicUrl(dto.base_url, { allowPrivate: isSelfHosted() });
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
      cp.base_url = dto.base_url;
    }

    if (dto.models !== undefined) {
      cp.models = dto.models.map((m) => ({
        model_name: m.model_name,
        input_price_per_million_tokens: m.input_price_per_million_tokens,
        output_price_per_million_tokens: m.output_price_per_million_tokens,
        context_window: m.context_window ?? 128000,
      }));
    }

    // Retag auth_type when the name changes categories (freeform ↔ canonical
    // local). This path fires even without an apiKey update because renaming
    // "LM Studio" to "My Home Server" should move the row off the Local tab,
    // and the reverse should light up the grey-house badge.
    const nextAuthType = authTypeForCustomProvider(cp.name);
    const nameCategoryChanged =
      previousName !== cp.name && authTypeForCustomProvider(previousName) !== nextAuthType;

    // Update API key if explicitly provided. Preserve the auth_type
    // derived from the (possibly renamed) display name so toggling between
    // "LM Studio" ↔ a freeform name re-tags the companion user_providers
    // row accordingly.
    if ('apiKey' in dto) {
      await this.providerService.upsertProvider(
        agentId,
        userId,
        CustomProviderService.providerKey(id),
        dto.apiKey,
        nextAuthType,
      );
    } else if (nameCategoryChanged) {
      // Rename-only path: flip auth_type in place so the row keeps its
      // stored api_key_encrypted and tier overrides stay intact. Going
      // through upsertProvider would insert a second row since the unique
      // index is keyed on (agent_id, provider, auth_type).
      await this.providerService.retagAuthType(
        agentId,
        CustomProviderService.providerKey(id),
        nextAuthType,
      );
    }

    // Recalculate tiers when models changed (even without API key change)
    if (dto.models !== undefined && !('apiKey' in dto) && !nameCategoryChanged) {
      await this.autoAssign.recalculate(agentId);
    }

    await this.repo.save(cp);
    this.routingCache.invalidateAgent(agentId);

    // Reload pricing cache when the model list changes so new prices (or
    // edits to existing ones) are used for subsequent cost computations.
    if (dto.models !== undefined) {
      await this.pricingCache.reload();
    }

    return cp;
  }

  async remove(agentId: string, id: string): Promise<void> {
    const cp = await this.repo.findOne({ where: { id, agent_id: agentId } });
    if (!cp) {
      throw new NotFoundException('Custom provider not found');
    }

    const provKey = CustomProviderService.providerKey(id);

    // Remove UserProvider + tier overrides
    try {
      await this.providerService.removeProvider(agentId, provKey);
    } catch {
      // Provider may not exist if creation partially failed
    }

    // Delete CustomProvider row
    await this.repo.remove(cp);

    // Drop stale pricing entries for this provider's models from the cache.
    await this.pricingCache.reload();
  }

  async getById(id: string): Promise<CustomProvider | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Probes the `{base_url}/models` endpoint of an OpenAI-compatible server
   * and returns the discovered model IDs. Used by the "Fetch models" button
   * in the custom-provider form so users connecting a local LLM server
   * (LM Studio, Ollama-on-host, or any OpenAI-compatible endpoint) don't
   * have to type each model name by hand.
   */
  async probeModels(baseUrl: string, apiKey?: string): Promise<{ model_name: string }[]> {
    try {
      await validatePublicUrl(baseUrl, { allowPrivate: isSelfHosted() });
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    // Trim trailing slashes without a regex to avoid polynomial backtracking
    // on adversarial input (CodeQL js/polynomial-redos).
    let end = baseUrl.length;
    while (end > 0 && baseUrl.charCodeAt(end - 1) === 47 /* '/' */) end--;
    const url = `${baseUrl.slice(0, end)}/models`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      // User-controlled URL is intentional here — this endpoint exists to
      // connect to operator-chosen LLM servers. validatePublicUrl() above is
      // our SSRF mitigation: cloud metadata is always blocked, private IPs
      // only accepted in the self-hosted version. `redirect: 'error'`
      // ensures a hostile server can't redirect the probe to a destination
      // that would bypass validation.
      // codeql[js/request-forgery]
      const res = await fetch(url, {
        headers,
        signal: controller.signal,
        redirect: 'error',
      });
      if (!res.ok) {
        throw new BadRequestException(classifyProbeError({ url, status: res.status }).message);
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new BadRequestException(classifyProbeError({ url, contentType }).message);
      }
      const body = (await res.json()) as { data?: { id?: string }[] };
      const items = body?.data ?? [];
      const filtered = items.filter(
        (m): m is { id: string } =>
          typeof m.id === 'string' && m.id.length > 0 && !isEmbeddingModel(m.id),
      );
      return filtered.map((m) => ({ model_name: m.id }));
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(classifyProbeError({ url, error: err as Error }).message);
    } finally {
      clearTimeout(timeout);
    }
  }
}
