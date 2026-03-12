import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';

const TTL_MS = 300_000; // 5 minutes
const MAX_ENTRIES = 5_000;

interface CachedTenant {
  tenantId: string;
  expiresAt: number;
}

@Injectable()
export class TenantCacheService {
  private readonly cache = new Map<string, CachedTenant>();

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async resolve(userId: string): Promise<string | null> {
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenantId;
    }
    if (cached) this.cache.delete(userId);

    const tenant = await this.tenantRepo.findOne({ where: { name: userId } });
    if (!tenant) return null;

    if (this.cache.size >= MAX_ENTRIES && !this.cache.has(userId)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }

    this.cache.set(userId, {
      tenantId: tenant.id,
      expiresAt: Date.now() + TTL_MS,
    });

    return tenant.id;
  }
}
