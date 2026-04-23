import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TtlFifoCache } from '../utils/ttl-fifo-cache';

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
      const tenant = await this.tenantRepo.findOne({ where: { name: uid } });
      return tenant?.id ?? null;
    });
  }
}
