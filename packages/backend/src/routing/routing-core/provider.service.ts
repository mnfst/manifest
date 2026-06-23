import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere, EntityManager } from 'typeorm';
import { TenantProvider } from '../../entities/tenant-provider.entity';
import { AgentEnabledProvider } from '../../entities/agent-enabled-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';
import { Agent } from '../../entities/agent.entity';
import { HeaderTier } from '../../entities/header-tier.entity';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { RoutingCacheService } from './routing-cache.service';
import { randomUUID } from 'crypto';
import { encrypt, decrypt, getEncryptionSecret } from '../../common/utils/crypto.util';
import {
  isManifestUsableProvider,
  isSupportedSubscriptionProvider,
} from '../../common/utils/subscription-support';
import type { AuthType, ModelRoute } from 'manifest-shared';
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

interface ProviderRouteReference {
  agentId: string;
  agentName: string;
  surface: 'tier' | 'specificity' | 'header';
  name: string;
  model: string;
  position: string;
}

interface OwnedAgentRouteTarget {
  id: string;
  name: string;
}

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);

  constructor(
    @InjectRepository(TenantProvider)
    private readonly providerRepo: Repository<TenantProvider>,
    @InjectRepository(TierAssignment)
    private readonly tierRepo: Repository<TierAssignment>,
    @InjectRepository(SpecificityAssignment)
    private readonly specificityRepo: Repository<SpecificityAssignment>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(HeaderTier)
    private readonly headerTierRepo: Repository<HeaderTier>,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly routingCache: RoutingCacheService,
    @InjectRepository(AgentEnabledProvider)
    private readonly enabledProviderRepo: Repository<AgentEnabledProvider> | null = null,
  ) {}

  /**
   * Resolve the TenantProvider repository against an optional transaction
   * manager. Callers that need the companion-row dance to be atomic (custom
   * providers: custom_providers + tenant_providers must commit or roll back
   * together) pass the manager of their enclosing transaction; everyone else
   * gets the injected repository.
   */
  private tenantProviderRepo(manager?: EntityManager): Repository<TenantProvider> {
    return manager ? manager.getRepository(TenantProvider) : this.providerRepo;
  }

  /** Transaction-aware counterpart of `enabledProviderRepo` (see tenantProviderRepo). */
  private agentEnabledProviderRepo(
    manager?: EntityManager,
  ): Repository<AgentEnabledProvider> | null {
    if (!this.enabledProviderRepo) return null;
    return manager ? manager.getRepository(AgentEnabledProvider) : this.enabledProviderRepo;
  }

  /**
   * Back-compat entry point retained for callers that used to refresh automatic
   * routes after provider/model changes. Model routing is now user-controlled,
   * so this only invalidates caches.
   */
  async recalculateTiers(agentId: string, tenantId: string): Promise<void> {
    this.routingCache.invalidateAgent(agentId);
    this.routingCache.invalidateTenant(tenantId);
  }

  /**
   * Invalidate routing/model caches for every owned agent. Provider lifecycle
   * changes no longer create, refresh, or remove model routes.
   */
  async recalculateTiersForTenant(tenantId: string): Promise<void> {
    for (const agentId of await this.listOwnedAgentIds(tenantId)) {
      this.routingCache.invalidateAgent(agentId);
    }
    this.routingCache.invalidateTenant(tenantId);
  }

  async getProviders(tenantId: string): Promise<TenantProvider[]> {
    const cached = this.routingCache.getProviders(tenantId);
    if (cached) return cached;

    await this.cleanupUnsupportedSubscriptionProviders(tenantId);
    const providers = (await this.providerRepo.find({ where: { tenant_id: tenantId } })).filter(
      isManifestUsableProvider,
    );
    this.routingCache.setProviders(tenantId, providers);
    return providers;
  }

  async enableProviderForAgent(
    agentId: string,
    userProviderId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const enabledRepo = this.agentEnabledProviderRepo(manager);
    if (!enabledRepo) return;
    await enabledRepo
      .createQueryBuilder()
      .insert()
      .into(AgentEnabledProvider)
      .values({ agent_id: agentId, tenant_provider_id: userProviderId })
      .orIgnore()
      .execute();
  }

  /**
   * Symmetric auto-connect, direction 1 (a NEW agent appears).
   *
   * Providers are tenant-global and ON by default for every agent, so a freshly
   * created agent must immediately inherit every usable provider the user has
   * already connected. Route assignment remains user-controlled.
   */
  async enableAllProvidersForAgent(agentId: string, tenantId: string): Promise<void> {
    for (const provider of await this.getProviders(tenantId)) {
      await this.enableProviderForAgent(agentId, provider.id);
    }
    this.routingCache.invalidateAgent(agentId);
    this.routingCache.invalidateTenant(tenantId);
  }

  /**
   * Symmetric auto-connect, direction 2 (a NEW provider is connected).
   *
   * A newly connected provider is global and ON by default, so every agent the
   * user already owns must immediately gain access to it. Route assignment
   * remains user-controlled. No-op safe when the tenant owns 0 agents.
   */
  async enableProviderForAllAgents(
    tenantId: string,
    userProviderId: string,
    manager?: EntityManager,
  ): Promise<void> {
    for (const agentId of await this.listOwnedAgentIds(tenantId)) {
      await this.enableProviderForAgent(agentId, userProviderId, manager);
      this.routingCache.invalidateAgent(agentId);
    }
    this.routingCache.invalidateTenant(tenantId);
  }

  /**
   * Restore the global ON-by-default invariant when a previously disconnected
   * row is reconnected. removeProvider() deletes agent_enabled_providers rows
   * for EVERY agent, so a reactivation must fan back out to all owned agents —
   * afterProviderChange alone only re-enables the connecting agent (or none,
   * when agentId is null on the custom-provider path). Rotating an active key
   * never reaches this (wasInactive=false), preserving per-agent disables.
   */
  private async fanOutIfReactivated(
    wasInactive: boolean,
    tenantId: string,
    userProviderId: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (!wasInactive) return;
    await this.enableProviderForAllAgents(tenantId, userProviderId, manager);
  }

  private async deleteProviderAccess(
    userProviderIds: string[],
    manager?: EntityManager,
  ): Promise<void> {
    const enabledRepo = this.agentEnabledProviderRepo(manager);
    if (!enabledRepo || userProviderIds.length === 0) return;
    await enabledRepo.delete({ tenant_provider_id: In(userProviderIds) });
  }

  /**
   * Read the freshest persisted subscription credential straight from the DB,
   * decrypted, bypassing the routing cache. The OAuth refresh coordinator uses
   * this so a lazy token refresh never rotates based on a stale cached blob
   * (see issue #2012). Returns the decrypted raw stored value, or null when
   * there is no row / no stored credential / it cannot be decrypted.
   */
  async getFreshSubscriptionCredential(
    tenantId: string,
    provider: string,
    label?: string,
  ): Promise<string | null> {
    // Match the label case-insensitively, consistent with the rest of the
    // label handling and the unique index on (tenant_id, provider, auth_type,
    // LOWER(label)). A pinned route may carry a different casing than the
    // stored row; a case-sensitive lookup would miss it and refresh from the
    // stale caller blob instead of the freshest DB row.
    const wantedLabel = (label ?? DEFAULT_LABEL).toLowerCase();
    const rows = await this.providerRepo.find({
      where: { tenant_id: tenantId, provider, auth_type: 'subscription' },
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
    tenantId: string,
    provider: string,
    apiKey?: string,
    authType?: AuthType,
    region?: string,
    label?: string,
    createdByUserId?: string | null,
    manager?: EntityManager,
  ): Promise<{ provider: TenantProvider; isNew: boolean }> {
    const effectiveAuthType = authType ?? 'api_key';
    const trimmedLabel = this.normalizeLabel(label, effectiveAuthType);
    const repo = this.tenantProviderRepo(manager);

    if (trimmedLabel) {
      return this.upsertProviderWithLabel(
        agentId,
        tenantId,
        provider,
        apiKey,
        effectiveAuthType,
        region,
        trimmedLabel,
        createdByUserId,
        manager,
      );
    }

    // Legacy single-key path: matches on (tenant_id, provider, auth_type) +
    // label='Default' and updates the existing row in place. Preserves the
    // back-compat surface for clients that don't know about labels — the
    // migration backfilled every pre-existing row with label='Default', so
    // this lookup is unambiguous (the unique index guarantees at most one
    // 'Default' row per tuple).
    const existing = await repo.findOne({
      where: { tenant_id: tenantId, provider, auth_type: effectiveAuthType, label: DEFAULT_LABEL },
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
      // Captured BEFORE mutation: a disconnected row being reconnected must
      // fan back out below; rotating an active key must NOT (per-agent
      // disables survive rotation).
      const wasInactive = !existing.is_active;
      if (apiKeyEncrypted !== null) {
        existing.api_key_encrypted = apiKeyEncrypted;
        existing.key_prefix = keyPrefix;
      }
      existing.region = resolvedRegion;
      existing.is_active = true;
      existing.updated_at = new Date().toISOString();
      await repo.save(existing);
      await this.fanOutIfReactivated(wasInactive, tenantId, existing.id, manager);
      await this.afterProviderChange(agentId, tenantId, existing.id, manager);
      return { provider: existing, isNew: false };
    }

    const record: TenantProvider = Object.assign(new TenantProvider(), {
      id: randomUUID(),
      tenant_id: tenantId,
      created_by_user_id: createdByUserId ?? null,
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

    await repo.insert(record);
    // A brand-new provider is global + ON by default: enable it for every agent
    // the tenant owns, without changing model routes.
    await this.enableProviderForAllAgents(tenantId, record.id, manager);
    return { provider: record, isNew: true };
  }

  private async upsertProviderWithLabel(
    agentId: string | null,
    tenantId: string,
    provider: string,
    apiKey: string | undefined,
    authType: AuthType,
    region: string | undefined,
    label: string,
    createdByUserId?: string | null,
    manager?: EntityManager,
  ): Promise<{ provider: TenantProvider; isNew: boolean }> {
    const repo = this.tenantProviderRepo(manager);
    const existingRows = await repo.find({
      where: { tenant_id: tenantId, provider, auth_type: authType },
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
      // Captured BEFORE mutation — see the same dance in upsertProvider.
      const wasInactive = !existing.is_active;
      if (apiKeyEncrypted !== null) {
        existing.api_key_encrypted = apiKeyEncrypted;
        existing.key_prefix = keyPrefix;
      }
      existing.region = resolvedRegion;
      existing.is_active = true;
      existing.updated_at = new Date().toISOString();
      await repo.save(existing);
      await this.fanOutIfReactivated(wasInactive, tenantId, existing.id, manager);
      await this.afterProviderChange(agentId, tenantId, existing.id, manager);
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
        // Captured BEFORE mutation — see the same dance in upsertProvider.
        const wasInactive = !sameKey.is_active;
        sameKey.region = resolvedRegion;
        sameKey.is_active = true;
        sameKey.updated_at = new Date().toISOString();
        await repo.save(sameKey);
        await this.fanOutIfReactivated(wasInactive, tenantId, sameKey.id, manager);
        await this.afterProviderChange(agentId, tenantId, sameKey.id, manager);
        return { provider: sameKey, isNew: false };
      }
    }

    const record: TenantProvider = Object.assign(new TenantProvider(), {
      id: randomUUID(),
      tenant_id: tenantId,
      created_by_user_id: createdByUserId ?? null,
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

    await repo.insert(record);
    // A brand-new provider is global + ON by default: enable it for every agent
    // the tenant owns, without changing model routes.
    await this.enableProviderForAllAgents(tenantId, record.id, manager);
    return { provider: record, isNew: true };
  }

  async renameKey(
    agentId: string,
    tenantId: string,
    provider: string,
    authType: AuthType,
    currentLabel: string,
    newLabel: string,
  ): Promise<TenantProvider> {
    const trimmed = newLabel.trim();
    this.assertLabelLooksValid(trimmed);

    const rows = await this.providerRepo.find({
      where: { tenant_id: tenantId, provider, auth_type: authType },
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
    await this.relabelOverrides(tenantId, provider, authType, previousLabel, trimmed);
    this.routingCache.invalidateAgent(agentId);
    this.routingCache.invalidateTenant(tenantId);
    return target;
  }

  async reorderKeys(
    agentId: string,
    tenantId: string,
    provider: string,
    authType: AuthType,
    orderedLabels: string[],
  ): Promise<TenantProvider[]> {
    const allRows = await this.providerRepo.find({
      where: { tenant_id: tenantId, provider, auth_type: authType },
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
    const updated: TenantProvider[] = [];
    for (let i = 0; i < orderedLabels.length; i++) {
      const row = byLabel.get(orderedLabels[i].toLowerCase())!;
      row.priority = i;
      row.updated_at = now;
      updated.push(row);
    }
    await this.providerRepo.save(updated);
    this.routingCache.invalidateAgent(agentId);
    this.routingCache.invalidateTenant(tenantId);
    return updated;
  }

  private async resolveProviderRegion(
    provider: string,
    authType: AuthType,
    requestedRegion: string | undefined,
    apiKey: string | undefined,
    existing: TenantProvider | null,
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
    existing: TenantProvider | null,
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
    existing: TenantProvider | null,
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
    tenantId: string,
    provider: string,
    createdByUserId?: string | null,
  ): Promise<{ isNew: boolean }> {
    if (!isSupportedSubscriptionProvider(provider)) {
      this.logger.debug(`Ignoring unsupported subscription provider registration for ${provider}`);
      return { isNew: false };
    }

    const existing = await this.providerRepo.findOne({
      where: { tenant_id: tenantId, provider, auth_type: 'subscription' },
    });

    if (existing) {
      // Deliberately do NOT reactivate an inactive row here. Unlike the
      // user-driven upsert paths (an explicit reconnect via the providers UI),
      // this entry point is the agent's automatic capability re-registration.
      // A subscription the user explicitly removed (is_active = false) must stay
      // removed until the user re-adds it — otherwise a background agent report
      // would silently resurrect it. We still re-grant the calling agent access
      // so an active row stays usable; for an inactive row that grant is inert.
      await this.afterProviderChange(agentId, tenantId, existing.id);
      return { isNew: false };
    }
    const hasApiKey = await this.providerRepo.findOne({
      where: { tenant_id: tenantId, provider, auth_type: 'api_key', is_active: true },
    });
    if (hasApiKey) return { isNew: false };

    const record: TenantProvider = Object.assign(new TenantProvider(), {
      id: randomUUID(),
      tenant_id: tenantId,
      created_by_user_id: createdByUserId ?? null,
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
    // A brand-new subscription provider is global + ON by default: enable it for
    // every agent the tenant owns, without changing model routes.
    await this.enableProviderForAllAgents(tenantId, record.id);
    return { isNew: true };
  }

  private async afterProviderChange(
    agentId: string | null,
    tenantId: string,
    userProviderId?: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (agentId === null) {
      await this.recalculateTiersForTenant(tenantId);
    } else {
      if (userProviderId) await this.enableProviderForAgent(agentId, userProviderId, manager);
      this.routingCache.invalidateAgent(agentId);
    }
    this.routingCache.invalidateTenant(tenantId);
  }

  /**
   * Flip `auth_type` on an existing `tenant_providers` row in-place without
   * deactivating it or cleaning up tier overrides. Used by custom-provider
   * renames that cross the local ↔ api_key boundary (LM Studio ↔ freeform
   * name), where going through removeProvider+upsertProvider would churn
   * tier assignments for what is visually just a name change.
   */
  async retagAuthType(
    agentId: string | null,
    tenantId: string,
    provider: string,
    nextAuthType: AuthType,
  ): Promise<void> {
    // Wrap the dedupe + flip in a transaction so a crash between the
    // collision DELETE and the retag SAVE can't leave the row set in a
    // half-updated state (losing the collision row while the source still
    // carries the old auth_type).
    const invalidated = await this.providerRepo.manager.transaction(async (manager) => {
      const txRepo = manager.getRepository(TenantProvider);
      const rows = await txRepo.find({ where: { tenant_id: tenantId, provider } });
      const target = rows.find((r) => r.auth_type !== nextAuthType && r.is_active);
      if (!target) return false;

      // Protect the unique index on (tenant_id, provider, auth_type, LOWER(label)):
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
      this.routingCache.invalidateTenant(tenantId);
    }
  }

  async removeProvider(
    agentId: string | null,
    tenantId: string,
    provider: string,
    authType?: AuthType,
    label?: string,
    manager?: EntityManager,
  ): Promise<{ notifications: string[] }> {
    if (label) {
      // Labeled key chains only exist for agent-scoped standard providers;
      // tenant-global custom providers never pass a label, so agentId is set.
      return this.removeKeyByLabel(agentId as string, tenantId, provider, authType, label, manager);
    }

    // Legacy disconnect: deactivate every active key for the (provider,
    // [auth_type]) tuple. Route rows are user-controlled, so disconnect is
    // blocked until all routes pointing at the target provider/key are removed
    // explicitly through the routing UI.
    const repo = this.tenantProviderRepo(manager);
    const where: FindOptionsWhere<TenantProvider> = {
      tenant_id: tenantId,
      provider,
      is_active: true,
    };
    if (authType) where.auth_type = authType;
    const activeRows = await repo.find({ where });
    let affectedRows = activeRows;

    if (activeRows.length === 0) {
      const fallbackWhere: FindOptionsWhere<TenantProvider> = { tenant_id: tenantId, provider };
      if (authType) fallbackWhere.auth_type = authType;
      const any = await repo.findOne({ where: fallbackWhere });
      if (!any) throw new NotFoundException('Provider not found');
      affectedRows = [any];
    } else {
      await this.assertProviderRoutesNotUsed(tenantId, activeRows);
      const now = new Date().toISOString();
      for (const row of activeRows) {
        row.is_active = false;
        row.updated_at = now;
      }
      await repo.save(activeRows);
    }
    await this.deleteProviderAccess(
      affectedRows.map((row) => row.id),
      manager,
    );

    const targetAgentIds = await this.listOwnedAgentIds(tenantId);
    for (const target of targetAgentIds) {
      this.routingCache.invalidateAgent(target);
    }
    if (agentId !== null) this.routingCache.invalidateAgent(agentId);
    this.routingCache.invalidateTenant(tenantId);

    return { notifications: [] };
  }

  /** Resolve the ids of every non-deleted agent the tenant owns. */
  async listOwnedAgentIds(tenantId: string): Promise<string[]> {
    return (await this.listOwnedAgentRouteTargets(tenantId)).map((agent) => agent.id);
  }

  private async listOwnedAgentRouteTargets(tenantId: string): Promise<OwnedAgentRouteTarget[]> {
    const agents = await this.agentRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.deleted_at IS NULL')
      .select(['a.id AS id', 'a.name AS name', 'a.display_name AS display_name'])
      .getRawMany<{ id: string; name: string | null; display_name: string | null }>();
    return agents.map((agent) => {
      const displayName = agent.display_name?.trim();
      const name = agent.name?.trim();
      return {
        id: agent.id,
        name: displayName || name || agent.id,
      };
    });
  }

  private async assertProviderRoutesNotUsed(
    tenantId: string,
    providerRows: TenantProvider[],
  ): Promise<void> {
    if (providerRows.length === 0) return;

    const first = await this.findFirstProviderRouteReference(tenantId, providerRows);
    if (!first) return;

    throw new ConflictException(
      `Cannot disconnect provider while its models are assigned to routing. ` +
        `Update routing first (agent "${first.agentName}", ${first.surface} ${first.name}, ` +
        `${first.position}: ${first.model}).`,
    );
  }

  private async findFirstProviderRouteReference(
    tenantId: string,
    providerRows: TenantProvider[],
  ): Promise<ProviderRouteReference | null> {
    const agents = await this.listOwnedAgentRouteTargets(tenantId);
    if (agents.length === 0) return null;

    const agentIds = agents.map((agent) => agent.id);
    const agentNamesById = new Map(agents.map((agent) => [agent.id, agent.name]));
    const enabledIdsByAgent = await this.listEnabledProviderIdsByAgent(agentIds);
    const providerRowsForAgent = (agentId: string) => {
      if (!enabledIdsByAgent) return providerRows;
      const enabled = enabledIdsByAgent.get(agentId);
      if (!enabled || enabled.size === 0) return [];
      return providerRows.filter((row) => enabled.has(row.id));
    };
    const agentName = (agentId: string) => agentNamesById.get(agentId) ?? agentId;

    const tiers = await this.tierRepo.find({ where: { agent_id: In(agentIds) } });
    for (const tier of tiers) {
      const match = this.findProviderRouteReferenceInRoutes(
        tier.agent_id,
        agentName(tier.agent_id),
        'tier',
        tier.tier,
        tier.override_route,
        tier.fallback_routes,
        providerRowsForAgent(tier.agent_id),
      );
      if (match) return match;
    }

    const specificityRows = await this.specificityRepo.find({
      where: { agent_id: In(agentIds), is_active: true },
    });
    for (const row of specificityRows) {
      if (row.is_active === false) continue;
      const match = this.findProviderRouteReferenceInRoutes(
        row.agent_id,
        agentName(row.agent_id),
        'specificity',
        row.category,
        row.override_route,
        row.fallback_routes,
        providerRowsForAgent(row.agent_id),
      );
      if (match) return match;
    }

    const headerTiers = await this.headerTierRepo.find({
      where: { agent_id: In(agentIds), enabled: true },
    });
    for (const tier of headerTiers) {
      if (tier.enabled === false) continue;
      const match = this.findProviderRouteReferenceInRoutes(
        tier.agent_id,
        agentName(tier.agent_id),
        'header',
        tier.name,
        tier.override_route,
        tier.fallback_routes,
        providerRowsForAgent(tier.agent_id),
      );
      if (match) return match;
    }

    return null;
  }

  private async listEnabledProviderIdsByAgent(
    agentIds: string[],
  ): Promise<Map<string, Set<string>> | null> {
    if (!this.enabledProviderRepo) return null;
    const rows = await this.enabledProviderRepo.find({ where: { agent_id: In(agentIds) } });
    const byAgent = new Map<string, Set<string>>();
    for (const row of rows) {
      const enabled = byAgent.get(row.agent_id) ?? new Set<string>();
      enabled.add(row.tenant_provider_id);
      byAgent.set(row.agent_id, enabled);
    }
    return byAgent;
  }

  private findProviderRouteReferenceInRoutes(
    agentId: string,
    agentName: string,
    surface: ProviderRouteReference['surface'],
    name: string,
    overrideRoute: ModelRoute | null,
    fallbackRoutes: ModelRoute[] | null,
    providerRows: TenantProvider[],
  ): ProviderRouteReference | null {
    if (providerRows.length === 0) return null;
    if (this.routeBelongsToProviderRows(overrideRoute, providerRows)) {
      return {
        agentId,
        agentName,
        surface,
        name,
        model: overrideRoute!.model,
        position: 'primary',
      };
    }

    for (const [i, fallback] of (fallbackRoutes ?? []).entries()) {
      if (!this.routeBelongsToProviderRows(fallback, providerRows)) continue;
      return {
        agentId,
        agentName,
        surface,
        name,
        model: fallback.model,
        position: `fallback ${i + 1}`,
      };
    }
    return null;
  }

  private routeBelongsToProviderRows(route: ModelRoute | null, rows: TenantProvider[]): boolean {
    if (!route) return false;
    return rows.some((row) => this.routeBelongsToProviderRow(route, row));
  }

  private routeBelongsToProviderRow(route: ModelRoute, row: TenantProvider): boolean {
    const providerName = row.provider.toLowerCase();
    const rowLabel = (row.label ?? DEFAULT_LABEL).toLowerCase();
    const routeProvider = route.provider?.toLowerCase();

    if (routeProvider) {
      if (routeProvider !== providerName) return false;
      if (route.authType && route.authType !== row.auth_type) return false;

      const routeLabel = route.keyLabel?.toLowerCase();
      if (routeLabel) return routeLabel === rowLabel;
      return row.priority === 0;
    }

    if (route.authType && route.authType !== row.auth_type) return false;
    const routeLabel = route.keyLabel?.toLowerCase();
    if (routeLabel) return routeLabel === rowLabel;
    if (row.priority !== 0) return false;

    const model = route.model.toLowerCase();
    if (model.startsWith(`${providerName}/`)) return true;
    if (
      Array.isArray(row.cached_models) &&
      row.cached_models.some((cached) => cached.id.toLowerCase() === model)
    ) {
      return true;
    }
    const pricing = this.pricingCache.getByModel(route.model)?.provider.toLowerCase();
    return pricing === providerName;
  }

  /**
   * Delete a single labeled key from a provider's chain. If it was the last
   * key for the (agent, provider, auth_type) tuple, falls through to the
   * existing whole-provider teardown. Routes pinned to this key block deletion.
   */
  private async removeKeyByLabel(
    agentId: string,
    tenantId: string,
    provider: string,
    authType: AuthType | undefined,
    label: string,
    manager?: EntityManager,
  ): Promise<{ notifications: string[] }> {
    const repo = this.tenantProviderRepo(manager);
    const where: FindOptionsWhere<TenantProvider> = { tenant_id: tenantId, provider };
    if (authType) where.auth_type = authType;
    const matching = await repo.find({ where });
    if (matching.length === 0) throw new NotFoundException('Provider not found');

    const target = matching.find((r) => r.label.toLowerCase() === label.toLowerCase());
    if (!target) throw new NotFoundException('Provider key not found');

    const stillHasOtherKeys = matching.some(
      (r) => r.id !== target.id && r.is_active && isManifestUsableProvider(r),
    );

    if (!stillHasOtherKeys) {
      // Last key — delegate to the no-label path. We pass authType through so
      // the lookup matches what we just deleted.
      return this.removeProvider(agentId, tenantId, provider, target.auth_type, undefined, manager);
    }

    await this.assertProviderRoutesNotUsed(tenantId, [target]);
    await repo.remove(target);
    await this.deleteProviderAccess([target.id], manager);
    await this.renumberPriorities(tenantId, provider, target.auth_type, manager);
    this.routingCache.invalidateAgent(agentId);
    this.routingCache.invalidateTenant(tenantId);
    return { notifications: [] };
  }

  async deactivateAllProviders(agentId: string, tenantId: string): Promise<void> {
    const activeProviders = await this.providerRepo.find({
      where: { tenant_id: tenantId, is_active: true },
    });
    await this.assertProviderRoutesNotUsed(tenantId, activeProviders);

    await this.providerRepo.update(
      { tenant_id: tenantId },
      { is_active: false, updated_at: new Date().toISOString() },
    );
    await this.deleteProviderAccess(activeProviders.map((provider) => provider.id));
    // The deactivation is tenant-wide, so every owned agent's routing cache is
    // stale — not just the agent whose page triggered it.
    for (const ownedAgentId of await this.listOwnedAgentIds(tenantId)) {
      this.routingCache.invalidateAgent(ownedAgentId);
    }
    this.routingCache.invalidateAgent(agentId);
    this.routingCache.invalidateTenant(tenantId);
  }

  private async cleanupUnsupportedSubscriptionProviders(tenantId: string): Promise<void> {
    const activeProviders = await this.providerRepo.find({
      where: { tenant_id: tenantId, is_active: true },
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
      // With tenant-level providers, we need to clean up tiers across ALL agents
      // that reference these providers. For now, the provider is deactivated
      // and tier references will be cleaned up lazily on the next routing
      // resolution attempt.
      this.logger.debug(
        `Deactivated unsupported subscription providers for tenant=${tenantId}: ${removedProviders.join(', ')}`,
      );
    }
    this.routingCache.invalidateTenant(tenantId);
  }

  /**
   * Update tier_assignments and specificity_assignments rows that reference a
   * specific provider key by label. Pass `nextLabel = null` to clear the
   * binding (used when the key is deleted — the assignment then resolves to
   * the new primary key).
   */
  private async relabelOverrides(
    tenantId: string,
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

    // Keys are tenant-global: a rename must rewrite pinned routes on every
    // agent the tenant owns, not just the one whose page triggered it. Stale
    // labels make the proxy silently fall back to the first key by priority.
    const mutatedAgentIds = new Set<string>();
    const ownedAgentIds = await this.listOwnedAgentIds(tenantId);
    if (ownedAgentIds.length === 0) return;
    const tiers = await this.tierRepo.find({ where: { agent_id: In(ownedAgentIds) } });
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
        mutatedAgentIds.add(t.agent_id);
      }
    }
    if (tiersToSave.length > 0) await this.tierRepo.save(tiersToSave);

    // Specificity rows carry the same shape — relabel both override_route and
    // fallback_routes. Cubic flagged P2: skipping specificity fallbacks left
    // stale key-label pins behind, which then misrouted next time the
    // specificity rule fired.
    const specs = await this.specificityRepo.find({ where: { agent_id: In(ownedAgentIds) } });
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
        mutatedAgentIds.add(s.agent_id);
      }
    }
    if (specsToSave.length > 0) await this.specificityRepo.save(specsToSave);

    // Custom (header) tiers carry the same ModelRoute shape. They were
    // omitted here originally, so disconnecting one account out of several
    // (or renaming a key) left header-tier routes pinned to a label that no
    // longer exists — the account chip then renders blank. Relabel them too.
    const headerTiers = await this.headerTierRepo.find({ where: { tenant_id: tenantId } });
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
        mutatedAgentIds.add(h.agent_id);
      }
    }
    if (headerTiersToSave.length > 0) await this.headerTierRepo.save(headerTiersToSave);

    // invalidateTenant() doesn't clear per-agent tier caches, so flush every
    // agent whose rows were rewritten or stale routes would keep serving.
    for (const id of mutatedAgentIds) this.routingCache.invalidateAgent(id);
  }

  private async renumberPriorities(
    tenantId: string,
    provider: string,
    authType: AuthType,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.tenantProviderRepo(manager);
    const allRows = await repo.find({
      where: { tenant_id: tenantId, provider, auth_type: authType },
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
    if (changed) await repo.save(rows);
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

  private nextPriority(existing: TenantProvider[]): number {
    const active = existing.filter((r) => r.is_active);
    if (active.length === 0) return 0;
    return Math.max(...active.map((r) => r.priority)) + 1;
  }

  /**
   * Returns a unique label for a new OAuth key. If no row exists yet for this
   * (user, provider, subscription) tuple, returns undefined so the caller
   * falls through to the legacy single-key upsert (creating "Default"). When
   * a "Default" row already exists, returns "Key 2", "Key 3", etc.
   */
  async nextOAuthLabel(tenantId: string, provider: string): Promise<string | undefined> {
    const existing = await this.providerRepo.find({
      where: {
        tenant_id: tenantId,
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
