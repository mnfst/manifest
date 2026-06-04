import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere } from 'typeorm';
import { UserProvider } from '../../entities/user-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';
import { Agent } from '../../entities/agent.entity';
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
import { isMinimaxRegion } from '../oauth/minimax-oauth-helpers';
import { isZaiCodingPlanRegion, isZaiProviderId } from '../zai-region';

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
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly autoAssign: TierAutoAssignService,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly routingCache: RoutingCacheService,
  ) {}

  /** Public entry point for tier recalculation (e.g. after model discovery). */
  async recalculateTiers(agentId: string, userId: string): Promise<void> {
    await this.autoAssign.recalculate(agentId, userId);
    this.routingCache.invalidateAgent(agentId);
  }

  /**
   * Recalculate tier assignments for every agent the user owns. Used when a
   * user-global resource changes (e.g. a custom provider) without a single
   * agent context — the change affects every agent's available model list, so
   * each agent's auto-assigned routes must be refreshed.
   */
  async recalculateTiersForUser(userId: string): Promise<void> {
    for (const agentId of await this.listOwnedAgentIds(userId)) {
      await this.autoAssign.recalculate(agentId, userId);
      this.routingCache.invalidateAgent(agentId);
    }
  }

  async getProviders(userId: string): Promise<UserProvider[]> {
    const cached = this.routingCache.getProviders(userId);
    if (cached) return cached;

    await this.cleanupUnsupportedSubscriptionProviders(userId);
    const providers = (await this.providerRepo.find({ where: { user_id: userId } })).filter(
      isManifestUsableProvider,
    );
    this.routingCache.setProviders(userId, providers);
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
    userId: string,
    provider: string,
    label?: string,
  ): Promise<string | null> {
    // Match the label case-insensitively, consistent with the rest of the
    // label handling and the unique index on (user_id, provider, auth_type,
    // LOWER(label)). A pinned route may carry a different casing than the
    // stored row; a case-sensitive lookup would miss it and refresh from the
    // stale caller blob instead of the freshest DB row.
    const wantedLabel = (label ?? DEFAULT_LABEL).toLowerCase();
    const rows = await this.providerRepo.find({
      where: { user_id: userId, provider, auth_type: 'subscription' },
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
    agentId: string | null,
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
      where: { user_id: userId, provider, auth_type: effectiveAuthType, label: DEFAULT_LABEL },
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
      await this.afterProviderChange(agentId, userId);
      return { provider: existing, isNew: false };
    }

    const record: UserProvider = Object.assign(new UserProvider(), {
      id: randomUUID(),
      user_id: userId,
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
    await this.afterProviderChange(agentId, userId);
    return { provider: record, isNew: true };
  }

  private async upsertProviderWithLabel(
    agentId: string | null,
    userId: string,
    provider: string,
    apiKey: string | undefined,
    authType: AuthType,
    region: string | undefined,
    label: string,
  ): Promise<{ provider: UserProvider; isNew: boolean }> {
    const existingRows = await this.providerRepo.find({
      where: { user_id: userId, provider, auth_type: authType },
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
      await this.afterProviderChange(agentId, userId);
      return { provider: existing, isNew: false };
    }

    const activeCount = existingRows.filter((r) => r.is_active).length;
    if (activeCount >= MAX_KEYS_PER_PROVIDER) {
      throw new BadRequestException(
        `You can connect at most ${MAX_KEYS_PER_PROVIDER} keys per provider`,
      );
    }

    // If the same API key value already exists (active or inactive), update
    // that row instead of creating a duplicate. This handles OAuth reconnects
    // where the token is the same but nextOAuthLabel() generated a new label.
    if (apiKey) {
      const sameKey = existingRows.find(
        (r) => !!r.api_key_encrypted && this.decryptOrNull(r.api_key_encrypted) === apiKey,
      );
      if (sameKey) {
        sameKey.region = resolvedRegion;
        sameKey.is_active = true;
        sameKey.updated_at = new Date().toISOString();
        await this.providerRepo.save(sameKey);
        await this.afterProviderChange(agentId, userId);
        return { provider: sameKey, isNew: false };
      }
    }

    const record: UserProvider = Object.assign(new UserProvider(), {
      id: randomUUID(),
      user_id: userId,
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
    await this.afterProviderChange(agentId, userId);
    return { provider: record, isNew: true };
  }

  async renameKey(
    agentId: string,
    userId: string,
    provider: string,
    authType: AuthType,
    currentLabel: string,
    newLabel: string,
  ): Promise<UserProvider> {
    const trimmed = newLabel.trim();
    this.assertLabelLooksValid(trimmed);

    const rows = await this.providerRepo.find({
      where: { user_id: userId, provider, auth_type: authType },
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
    this.routingCache.invalidateUser(userId);
    return target;
  }

  async reorderKeys(
    agentId: string,
    userId: string,
    provider: string,
    authType: AuthType,
    orderedLabels: string[],
  ): Promise<UserProvider[]> {
    const allRows = await this.providerRepo.find({
      where: { user_id: userId, provider, auth_type: authType },
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
    this.routingCache.invalidateUser(userId);
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

    // MiniMax subscription stores region so the proxy can route pasted-token
    // (sk-cp-) connections to the right base URL. OAuth-issued tokens already
    // encode the region in the resource_url blob field, but the paste path
    // has no blob — without this column the proxy falls back to global and
    // CN tokens 401 against the wrong host.
    if (lower === 'minimax' && authType === 'subscription') {
      if (requestedRegion === undefined) {
        return isMinimaxRegion(existing?.region ?? undefined) ? (existing!.region as string) : null;
      }
      if (!isMinimaxRegion(requestedRegion)) {
        throw new BadRequestException('MiniMax subscription region must be one of: global, cn');
      }
      return requestedRegion;
    }

    if (isZaiProviderId(lower) && authType === 'subscription') {
      if (requestedRegion === undefined) {
        return isZaiCodingPlanRegion(existing?.region) ? existing.region : null;
      }
      if (!isZaiCodingPlanRegion(requestedRegion)) {
        throw new BadRequestException('Z.ai subscription region must be one of: global, cn');
      }
      return requestedRegion;
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
      where: { user_id: userId, provider, auth_type: 'subscription' },
    });

    if (existing) return { isNew: false };
    const hasApiKey = await this.providerRepo.findOne({
      where: { user_id: userId, provider, auth_type: 'api_key', is_active: true },
    });
    if (hasApiKey) return { isNew: false };

    const record: UserProvider = Object.assign(new UserProvider(), {
      id: randomUUID(),
      user_id: userId,
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
    await this.afterProviderChange(agentId, userId);
    return { isNew: true };
  }

  private async afterProviderChange(agentId: string | null, userId: string): Promise<void> {
    // A null agentId means the change is user-global (e.g. a custom provider)
    // and has no single agent context — recalculate every owned agent instead.
    if (agentId === null) {
      await this.recalculateTiersForUser(userId);
    } else {
      await this.autoAssign.recalculate(agentId, userId);
      this.routingCache.invalidateAgent(agentId);
    }
    this.routingCache.invalidateUser(userId);
  }

  /**
   * Flip `auth_type` on an existing `user_providers` row in-place without
   * deactivating it or cleaning up tier overrides. Used by custom-provider
   * renames that cross the local ↔ api_key boundary (LM Studio ↔ freeform
   * name), where going through removeProvider+upsertProvider would churn
   * tier assignments for what is visually just a name change.
   */
  async retagAuthType(
    agentId: string | null,
    userId: string,
    provider: string,
    nextAuthType: AuthType,
  ): Promise<void> {
    // Wrap the dedupe + flip in a transaction so a crash between the
    // collision DELETE and the retag SAVE can't leave the row set in a
    // half-updated state (losing the collision row while the source still
    // carries the old auth_type).
    const invalidated = await this.providerRepo.manager.transaction(async (manager) => {
      const txRepo = manager.getRepository(UserProvider);
      const rows = await txRepo.find({ where: { user_id: userId, provider } });
      const target = rows.find((r) => r.auth_type !== nextAuthType && r.is_active);
      if (!target) return false;

      // Protect the unique index on (user_id, provider, auth_type, LOWER(label)):
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

    if (invalidated) {
      if (agentId !== null) this.routingCache.invalidateAgent(agentId);
      this.routingCache.invalidateUser(userId);
    }
  }

  async removeProvider(
    agentId: string | null,
    userId: string,
    provider: string,
    authType?: AuthType,
    label?: string,
  ): Promise<{ notifications: string[] }> {
    if (label) {
      // Labeled key chains only exist for agent-scoped standard providers;
      // user-global custom providers never pass a label, so agentId is set.
      return this.removeKeyByLabel(agentId as string, userId, provider, authType, label);
    }

    // Legacy disconnect: deactivate every active key for the (provider,
    // [auth_type]) tuple. Falls back to findOne for compatibility with the
    // already-disconnected case so tier-cleanup still runs.
    const where: FindOptionsWhere<UserProvider> = { user_id: userId, provider, is_active: true };
    if (authType) where.auth_type = authType;
    const activeRows = await this.providerRepo.find({ where });

    if (activeRows.length === 0) {
      const fallbackWhere: FindOptionsWhere<UserProvider> = { user_id: userId, provider };
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
      where: { user_id: userId, provider, is_active: true },
    });

    const hasOtherUsableAuthType = otherActive.some((record) => isManifestUsableProvider(record));
    if (hasOtherUsableAuthType && !authType) {
      // Provider is still available and the caller did not target a specific
      // auth type, so preserve existing route assignments.
      if (agentId !== null) this.routingCache.invalidateAgent(agentId);
      this.routingCache.invalidateUser(userId);
      return { notifications: [] };
    }

    // Providers are user-global: removing one affects the available model
    // set for every agent the user owns, not just the agent in the request.
    // Always fan out cleanup across all owned agents so sibling agents don't
    // keep stale override_route / auto_assigned_route / fallback_routes
    // pointing at the now-removed provider's models.
    const targetAgentIds = await this.listOwnedAgentIds(userId);
    const notifications: string[] = [];
    for (const target of targetAgentIds) {
      notifications.push(
        ...(await this.cleanupAgentAfterRemoval(
          target,
          userId,
          provider,
          hasOtherUsableAuthType,
          authType,
        )),
      );
    }
    this.routingCache.invalidateUser(userId);

    return { notifications };
  }

  /** Resolve the ids of every non-deleted agent the user owns. */
  private async listOwnedAgentIds(userId: string): Promise<string[]> {
    const agents = await this.agentRepo
      .createQueryBuilder('a')
      .leftJoin('a.tenant', 't')
      .where('t.name = :userId', { userId })
      .andWhere('a.deleted_at IS NULL')
      .select('a.id', 'id')
      .getRawMany<{ id: string }>();
    return agents.map((a) => a.id);
  }

  /** Clean tier references for one agent after a provider removal and surface notifications. */
  private async cleanupAgentAfterRemoval(
    agentId: string,
    userId: string,
    provider: string,
    hasOtherUsableAuthType: boolean,
    authType?: AuthType,
  ): Promise<string[]> {
    const { invalidated } = await this.cleanupProviderReferences(agentId, [provider], {
      authType: hasOtherUsableAuthType ? authType : undefined,
    });
    await this.autoAssign.recalculate(agentId, userId);
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
    return notifications;
  }

  /**
   * Delete a single labeled key from a provider's chain. If it was the last
   * key for the (agent, provider, auth_type) tuple, falls through to the
   * existing whole-provider teardown so tier overrides get cleaned up.
   */
  private async removeKeyByLabel(
    agentId: string,
    userId: string,
    provider: string,
    authType: AuthType | undefined,
    label: string,
  ): Promise<{ notifications: string[] }> {
    const where: FindOptionsWhere<UserProvider> = { user_id: userId, provider };
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
      return this.removeProvider(agentId, userId, provider, target.auth_type);
    }

    await this.providerRepo.remove(target);
    await this.relabelOverrides(agentId, provider, target.auth_type, target.label, null);
    await this.renumberPriorities(userId, provider, target.auth_type);
    this.routingCache.invalidateAgent(agentId);
    this.routingCache.invalidateUser(userId);
    return { notifications: [] };
  }

  async deactivateAllProviders(agentId: string, userId: string): Promise<void> {
    await this.providerRepo.update(
      { user_id: userId },
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
    await this.autoAssign.recalculate(agentId, userId);
    this.routingCache.invalidateAgent(agentId);
    this.routingCache.invalidateUser(userId);
  }

  private async cleanupUnsupportedSubscriptionProviders(userId: string): Promise<void> {
    const activeProviders = await this.providerRepo.find({
      where: { user_id: userId, is_active: true },
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
      // TODO: tier cleanup for removed subscription providers is per-agent.
      // With user-level providers, we need to clean up tiers across ALL agents
      // that reference these providers. For now, the provider is deactivated
      // and tier references will be cleaned up lazily on the next routing
      // resolution attempt.
      this.logger.debug(
        `Deactivated unsupported subscription providers for user=${userId}: ${removedProviders.join(', ')}`,
      );
    }
    this.routingCache.invalidateUser(userId);
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
      // The route explicitly names a different provider. The same model can be
      // served by multiple providers (e.g. claude via OpenRouter), so do NOT clear
      // it based on model-name inference — that would delete a still-valid route.
      if (route.provider) return false;
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
  }

  private async renumberPriorities(
    userId: string,
    provider: string,
    authType: AuthType,
  ): Promise<void> {
    const allRows = await this.providerRepo.find({
      where: { user_id: userId, provider, auth_type: authType },
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
  async nextOAuthLabel(userId: string, provider: string): Promise<string | undefined> {
    const existing = await this.providerRepo.find({
      where: {
        user_id: userId,
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
