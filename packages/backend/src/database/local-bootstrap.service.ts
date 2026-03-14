import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { ModelPricing } from '../entities/model-pricing.entity';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { hashKey, keyPrefix } from '../common/utils/hash.util';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { PricingSyncService } from './pricing-sync.service';
import { SEED_MODELS } from './seed-models';
import {
  LOCAL_USER_ID,
  LOCAL_EMAIL,
  LOCAL_TENANT_ID,
  LOCAL_AGENT_ID,
  LOCAL_AGENT_NAME,
} from '../common/constants/local-mode.constants';
import { trackEvent } from '../common/utils/product-telemetry';
import { seedAgentMessages } from './seed-messages';

@Injectable()
export class LocalBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(LocalBootstrapService.name);

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    @InjectRepository(AgentApiKey) private readonly agentKeyRepo: Repository<AgentApiKey>,
    @InjectRepository(AgentMessage) private readonly messageRepo: Repository<AgentMessage>,
    @InjectRepository(ModelPricing) private readonly pricingRepo: Repository<ModelPricing>,
    @InjectRepository(UserProvider) private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(TierAssignment) private readonly tierRepo: Repository<TierAssignment>,
    private readonly pricingCache: ModelPricingCacheService,
    private readonly pricingSync: PricingSyncService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    await this.seedModelPricing();
    await this.ensureTenantAndAgent();
    await this.fixupRoutingAgentIds();
    await this.recalculateTiersIfNeeded();
    await seedAgentMessages(this.messageRepo, LOCAL_USER_ID, this.logger, {
      tenantId: LOCAL_TENANT_ID,
      agentId: LOCAL_AGENT_ID,
      agentName: LOCAL_AGENT_NAME,
    });
    this.logger.log('Local mode bootstrap complete');

    // Fetch fresh prices from OpenRouter in the background,
    // purge non-curated models, then recalculate tiers.
    this.pricingSync
      .syncPricing()
      .then(() => this.purgeNonCuratedModels())
      .then(() => this.pricingCache.reload())
      .then(() => this.recalculateTiersIfNeeded())
      .catch((err) => {
        this.logger.warn(`Background pricing sync failed: ${err}`);
      });
  }

  private async ensureTenantAndAgent() {
    const count = await this.tenantRepo.count({ where: { id: LOCAL_TENANT_ID } });
    if (count === 0) {
      await this.tenantRepo.insert({
        id: LOCAL_TENANT_ID,
        name: LOCAL_USER_ID,
        organization_name: 'Local',
        email: LOCAL_EMAIL,
        is_active: true,
      });

      await this.agentRepo.insert({
        id: LOCAL_AGENT_ID,
        name: LOCAL_AGENT_NAME,
        description: 'Default local agent',
        is_active: true,
        tenant_id: LOCAL_TENANT_ID,
      });
      trackEvent('agent_created', { agent_name: LOCAL_AGENT_NAME });

      this.logger.log(`Created tenant/agent for local mode`);
    }

    // Always reconcile the API key — it may have been regenerated
    // since the tenant was first created.
    const apiKey = this.readApiKeyFromConfig();
    if (apiKey) {
      await this.registerApiKey(apiKey);
    }
  }

  private readApiKeyFromConfig(): string | null {
    try {
      const configPath = join(homedir(), '.openclaw', 'manifest', 'config.json');
      if (!existsSync(configPath)) return null;
      const data = JSON.parse(readFileSync(configPath, 'utf-8'));
      return typeof data.apiKey === 'string' ? data.apiKey : null;
    } catch {
      return null;
    }
  }

  private async registerApiKey(apiKey: string) {
    const hash = hashKey(apiKey);
    const existing = await this.agentKeyRepo.count({ where: { key_hash: hash } });
    if (existing > 0) return;

    await this.agentKeyRepo.upsert(
      {
        id: 'local-otlp-key-001',
        key: null,
        key_hash: hash,
        key_prefix: keyPrefix(apiKey),
        label: 'Local OTLP ingest key',
        tenant_id: LOCAL_TENANT_ID,
        agent_id: LOCAL_AGENT_ID,
        is_active: true,
      },
      ['id'],
    );
  }

  private async fixupRoutingAgentIds() {
    // Fix routing rows missing agent_id (from pre-migration SQLite DBs).
    // SQLite uses synchronize:true so the column is added automatically but
    // existing rows will have NULL agent_id.
    const orphanedProviders = await this.providerRepo.find({
      where: { agent_id: IsNull() as unknown as string },
    });
    for (const row of orphanedProviders) {
      row.agent_id = LOCAL_AGENT_ID;
      await this.providerRepo.save(row);
    }

    const orphanedTiers = await this.tierRepo.find({
      where: { agent_id: IsNull() as unknown as string },
    });
    for (const row of orphanedTiers) {
      row.agent_id = LOCAL_AGENT_ID;
      await this.tierRepo.save(row);
    }

    if (orphanedProviders.length > 0 || orphanedTiers.length > 0) {
      this.logger.log(
        `Fixed ${orphanedProviders.length} provider(s) and ${orphanedTiers.length} tier(s) with missing agent_id`,
      );
    }
  }

  private async seedModelPricing() {
    for (const [
      name,
      provider,
      inputPrice,
      outputPrice,
      ctxWindow,
      reasoning,
      code,
      displayName,
    ] of SEED_MODELS) {
      await this.pricingRepo.upsert(
        {
          model_name: name,
          provider,
          input_price_per_token: inputPrice,
          output_price_per_token: outputPrice,
          context_window: ctxWindow,
          capability_reasoning: reasoning,
          capability_code: code,
          display_name: displayName,
        },
        ['model_name'],
      );
    }
    await this.pricingCache.reload();
    this.logger.log('Seeded model pricing data');
  }

  private async purgeNonCuratedModels() {
    const curatedNames = new Set(SEED_MODELS.map(([name]) => name));
    const all = await this.pricingRepo.find({ select: ['model_name', 'provider'] });
    const toDelete = all
      .filter(
        (row) =>
          !curatedNames.has(row.model_name) &&
          row.provider !== 'Ollama' &&
          row.provider !== 'OpenRouter' &&
          !row.model_name.startsWith('custom:'),
      )
      .map((row) => row.model_name);

    if (toDelete.length > 0) {
      await this.pricingRepo.delete({ model_name: In(toDelete) });
      this.logger.log(`Purged ${toDelete.length} non-curated models`);
    }
  }

  private async recalculateTiersIfNeeded() {
    const activeProviders = await this.providerRepo.count({
      where: { agent_id: LOCAL_AGENT_ID, is_active: true },
    });
    if (activeProviders === 0) return;

    try {
      const { TierAutoAssignService } = await import('../routing/tier-auto-assign.service');
      const autoAssign = this.moduleRef.get(TierAutoAssignService, { strict: false });
      await autoAssign.recalculate(LOCAL_AGENT_ID);
      this.logger.log('Recalculated tier assignments on startup');
    } catch (err) {
      this.logger.warn(`Failed to recalculate tiers: ${err}`);
    }
  }
}
