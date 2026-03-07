import { Injectable } from '@nestjs/common';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';

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
  if (map.size >= MAX_ENTRIES) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
  map.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

@Injectable()
export class RoutingCacheService {
  private readonly tiers = new Map<string, CachedEntry<TierAssignment[]>>();
  private readonly providers = new Map<string, CachedEntry<UserProvider[]>>();
  private readonly apiKeys = new Map<string, CachedEntry<string | null>>();

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

  getApiKey(agentId: string, provider: string): string | null | undefined {
    const key = `${agentId}:${provider}`;
    const cached = this.apiKeys.get(key);
    if (!cached) return undefined;
    if (cached.expiresAt > Date.now()) return cached.data;
    this.apiKeys.delete(key);
    return undefined;
  }

  setApiKey(agentId: string, provider: string, apiKey: string | null): void {
    setWithEviction(this.apiKeys, `${agentId}:${provider}`, apiKey);
  }

  invalidateAgent(agentId: string): void {
    this.tiers.delete(agentId);
    this.providers.delete(agentId);
    const prefix = `${agentId}:`;
    const toDelete = [...this.apiKeys.keys()].filter((k) => k.startsWith(prefix));
    for (const k of toDelete) this.apiKeys.delete(k);
  }
}
