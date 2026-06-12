import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere } from 'typeorm';
import { UserProvider } from '../../entities/user-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';
import { HeaderTier } from '../../entities/header-tier.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { RoutingCacheService } from './routing-cache.service';
import { randomUUID } from 'crypto';
import { encrypt, decrypt, getEncryptionSecret } from '../../common/utils/crypto.util';
import {
  isManifestUsableProvider,
  isSupportedSubscriptionProvider,
} from '../../common/utils/subscription-support';
import type { AuthType, ModelRoute } from 'manifest-shared';
import { TIER_LABELS } from 'manifest-shared';
import { detectQwenRegion, isQwenRegion, isQwenResolvedRegion } from '../qwen-region';
import {
  DEFAULT_BEDROCK_REGION,
  detectBedrockRegionFromApiKey,
  isBedrockProvider,
  isBedrockRegion,
} from '../bedrock-region';
import {
  getSubscriptionEndpointRegionConfig,
  SubscriptionEndpointRegionConfig,
} from '../subscription-region';

const MAX_KEYS_PER_PROVIDER = 5;
const MAX_LABEL_LENGTH = 50;
const DEFAULT_LABEL = 'Default';

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(TierAssignment)
    private readonly tierRepo: Repository<TierAssignment>,
    @InjectRepository(SpecificityAssignment)
    private readonly specificityRepo: Repository<SpecificityAssignment>,
    @InjectRepository(HeaderTier)
    private readonly headerTierRepo: Repository<HeaderTier>,
    private readonly autoAssign: TierAutoAssignService,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly routingCache: RoutingCacheService,
  ) {}

  /** Public entry point for tier recalculation (e.g. after model discovery). */
  async recalculateTiers(agentId: string): Promise<void> {
    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);
  }

  async getProviders(agentId: string): Promise<UserProvider[]> {
    const cached = this.routingCache.getProviders(agentId);
    if (cached) return cached;

    await this.cleanupUnsupportedSubscriptionProviders(agentId);
    const providers = (await this.providerRepo.find({ where: { agent_id: agentId } })).filter(
      isManifestUsableProvider,
    );
    this.routingCache.setProviders(agentId, providers);
    return providers;
  }

  /**
   * Read the freshest persisted subscription credential straight from the DB,
   * decrypted, bypassing the routing cache. The OAuth refresh coordinator uses
   * this so a lazy token refresh never rotates based on a stale cached blob
   * (see issue #2012). Returns the decrypted raw stored value, or null when
   * there is no row / no stored credential / it cannot be decrypted.
   */
  async getFreshSubscriptionCredential(
    agentId: string,
    provider: string,
    label?: string,
  ): Promise<string | null> {
    // Match the label case-insensitively, consistent with the rest of the
    // label handling and the unique index on (agent_id, provider, auth_type,
    // LOWER(label)). A pinned route may carry a different casing than the
    // stored row; a case-sensitive lookup would miss it and refresh from the
    // stale caller blob instead of the freshest DB row.
    const wantedLabel = (label ?? DEFAULT_LABEL).toLowerCase();
    const rows = await this.providerRepo.find({
      where: { agent_id: agentId, provider, auth_type: 'subscription' },
    });
    const row = rows.find((r) => r.label.toLowerCase() === wantedLabel);
    if (!row?.api_key_encrypted) return null;
    try {
      return decrypt(row.api_key_encrypted, getEncryptionSecret());
    } catch {
      return null;
    }
  }

  async upsertProvider(
    agentId: string,
    userId: string,
    provider: string,
    apiKey?: string,
    authType?: AuthType,
    region?: string,
    label?: string,
  ): Promise<{ provider: UserProvider; isNew: boolean }> {
    const effectiveAuthType = authType ?? 'api_key';
    const trimmedLabel = this.normalizeLabel(label, effectiveAuthType);

    if (trimmedLabel) {
      return this.upsertProviderWithLabel(
        agentId,
        userId,
        provider,
        apiKey,
        effectiveAuthType,
        region,
        trimmedLabel,
      );
    }

    // Legacy single-key path: matches on (agent_id, provider, auth_type) +
    // label='Default' and updates the existing row in place. Preserves the
    // back-compat surface for clients that don't know about labels — the
    // migration backfilled every pre-existing row with label='Default', so
    // this lookup is unambiguous (the unique index guarantees at most one
    // 'Default' row per tuple).
    const existing = await this.providerRepo.findOne({
      where: { agent_id: agentId, provider, auth_type: effectiveAuthType, label: DEFAULT_LABEL },
    });
    const resolvedRegion = await this.resolveProviderRegion(
      provider,
      effectiveAuthType,
      region,
      apiKey,
      existing,
    );
    const apiKeyEncrypted = apiKey ? encrypt(apiKey, getEncryptionSecret()) : null;
    const keyPrefix = apiKey ? apiKey.substring(0, 8) : null;

    if (existing) {
      if (apiKeyEncrypted !== null) {
        existing.api_key_encrypted = apiKeyEncrypted;
        existing.key_prefix = keyPrefix;
      }
      existing.region = resolvedRegion;
      existing.is_active = true;
      existing.updated_at = new Date().toISOString();
      await this.providerRepo.save(existing);
      await this.afterProviderInsert(agentId);
      return { provider: existing, isNew: false };
    }

    const record: UserProvider = Object.assign(new UserProvider(), {
      id: randomUUID(),
      user_id: userId,
      agent_id: agentId,
      provider,
      auth_type: effectiveAuthType,
      label: DEFAULT_LABEL,
      priority: 0,
      api_key_encrypted: apiKeyEncrypted,
      key_prefix: keyPrefix,
      region: resolvedRegion,
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await this.providerRepo.insert(record);
    await this.afterProviderInsert(agentId);
    return { provider: record, isNew: true };
  }

  private async upsertProviderWithLabel(
    agentId: string,
    userId: string,
    provider: string,
    apiKey: string | undefined,
    authType: AuthType,
    region: string | undefined,
    label: string,
  ): Promise<{ provider: UserProvider; isNew: boolean }> {
    const existingRows = await this.providerRepo.find({
      where: { agent_id: agentId, provider, auth_type: authType },
    });
    const existing =
      existingRows.find((r) => r.label.toLowerCase() === label.toLowerCase()) ?? null;
    const resolvedRegion = await this.resolveProviderRegion(
      provider,
      authType,
      region,
      apiKey,
      existing,
    );
    const apiKeyEncrypted = apiKey ? encrypt(apiKey, getEncryptionSecret()) : null;
    const keyPrefix = apiKey ? apiKey.substring(0, 8) : null;

    if (existing) {
      if (apiKeyEncrypted !== null) {
        existing.api_key_encrypted = apiKeyEncrypted;
        existing.key_prefix = keyPrefix;
      }
      existing.region = resolvedRegion;
      existing.is_active = true;
      existing.updated_at = new Date().toISOString();
      await this.providerRepo.save(existing);
      await this.afterProviderInsert(agentId);
      return { provider: existing, isNew: false };
    }

    const activeCount = existingRows.filter((r) => r.is_active).length;
    if (activeCount >= MAX_KEYS_PER_PROVIDER) {
      throw new BadRequestException(
        `You can connect at most ${MAX_KEYS_PER_PROVIDER} keys per provider`,
      );
    }

    // Reject duplicate-value submissions: a different label on top of an
    // already-stored key value is just clutter (charges still hit the same
    // upstream account). The unique index protects label uniqueness; this
    // catches the value-side collision the index can't see.
    if (apiKey) {
      const conflict = existingRows.find(
        (r) =>
          r.is_active &&
          !!r.api_key_encrypted &&
          this.decryptOrNull(r.api_key_encrypted) === apiKey,
      );
      if (conflict) {
        throw new BadRequestException(
          `That key is already saved for this provider as "${conflict.label}"`,
        );
      }
    }

    const record: UserProvider = Object.assign(new UserProvider(), {
      id: randomUUID(),
      user_id: userId,
      agent_id: agentId,
      provider,
      auth_type: authType,
      label,
      priority: this.nextPriority(existingRows),
      api_key_encrypted: apiKeyEncrypted,
      key_prefix: keyPrefix,
      region: resolvedRegion,
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await this.providerRepo.insert(record);
    await this.afterProviderInsert(agentId);
    return { provider: record, isNew: true };
  }

  async renameKey(
    agentId: string,
    provider: string,
    authType: AuthType,
    currentLabel: string,
    newLabel: string,
  ): Promise<UserProvider> {
    const trimmed = newLabel.trim();
    this.assertLabelLooksValid(trimmed);

    const rows = await this.providerRepo.find({
      where: { agent_id: agentId, provider, auth_type: authType },
    });
    const target = rows.find((r) => r.label.toLowerCase() === currentLabel.toLowerCase());
    if (!target) throw new NotFoundException('Provider key not found');
    if (rows.some((r) => r.id !== target.id && r.label.toLowerCase() === trimmed.toLowerCase())) {
      throw new BadRequestException(`A key named "${trimmed}" already exists for this provider`);
    }

    const previousLabel = target.label;
    target.label = trimmed;
    target.updated_at = new Date().toISOString();
    await this.providerRepo.save(target);
    await this.relabelOverrides(agentId, provider, authType, previousLabel, trimmed);
    this.routingCache.invalidateAgent(agentId);
    return target;
  }

  async reorderKeys(
    agentId: string,
    provider: string,
    authType: AuthType,
    orderedLabels: string[],
  ): Promise<UserProvider[]> {
    const allRows = await this.providerRepo.find({
      where: { agent_id: agentId, provider, auth_type: authType },
    });
    const rows = allRows.filter((r) => r.is_active);
    if (rows.length === 0) throw new NotFoundException('Provider not found');

    const byLabel = new Map(rows.map((r) => [r.label.toLowerCase(), r]));
    if (orderedLabels.length !== rows.length) {
      throw new BadRequestException(
        `Reorder must include exactly ${rows.length} labels for this provider`,
      );
    }
    const seen = new Set<string>();
    for (const label of orderedLabels) {
      const lower = label.toLowerCase();
      if (seen.has(lower)) {
        throw new BadRequestException(`Duplicate label "${label}" in reorder request`);
      }
      seen.add(lower);
      if (!byLabel.has(lower)) {
        throw new BadRequestException(`Unknown label "${label}" in reorder request`);
      }
    }

    const now = new Date().toISOString();
    const updated: UserProvider[] = [];
    for (let i = 0; i < orderedLabels.length; i++) {
      const row = byLabel.get(orderedLabels[i].toLowerCase())!;
      row.priority = i;
      row.updated_at = now;
      updated.push(row);
    }
    await this.providerRepo.save(updated);
    this.routingCache.invalidateAgent(agentId);
    return updated;
  }

  private async resolveProviderRegion(
    provider: string,
    authType: AuthType,
    requestedRegion: string | undefined,
    apiKey: string | undefined,
    existing: UserProvider | null,
  ): Promise<string | null> {
    const lower = provider.toLowerCase();

    const subscriptionRegionConfig = getSubscriptionEndpointRegionConfig(lower, authType);
    if (subscriptionRegionConfig) {
      return this.resolveSubscriptionEndpointRegion(
        subscriptionRegionConfig,
        requestedRegion,
        existing,
      );
    }

    if (isBedrockProvider(lower) && authType === 'api_key') {
      if (requestedRegion !== undefined) {
        if (!isBedrockRegion(requestedRegion)) {
          throw new BadRequestException('AWS Bedrock region must be a valid AWS region code');
        }
        return requestedRegion;
      }

      const detectedRegion = detectBedrockRegionFromApiKey(apiKey);
      if (detectedRegion) return detectedRegion;
      return isBedrockRegion(existing?.region) ? existing.region : DEFAULT_BEDROCK_REGION;
    }

    const isQwenProvider = lower === 'qwen' || lower === 'alibaba';
    if (!isQwenProvider || authType !== 'api_key') return null;

    if (requestedRegion === undefined) {
      if (apiKey) {
        return this.detectQwenRegionOrThrow(apiKey);
      }
      return isQwenResolvedRegion(existing?.region) ? existing.region : null;
    }

    if (!isQwenRegion(requestedRegion)) {
      throw new BadRequestException('Qwen region must be one of: auto, singapore, us, beijing');
    }

    if (requestedRegion !== 'auto') return requestedRegion;

    const keyToProbe = await this.getQwenDetectionKey(apiKey, existing);
    if (!keyToProbe) {
      return isQwenResolvedRegion(existing?.region) ? existing.region : null;
    }

    return this.detectQwenRegionOrThrow(keyToProbe);
  }

  private resolveSubscriptionEndpointRegion(
    config: SubscriptionEndpointRegionConfig,
    requestedRegion: string | undefined,
    existing: UserProvider | null,
  ): string | null {
    if (requestedRegion === undefined) {
      const existingRegion = existing?.region;
      return typeof existingRegion === 'string' && config.isRegion(existingRegion)
        ? existingRegion
        : null;
    }
    if (!config.isRegion(requestedRegion)) {
      throw new BadRequestException(config.validationMessage);
    }
    return requestedRegion;
  }

  private async getQwenDetectionKey(
    apiKey: string | undefined,
    existing: UserProvider | null,
  ): Promise<string | null> {
    if (apiKey) return apiKey;
    if (!existing?.api_key_encrypted) return null;

    try {
      return decrypt(existing.api_key_encrypted, getEncryptionSecret());
    } catch {
      this.logger.warn('Failed to decrypt API key while auto-detecting Alibaba region');
      return null;
    }
  }

  private async detectQwenRegionOrThrow(apiKey: string): Promise<string> {
    const detected = await detectQwenRegion(apiKey);
    if (detected) return detected;

    throw new BadRequestException(
      'Could not auto-detect Alibaba region from this API key. Verify the key and try again.',
    );
  }

  async registerSubscriptionProvider(
    agentId: string,
    userId: string,
    provider: string,
  ): Promise<{ isNew: boolean }> {
    if (!isSupportedSubscriptionProvider(provider)) {
      this.logger.debug(`Ignoring unsupported subscription provider registration for ${provider}`);
      return { isNew: false };
    }

    const existing = await this.providerRepo.findOne({
      where: { agent_id: agentId, provider, auth_type: 'subscription' },
    });

    if (existing) return { isNew: false };
    const hasApiKey = await this.providerRepo.findOne({
      where: { agent_id: agentId, provider, auth_type: 'api_key', is_active: true },
    });
    if (hasApiKey) return { isNew: false };

    const record: UserProvider = Object.assign(new UserProvider(), {
      id: randomUUID(),
      user_id: userId,
      agent_id: agentId,
      provider,
      auth_type: 'subscription',
      label: DEFAULT_LABEL,
      priority: 0,
      api_key_encrypted: null,
      key_prefix: null,
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await this.providerRepo.insert(record);
    await this.afterProviderInsert(agentId);
    return { isNew: true };
  }

  private async afterProviderInsert(agentId: string): Promise<void> {
    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);
  }

  /**
   * Flip `auth_type` on an existing `user_providers` row in-place without
   * deactivating it or cleaning up tier overrides. Used by custom-provider
   * renames that cross the local ↔ api_key boundary (LM Studio ↔ freeform
   * name), where going through removeProvider+upsertProvider would churn
   * tier assignments for what is visually just a name change.
   */
  async retagAuthType(agentId: string, provider: string, nextAuthType: AuthType): Promise<void> {
    // Wrap the dedupe + flip in a transaction so a crash between the
    // collision DELETE and the retag SAVE can't leave the row set in a
    // half-updated state (losing the collision row while the source still
    // carries the old auth_type).
    const invalidated = await this.providerRepo.manager.transaction(async (manager) => {
      const txRepo = manager.getRepository(UserProvider);
      const rows = await txRepo.find({ where: { agent_id: agentId, provider } });
      const target = rows.find((r) => r.auth_type !== nextAuthType && r.is_active);
      if (!target) return false;

      // Protect the unique index on (agent_id, provider, auth_type, LOWER(label)):
      // if a row already exists for the destination auth_type with the same
      // label, the UPDATE would fail. Drop the stale destination row first.
      const collision = rows.find(
        (r) => r.auth_type === nextAuthType && r.label.toLowerCase() === target.label.toLowerCase(),
      );
      if (collision) {
        await txRepo.remove(collision);
      }

      target.auth_type = nextAuthType;
      target.updated_at = new Date().toISOString();
      await txRepo.save(target);
      return true;
    });

    if (invalidated) this.routingCache.invalidateAgent(agentId);
  }

  async removeProvider(
    agentId: string,
    provider: string,
    authType?: AuthType,
    label?: string,
  ): Promise<{ notifications: string[] }> {
    if (label) {
      return this.removeKeyByLabel(agentId, provider, authType, label);
    }

    // Legacy disconnect: deactivate every active key for the (provider,
    // [auth_type]) tuple. Falls back to findOne for compatibility with the
    // already-disconnected case so tier-cleanup still runs.
    const where: FindOptionsWhere<UserProvider> = { agent_id: agentId, provider, is_active: true };
    if (authType) where.auth_type = authType;
    const activeRows = await this.providerRepo.find({ where });

    if (activeRows.length === 0) {
      const fallbackWhere: FindOptionsWhere<UserProvider> = { agent_id: agentId, provider };
      if (authType) fallbackWhere.auth_type = authType;
      const any = await this.providerRepo.findOne({ where: fallbackWhere });
      if (!any) throw new NotFoundException('Provider not found');
    } else {
      const now = new Date().toISOString();
      for (const row of activeRows) {
        row.is_active = false;
        row.updated_at = now;
      }
      await this.providerRepo.save(activeRows);
    }
    const otherActive = await this.providerRepo.find({
      where: { agent_id: agentId, provider, is_active: true },
    });

    const hasOtherUsableAuthType = otherActive.some((record) => isManifestUsableProvider(record));
    if (hasOtherUsableAuthType && !authType) {
      // Provider is still available and the caller did not target a specific
      // auth type, so preserve existing route assignments.
      this.routingCache.invalidateAgent(agentId);
      return { notifications: [] };
    }

    const { invalidated } = await this.cleanupProviderReferences(agentId, [provider], {
      authType: hasOtherUsableAuthType ? authType : undefined,
    });
    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);

    const notifications: string[] = [];
    if (invalidated.length > 0) {
      const tierNames = invalidated.map((i) => i.tier);
      const updatedTiers = await this.tierRepo.find({
        where: { agent_id: agentId, tier: In(tierNames) },
      });
      const tierMap = new Map(updatedTiers.map((t) => [t.tier, t]));
      for (const { tier, modelName } of invalidated) {
        const updated = tierMap.get(tier);
        const newModel = updated?.auto_assigned_route?.model ?? null;
        const tierLabel = TIER_LABELS[tier as keyof typeof TIER_LABELS] ?? tier;
        const suffix = newModel
          ? `${tierLabel} is back to automatic mode (${newModel}).`
          : `${tierLabel} is back to automatic mode.`;
        notifications.push(`${modelName} is no longer available. ${suffix}`);
      }
    }

    return { notifications };
  }

  /**
   * Delete a single labeled key from a provider's chain. If it was the last
   * key for the (agent, provider, auth_type) tuple, falls through to the
   * existing whole-provider teardown so tier overrides get cleaned up.
   */
  private async removeKeyByLabel(
    agentId: string,
    provider: string,
    authType: AuthType | undefined,
    label: string,
  ): Promise<{ notifications: string[] }> {
    const where: FindOptionsWhere<UserProvider> = { agent_id: agentId, provider };
    if (authType) where.auth_type = authType;
    const matching = await this.providerRepo.find({ where });
    if (matching.length === 0) throw new NotFoundException('Provider not found');

    const target = matching.find((r) => r.label.toLowerCase() === label.toLowerCase());
    if (!target) throw new NotFoundException('Provider key not found');

    const stillHasOtherKeys = matching.some(
      (r) => r.id !== target.id && r.is_active && isManifestUsableProvider(r),
    );

    if (!stillHasOtherKeys) {
      // Last key — delegate to the no-label path which performs the full
      // tier-cleanup teardown. We pass authType through so the lookup
      // matches what we just deleted.
      return this.removeProvider(agentId, provider, target.auth_type);
    }

    await this.providerRepo.remove(target);
    await this.relabelOverrides(agentId, provider, target.auth_type, target.label, null);
    await this.renumberPriorities(agentId, provider, target.auth_type);
    this.routingCache.invalidateAgent(agentId);
    return { notifications: [] };
  }

  async deactivateAllProviders(agentId: string): Promise<void> {
    await this.providerRepo.update(
      { agent_id: agentId },
      { is_active: false, updated_at: new Date().toISOString() },
    );
    await this.tierRepo.update(
      { agent_id: agentId },
      {
        override_route: null,
        auto_assigned_route: null,
        fallback_routes: null,
        updated_at: new Date().toISOString(),
      },
    );
    // Custom (header) tiers are user-configured only — clear their routes too
    // so deactivating every provider doesn't leave stale pins behind.
    await this.headerTierRepo.update(
      { agent_id: agentId },
      {
        override_route: null,
        fallback_routes: null,
        updated_at: new Date().toISOString(),
      },
    );
    await this.autoAssign.recalculate(agentId);
    this.routingCache.invalidateAgent(agentId);
  }
  private async cleanupUnsupportedSubscriptionProviders(agentId: string): Promise<void> {
    const activeProviders = await this.providerRepo.find({
      where: { agent_id: agentId, is_active: true },
    });
    const unsupported = activeProviders.filter(
      (record) => record.auth_type === 'subscription' && !isManifestUsableProvider(record),
    );
    if (unsupported.length === 0) return;

    const now = new Date().toISOString();
    for (const record of unsupported) {
      record.is_active = false;
      record.updated_at = now;
    }
    await this.providerRepo.save(unsupported);

    const unsupportedIds = new Set(unsupported.map((record) => record.id));
    const remainingActive = activeProviders.filter((record) => !unsupportedIds.has(record.id));
    const usableProviders = remainingActive.filter(isManifestUsableProvider);

    const removedProviders = Array.from(
      new Set(
        unsupported
          .map((record) => record.provider)
          .filter(
            (provider) =>
              !usableProviders.some(
                (record) => record.provider.toLowerCase() === provider.toLowerCase(),
              ),
          ),
      ),
    );

    if (removedProviders.length > 0) {
      const { hadTierAssignments } = await this.cleanupProviderReferences(
        agentId,
        removedProviders,
      );
      if (hadTierAssignments) {
        await this.autoAssign.recalculate(agentId);
      }
    }
    this.routingCache.invalidateAgent(agentId);
  }

  /**
   * Clears overrides and fallback entries on both tier_assignments and
   * specificity_assignments that reference any of the given provider keys.
   *
   * A row matches when any of these hold for its override_model/fallback entry:
   *   - the assignment's override_provider equals the provider key (case-insensitive)
   *   - the model/entry string starts with `<providerKey>/` (covers custom:<uuid>/... entries
   *     that don't carry an explicit override_provider, and any fallback_models list where
   *     provider metadata isn't stored alongside the string)
   *   - the pricing cache infers the entry belongs to this provider (well-known models)
   */
  private async cleanupProviderReferences(
    agentId: string,
    providers: string[],
    options?: { authType?: AuthType },
  ): Promise<{ invalidated: { tier: string; modelName: string }[]; hadTierAssignments: boolean }> {
    if (providers.length === 0) return { invalidated: [], hadTierAssignments: false };

    const providerNames = new Set(providers.map((provider) => provider.toLowerCase()));
    const prefixKeys = providers.map((provider) => `${provider.toLowerCase()}/`);
    const modelBelongs = (model: string): boolean => {
      const lower = model.toLowerCase();
      if (prefixKeys.some((prefix) => lower.startsWith(prefix))) return true;
      const pricing = this.pricingCache.getByModel(model)?.provider.toLowerCase();
      return !!pricing && providerNames.has(pricing);
    };

    const invalidated: { tier: string; modelName: string }[] = [];
    const routeBelongs = (
      route: { provider: string; model: string; authType?: AuthType | null } | null,
    ): boolean => {
      if (!route) return false;
      if (options?.authType && route.authType !== options.authType) return false;
      if (providerNames.has(route.provider.toLowerCase())) return true;
      return modelBelongs(route.model);
    };

    const allTiers = await this.tierRepo.find({ where: { agent_id: agentId } });
    const hadTierAssignments = allTiers.length > 0;
    const tiersToSave: TierAssignment[] = [];
    for (const tier of allTiers) {
      let mutated = false;
      if (tier.override_route && routeBelongs(tier.override_route)) {
        invalidated.push({ tier: tier.tier, modelName: tier.override_route.model });
        tier.override_route = null;
        mutated = true;
      }
      if (tier.fallback_routes && tier.fallback_routes.length > 0) {
        const filteredRoutes = tier.fallback_routes.filter((route) => !routeBelongs(route));
        if (filteredRoutes.length !== tier.fallback_routes.length) {
          tier.fallback_routes = filteredRoutes.length > 0 ? filteredRoutes : null;
          mutated = true;
        }
      }
      if (mutated) {
        tier.updated_at = new Date().toISOString();
        tiersToSave.push(tier);
      }
    }

    if (tiersToSave.length > 0) await this.tierRepo.save(tiersToSave);

    const specificityRows = await this.specificityRepo.find({ where: { agent_id: agentId } });
    const specToSave: SpecificityAssignment[] = [];
    for (const row of specificityRows) {
      let changed = false;
      if (row.override_route && routeBelongs(row.override_route)) {
        row.override_route = null;
        changed = true;
      }
      if (row.fallback_routes && row.fallback_routes.length > 0) {
        const filteredRoutes = row.fallback_routes.filter((route) => !routeBelongs(route));
        if (filteredRoutes.length !== row.fallback_routes.length) {
          row.fallback_routes = filteredRoutes.length > 0 ? filteredRoutes : null;
          changed = true;
        }
      }
      if (changed) {
        row.updated_at = new Date().toISOString();
        specToSave.push(row);
      }
    }
    if (specToSave.length > 0) await this.specificityRepo.save(specToSave);

    // Custom (header) tiers reference the same providers. Drop routes that
    // belong to the removed provider so they don't linger after a full
    // disconnect. Header tiers have no auto-assigned slot, so a cleared
    // override just leaves the tier empty (resolve treats that as fallthrough)
    // — no notification path, unlike standard tiers above.
    const headerTiers = await this.headerTierRepo.find({ where: { agent_id: agentId } });
    const headerTiersToSave: HeaderTier[] = [];
    for (const h of headerTiers) {
      let changed = false;
      if (h.override_route && routeBelongs(h.override_route)) {
        h.override_route = null;
        changed = true;
      }
      if (h.fallback_routes && h.fallback_routes.length > 0) {
        const filteredRoutes = h.fallback_routes.filter((route) => !routeBelongs(route));
        if (filteredRoutes.length !== h.fallback_routes.length) {
          h.fallback_routes = filteredRoutes.length > 0 ? filteredRoutes : null;
          changed = true;
        }
      }
      if (changed) {
        h.updated_at = new Date().toISOString();
        headerTiersToSave.push(h);
      }
    }
    if (headerTiersToSave.length > 0) await this.headerTierRepo.save(headerTiersToSave);

    return { invalidated, hadTierAssignments };
  }

  /**
   * Update tier_assignments and specificity_assignments rows that reference a
   * specific provider key by label. Pass `nextLabel = null` to clear the
   * binding (used when the key is deleted — the assignment then resolves to
   * the new primary key).
   */
  private async relabelOverrides(
    agentId: string,
    provider: string,
    authType: AuthType,
    previousLabel: string,
    nextLabel: string | null,
  ): Promise<void> {
    const providerLower = provider.toLowerCase();
    const previousLower = previousLabel.toLowerCase();
    // Scope a route match to the (provider, authType) tuple so renaming one
    // provider's "Default" key doesn't accidentally rewrite another provider's
    // pinned label that happens to share the same string. Cubic flagged this
    // as P1 — keep it tight.
    const routeMatchesKey = (route: ModelRoute | null): boolean => {
      if (!route) return false;
      if (!route.keyLabel) return false;
      if (route.keyLabel.toLowerCase() !== previousLower) return false;
      if (route.provider.toLowerCase() !== providerLower) return false;
      if (route.authType !== authType) return false;
      return true;
    };
    const replaceKeyLabel = (route: ModelRoute): ModelRoute => ({
      ...route,
      keyLabel: nextLabel ?? null,
    });

    const tiers = await this.tierRepo.find({ where: { agent_id: agentId } });
    const tiersToSave: TierAssignment[] = [];
    const now = new Date().toISOString();
    for (const t of tiers) {
      let mutated = false;
      if (routeMatchesKey(t.override_route)) {
        t.override_route = replaceKeyLabel(t.override_route!);
        mutated = true;
      }
      if (t.fallback_routes && t.fallback_routes.some(routeMatchesKey)) {
        t.fallback_routes = t.fallback_routes.map((r) =>
          routeMatchesKey(r) ? replaceKeyLabel(r) : r,
        );
        mutated = true;
      }
      if (mutated) {
        t.updated_at = now;
        tiersToSave.push(t);
      }
    }
    if (tiersToSave.length > 0) await this.tierRepo.save(tiersToSave);

    // Specificity rows carry the same shape — relabel both override_route and
    // fallback_routes. Cubic flagged P2: skipping specificity fallbacks left
    // stale key-label pins behind, which then misrouted next time the
    // specificity rule fired.
    const specs = await this.specificityRepo.find({ where: { agent_id: agentId } });
    const specsToSave: SpecificityAssignment[] = [];
    for (const s of specs) {
      let mutated = false;
      if (routeMatchesKey(s.override_route)) {
        s.override_route = replaceKeyLabel(s.override_route!);
        mutated = true;
      }
      if (s.fallback_routes && s.fallback_routes.some(routeMatchesKey)) {
        s.fallback_routes = s.fallback_routes.map((r) =>
          routeMatchesKey(r) ? replaceKeyLabel(r) : r,
        );
        mutated = true;
      }
      if (mutated) {
        s.updated_at = now;
        specsToSave.push(s);
      }
    }
    if (specsToSave.length > 0) await this.specificityRepo.save(specsToSave);

    // Custom (header) tiers carry the same ModelRoute shape. They were
    // omitted here originally, so disconnecting one account out of several
    // (or renaming a key) left header-tier routes pinned to a label that no
    // longer exists — the account chip then renders blank. Relabel them too.
    const headerTiers = await this.headerTierRepo.find({ where: { agent_id: agentId } });
    const headerTiersToSave: HeaderTier[] = [];
    for (const h of headerTiers) {
      let mutated = false;
      if (routeMatchesKey(h.override_route)) {
        h.override_route = replaceKeyLabel(h.override_route!);
        mutated = true;
      }
      if (h.fallback_routes && h.fallback_routes.some(routeMatchesKey)) {
        h.fallback_routes = h.fallback_routes.map((r) =>
          routeMatchesKey(r) ? replaceKeyLabel(r) : r,
        );
        mutated = true;
      }
      if (mutated) {
        h.updated_at = now;
        headerTiersToSave.push(h);
      }
    }
    if (headerTiersToSave.length > 0) await this.headerTierRepo.save(headerTiersToSave);
  }

  private async renumberPriorities(
    agentId: string,
    provider: string,
    authType: AuthType,
  ): Promise<void> {
    const allRows = await this.providerRepo.find({
      where: { agent_id: agentId, provider, auth_type: authType },
      order: { priority: 'ASC' },
    });
    // Only contiguous-renumber active rows. Inactive rows are deactivated
    // history; their priorities don't affect the user-visible chain and we
    // don't want to "re-promote" a dormant key by collapsing the index.
    const rows = allRows.filter((r) => r.is_active);
    const now = new Date().toISOString();
    let changed = false;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].priority !== i) {
        rows[i].priority = i;
        rows[i].updated_at = now;
        changed = true;
      }
    }
    if (changed) await this.providerRepo.save(rows);
  }

  private normalizeLabel(label: string | undefined, authType: AuthType): string | undefined {
    if (label === undefined) return undefined;
    const trimmed = label.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Key name must not be empty');
    }
    // Local providers (Ollama, LM Studio) don't store credentials, so a
    // multi-key chain has no semantic meaning — keep them at one row.
    if (authType === 'local' && trimmed.toLowerCase() !== DEFAULT_LABEL.toLowerCase()) {
      throw new BadRequestException(
        `Custom key names are not supported for local providers (got auth_type=${authType})`,
      );
    }
    this.assertLabelLooksValid(trimmed);
    return trimmed;
  }

  private assertLabelLooksValid(label: string): void {
    if (label.length === 0) {
      throw new BadRequestException('Key name must not be empty');
    }
    if (label.length > MAX_LABEL_LENGTH) {
      throw new BadRequestException(`Key name must be at most ${MAX_LABEL_LENGTH} characters`);
    }
  }

  private decryptOrNull(encrypted: string): string | null {
    try {
      return decrypt(encrypted, getEncryptionSecret());
    } catch {
      return null;
    }
  }

  private nextPriority(existing: UserProvider[]): number {
    const active = existing.filter((r) => r.is_active);
    if (active.length === 0) return 0;
    return Math.max(...active.map((r) => r.priority)) + 1;
  }

  /**
   * Returns a unique label for a new OAuth key. If no row exists yet for this
   * (agent, provider, subscription) tuple, returns undefined so the caller
   * falls through to the legacy single-key upsert (creating "Default"). When
   * a "Default" row already exists, returns "Key 2", "Key 3", etc.
   */
  async nextOAuthLabel(agentId: string, provider: string): Promise<string | undefined> {
    const existing = await this.providerRepo.find({
      where: {
        agent_id: agentId,
        provider,
        auth_type: 'subscription' as AuthType,
        is_active: true,
      },
    });
    if (existing.length === 0) return undefined;
    const lower = new Set(existing.map((r) => r.label.toLowerCase()));
    for (let n = existing.length + 1; n < 100; n++) {
      const candidate = `Key ${n}`;
      if (!lower.has(candidate.toLowerCase())) return candidate;
    }
    return `Key ${existing.length + 1}`;
  }
}
