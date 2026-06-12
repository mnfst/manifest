import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Tenant } from '../../entities/tenant.entity';
import { TtlFifoCache } from '../utils/ttl-fifo-cache';

/**
 * The ONE place user→tenant resolution happens. Everything downstream is
 * scoped by tenantId; a future team plan only has to swap the lookup here
 * (owner_user_id → membership table) and nothing else moves.
 */
@Injectable()
export class TenantCacheService {
  private readonly cache = new TtlFifoCache<string, string | null>({
    maxEntries: 5_000,
    ttlMs: 300_000,
  });

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async resolve(userId: string): Promise<string | null> {
    return this.cache.resolve(userId, async (uid) => {
      const tenant = await this.tenantRepo.findOne({ where: { owner_user_id: uid } });
      return tenant?.id ?? null;
    });
  }

  /**
   * Resolve the user's tenant, creating it when missing. Used by mutation
   * paths that must work before the first agent exists (playground, custom
   * providers). Insert races resolve to the surviving row.
   */
  async ensureForUser(userId: string): Promise<string> {
    const existing = await this.resolve(userId);
    if (existing) return existing;

    const id = randomUUID();
    try {
      await this.tenantRepo.insert({ id, name: userId, owner_user_id: userId, is_active: true });
      this.cache.invalidate(userId);
      return id;
    } catch {
      // Unique index on owner_user_id: a concurrent request created it first.
      this.cache.invalidate(userId);
      const raced = await this.tenantRepo.findOne({ where: { owner_user_id: userId } });
      if (!raced) throw new Error(`Failed to create tenant for user ${userId}`);
      return raced.id;
    }
  }

  /** Remove a cached entry so the next resolve() re-hits the DB. */
  invalidate(userId: string): void {
    this.cache.invalidate(userId);
  }
}
