import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  getManifestCreditsKeyGenerateUrl,
  getManifestCreditsMasterKey,
  getManifestCreditsMaxBudgetUsd,
  isManifestCreditsAutoEligible,
  MANIFEST_PROVIDER_ID,
} from '../../common/constants/manifest-credits';
import { TenantProvider } from '../../entities/tenant-provider.entity';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { ProviderService } from '../routing-core/provider.service';

export interface ManifestEnsureResult {
  connected: boolean;
  connection_id: string | null;
  source: 'existing' | 'auto' | 'manual' | 'none';
  auto_available: boolean;
}

const MANIFEST_CREDITS_KEY_GENERATE_TIMEOUT_MS = 5_000;

@Injectable()
export class ManifestProviderService {
  private readonly logger = new Logger(ManifestProviderService.name);

  constructor(
    @InjectRepository(TenantProvider)
    private readonly providerRepo: Repository<TenantProvider>,
    private readonly providerService: ProviderService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {}

  async findConnection(tenantId: string): Promise<TenantProvider | null> {
    const rows = await this.providerRepo.find({
      where: {
        tenant_id: tenantId,
        provider: MANIFEST_PROVIDER_ID,
        auth_type: 'api_key',
      },
    });
    return rows.find((row) => row.is_active) ?? rows[0] ?? null;
  }

  /**
   * Ensure the tenant has at most one Manifest Credits connection.
   * - If already connected: return existing.
   * - If `apiKey` provided: store that virtual key (manual / self-host path).
   * - Else if auto-eligible: mint a credit key with the configured budget.
   * - Else: no-op (connected: false).
   */
  async ensureConnection(opts: {
    tenantId: string;
    userId: string | null;
    userEmail: string | null | undefined;
    apiKey?: string;
  }): Promise<ManifestEnsureResult> {
    const { tenantId, userId, userEmail, apiKey } = opts;
    const autoAvailable = isManifestCreditsAutoEligible(userEmail);

    const existing = await this.findConnection(tenantId);
    if (existing?.is_active) {
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

    // An inactive row records an explicit disconnect. Do not silently
    // reactivate it or mint a replacement budgeted key on a later config read.
    if (existing) {
      return {
        connected: false,
        connection_id: null,
        source: 'none',
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
    const existing = await this.findConnection(tenantId);
    if (existing?.is_active) {
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
    const masterKey = getManifestCreditsMasterKey();
    if (!masterKey) {
      throw new BadRequestException('Manifest Credits master key is not configured');
    }

    const maxBudget = getManifestCreditsMaxBudgetUsd();
    // No model allowlist: the key inherits the gateway's available catalog.
    const body = {
      max_budget: maxBudget,
      key_alias: `manifest:${tenantId}`,
      metadata: {
        source: 'manifest',
        tenant_id: tenantId,
        user_email: userEmail ?? null,
      },
    };

    let res: Response;
    try {
      res = await fetch(getManifestCreditsKeyGenerateUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${masterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(MANIFEST_CREDITS_KEY_GENERATE_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.error(
        `Manifest Credits /key/generate request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Failed to create Manifest Credits key');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(
        `Manifest Credits /key/generate failed (${res.status}): ${text.slice(0, 300)}`,
      );
      throw new BadRequestException('Failed to create Manifest Credits key');
    }

    const json = (await res.json()) as { key?: string; token?: string };
    const key = json.key ?? json.token;
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Manifest Credits did not return a key');
    }
    return key;
  }
}
