import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ApiKey } from '../../entities/api-key.entity';
import { Tenant } from '../../entities/tenant.entity';
import { hashKey, keyPrefix } from '../../common/utils/hash.util';
import { ADMIN_AI_KEY_PREFIX, ADMIN_KEY_SCOPE } from '../../common/constants/admin-key.constants';

/**
 * Mints and resolves AI-admin keys (`mnfst_admin_ai_*`). These are `ApiKey`
 * rows with `scope = 'ai_admin'`, resolved through the existing ApiKeyGuard
 * (so they populate `tenantContext` exactly like owner keys) and further
 * restricted to the `/api/v1/admin` surface by AdminAiGuard.
 *
 * Reuses the same hashing/prefixing primitives as harness keys — only the
 * scope column and prefix differ. It never returns the stored secret after
 * insert except in the immediate create response.
 */
@Injectable()
export class AdminKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  private generateKey(): string {
    return ADMIN_AI_KEY_PREFIX + randomBytes(32).toString('base64url');
  }

  /**
   * Mint a new AI-admin key bound to a tenant. Self-hosted bootstrapping: an
   * operator supplies `tenantId` (or it is resolved from the caller's session
   * tenant context upstream). Tenant must already exist.
   */
  async createAdminKey(params: {
    tenantId: string;
    name?: string;
    createdByUserId?: string | null;
  }): Promise<{ id: string; key: string; keyPrefix: string }> {
    const tenant = await this.tenantRepo.findOne({ where: { id: params.tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${params.tenantId} not found`);

    const rawKey = this.generateKey();
    const id = uuidv4();
    await this.apiKeyRepo.insert({
      id,
      key: rawKey,
      key_hash: hashKey(rawKey),
      key_prefix: keyPrefix(rawKey),
      tenant_id: params.tenantId,
      created_by_user_id: params.createdByUserId ?? null,
      name: params.name ?? `ai-admin-${id.slice(0, 8)}`,
      scope: ADMIN_KEY_SCOPE,
    });

    // Return the raw key exactly once (caller stores it). Subsequent reads
    // return only keyPrefix.
    return { id, key: rawKey, keyPrefix: keyPrefix(rawKey) };
  }

  /** List admin keys for a tenant (prefix + metadata only, never the secret). */
  async listAdminKeys(tenantId: string): Promise<Array<{ id: string; keyPrefix: string; name: string; createdAt: string }>> {
    const rows = await this.apiKeyRepo.find({
      where: { tenant_id: tenantId, scope: ADMIN_KEY_SCOPE },
      select: ['id', 'key_prefix', 'name', 'created_at'],
    });
    return rows.map((r) => ({ id: r.id, keyPrefix: r.key_prefix, name: r.name, createdAt: r.created_at }));
  }

  async revokeAdminKey(tenantId: string, id: string): Promise<void> {
    await this.apiKeyRepo.delete({ id, tenant_id: tenantId, scope: ADMIN_KEY_SCOPE });
  }
}
