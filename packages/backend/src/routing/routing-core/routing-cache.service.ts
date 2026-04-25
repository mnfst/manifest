import { Injectable } from '@nestjs/common';
import { UserProvider } from '../../entities/user-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';
import { HeaderTier } from '../../entities/header-tier.entity';

const TTL_MS = 120_000; // 2 minutes
const MAX_ENTRIES = 5_000;

interface CachedEntry<T> {
  data: T;
  expiresAt: number;
}

function getOrExpire<T>(map: Map<string, CachedEntry<T>>, key: string): T | undefined {
  const cached = map.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt > Date.now()) return cached.data;
  map.delete(key);
  return undefined;
}

function setWithEviction<T>(map: Map<string, CachedEntry<T>>, key: string, data: T): void {
  if (map.size >= MAX_ENTRIES && !map.has(key)) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
  map.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

@Injectable()
export class RoutingCacheService {
  private readonly tiers = new Map<string, CachedEntry<TierAssignment[]>>();
  private readonly providers = new Map<string, CachedEntry<UserProvider[]>>();
  private readonly customProviders = new Map<string, CachedEntry<CustomProvider[]>>();
  private readonly apiKeys = new Map<string, CachedEntry<string | null>>();
  private readonly specificity = new Map<string, CachedEntry<SpecificityAssignment[]>>();
  private readonly headerTiers = new Map<string, CachedEntry<HeaderTier[]>>();

  getTiers(agentId: string): TierAssignment[] | null {
    return getOrExpire(this.tiers, agentId) ?? null;
  }

  setTiers(agentId: string, data: TierAssignment[]): void {
    setWithEviction(this.tiers, agentId, data);
  }

  getProviders(agentId: string): UserProvider[] | null {
    return getOrExpire(this.providers, agentId) ?? null;
  }

  setProviders(agentId: string, data: UserProvider[]): void {
    setWithEviction(this.providers, agentId, data);
  }

  getCustomProviders(agentId: string): CustomProvider[] | null {
    return getOrExpire(this.customProviders, agentId) ?? null;
  }

  setCustomProviders(agentId: string, data: CustomProvider[]): void {
    setWithEviction(this.customProviders, agentId, data);
  }

  getApiKey(agentId: string, provider: string, authType?: string): string | null | undefined {
    return getOrExpire(this.apiKeys, `${agentId}:${provider}:${authType ?? 'default'}`);
  }

  setApiKey(agentId: string, provider: string, apiKey: string | null, authType?: string): void {
    setWithEviction(this.apiKeys, `${agentId}:${provider}:${authType ?? 'default'}`, apiKey);
  }

  getSpecificity(agentId: string): SpecificityAssignment[] | null {
    return getOrExpire(this.specificity, agentId) ?? null;
  }

  setSpecificity(agentId: string, data: SpecificityAssignment[]): void {
    setWithEviction(this.specificity, agentId, data);
  }

  getHeaderTiers(agentId: string): HeaderTier[] | null {
    return getOrExpire(this.headerTiers, agentId) ?? null;
  }

  setHeaderTiers(agentId: string, data: HeaderTier[]): void {
    setWithEviction(this.headerTiers, agentId, data);
  }

  invalidateAgent(agentId: string): void {
    this.tiers.delete(agentId);
    this.providers.delete(agentId);
    this.customProviders.delete(agentId);
    this.specificity.delete(agentId);
    this.headerTiers.delete(agentId);
    const prefix = `${agentId}:`;
    const toDelete = [...this.apiKeys.keys()].filter((k) => k.startsWith(prefix));
    for (const k of toDelete) this.apiKeys.delete(k);
  }
}
