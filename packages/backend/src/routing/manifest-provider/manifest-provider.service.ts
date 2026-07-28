import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  getLitellmKeyGenerateUrl,
  getLitellmMasterKey,
  getLitellmMaxBudgetUsd,
  isLitellmAutoEligible,
  MANIFEST_PROVIDER_ID,
} from '../../common/constants/litellm';
import { TenantProvider } from '../../entities/tenant-provider.entity';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { ProviderService } from '../routing-core/provider.service';

export interface ManifestEnsureResult {
  connected: boolean;
  connection_id: string | null;
  source: 'existing' | 'auto' | 'manual' | 'none';
  auto_available: boolean;
}

@Injectable()
export class ManifestProviderService {
  private readonly logger = new Logger(ManifestProviderService.name);

  constructor(
    @InjectRepository(TenantProvider)
    private readonly providerRepo: Repository<TenantProvider>,
    private readonly providerService: ProviderService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {}

  async findActiveConnection(tenantId: string): Promise<TenantProvider | null> {
    const rows = await this.providerRepo.find({
      where: {
        tenant_id: tenantId,
        provider: MANIFEST_PROVIDER_ID,
        auth_type: 'api_key',
        is_active: true,
      },
    });
    return rows[0] ?? null;
  }

  /**
   * Ensure the tenant has at most one Manifest (LiteLLM) connection.
   * - If already connected: return existing.
   * - If `apiKey` provided: store that virtual key (manual / self-host path).
   * - Else if auto-eligible: mint a LiteLLM virtual key with max budget.
   * - Else: no-op (connected: false).
   */
  async ensureConnection(opts: {
    tenantId: string;
    userId: string | null;
    userEmail: string | null | undefined;
    apiKey?: string;
  }): Promise<ManifestEnsureResult> {
    const { tenantId, userId, userEmail, apiKey } = opts;
    const autoAvailable = isLitellmAutoEligible(userEmail);

    const existing = await this.findActiveConnection(tenantId);
    if (existing) {
      return {
        connected: true,
        connection_id: existing.id,
        source: 'existing',
        auto_available: autoAvailable,
      };
    }

    const trimmedKey = apiKey?.trim();
    if (trimmedKey) {
      const row = await this.persistKey(tenantId, userId, trimmedKey);
      return {
        connected: true,
        connection_id: row.id,
        source: 'manual',
        auto_available: autoAvailable,
      };
    }

    if (!autoAvailable) {
      return {
        connected: false,
        connection_id: null,
        source: 'none',
        auto_available: false,
      };
    }

    const minted = await this.mintVirtualKey(tenantId, userEmail);
    const row = await this.persistKey(tenantId, userId, minted);
    return {
      connected: true,
      connection_id: row.id,
      source: 'auto',
      auto_available: true,
    };
  }

  private async persistKey(
    tenantId: string,
    userId: string | null,
    apiKey: string,
  ): Promise<TenantProvider> {
    // Second check under write path — reject multi-connection for this provider.
    const existing = await this.findActiveConnection(tenantId);
    if (existing) {
      throw new BadRequestException('Manifest already has a connection for this workspace');
    }

    const { provider } = await this.providerService.upsertProvider(
      null,
      tenantId,
      MANIFEST_PROVIDER_ID,
      apiKey,
      'api_key',
      undefined,
      undefined,
      userId,
    );

    try {
      await this.discoveryService.discoverModels(provider);
    } catch (err) {
      this.logger.warn(
        `Manifest model discovery failed after connect: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return provider;
  }

  private async mintVirtualKey(
    tenantId: string,
    userEmail: string | null | undefined,
  ): Promise<string> {
    const masterKey = getLitellmMasterKey();
    if (!masterKey) {
      throw new BadRequestException('LiteLLM master key is not configured');
    }

    const maxBudget = getLitellmMaxBudgetUsd();
    // No model allowlist: catalog is whatever LiteLLM exposes for this key.
    const body = {
      max_budget: maxBudget,
      key_alias: `manifest:${tenantId}`,
      metadata: {
        source: 'manifest',
        tenant_id: tenantId,
        user_email: userEmail ?? null,
      },
    };

    const res = await fetch(getLitellmKeyGenerateUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${masterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`LiteLLM /key/generate failed (${res.status}): ${text.slice(0, 300)}`);
      throw new BadRequestException('Failed to create LiteLLM virtual key');
    }

    const json = (await res.json()) as { key?: string; token?: string };
    const key = json.key ?? json.token;
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('LiteLLM did not return a virtual key');
    }
    return key;
  }
}
