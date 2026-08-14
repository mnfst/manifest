import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Tier } from '../../scoring/types';
import type { SpecificityCategory } from 'manifest-shared';

interface MomentumEntry {
  tiers: Tier[];
  categories: SpecificityCategory[];
  lastUpdated: number;
}

const MAX_ENTRIES = 5;
const TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class SessionMomentumService implements OnModuleDestroy {
  private readonly sessions = new Map<string, MomentumEntry>();
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.evictStale(), CLEANUP_INTERVAL_MS);
    if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }

  getRecentTiers(sessionKey: string): Tier[] | undefined {
    const entry = this.readFresh(sessionKey);
    return entry?.tiers;
  }

  getRecentCategories(sessionKey: string): SpecificityCategory[] | undefined {
    const entry = this.readFresh(sessionKey);
    if (!entry || entry.categories.length === 0) return undefined;
    return entry.categories;
  }

  recordTier(sessionKey: string, tier: Tier): void {
    const existing = this.sessions.get(sessionKey);
    if (existing) {
      existing.tiers = [tier, ...existing.tiers].slice(0, MAX_ENTRIES);
      existing.lastUpdated = Date.now();
    } else {
      this.sessions.set(sessionKey, {
        tiers: [tier],
        categories: [],
        lastUpdated: Date.now(),
      });
    }
  }

  recordCategory(sessionKey: string, category: SpecificityCategory): void {
    const existing = this.sessions.get(sessionKey);
    if (existing) {
      existing.categories = [category, ...existing.categories].slice(0, MAX_ENTRIES);
      existing.lastUpdated = Date.now();
    } else {
      this.sessions.set(sessionKey, {
        tiers: [],
        categories: [category],
        lastUpdated: Date.now(),
      });
    }
  }

  private readFresh(sessionKey: string): MomentumEntry | undefined {
    const entry = this.sessions.get(sessionKey);
    if (!entry) return undefined;
    if (Date.now() - entry.lastUpdated > TTL_MS) {
      this.sessions.delete(sessionKey);
      return undefined;
    }
    return entry;
  }

  private evictStale(): void {
    const now = Date.now();
    for (const [key, entry] of this.sessions) {
      if (now - entry.lastUpdated > TTL_MS) {
        this.sessions.delete(key);
      }
    }
  }
}
