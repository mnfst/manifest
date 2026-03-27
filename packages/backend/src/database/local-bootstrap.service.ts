import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { hashKey, keyPrefix } from '../common/utils/hash.util';
import {
  LOCAL_USER_ID,
  LOCAL_EMAIL,
  LOCAL_TENANT_ID,
  LOCAL_AGENT_ID,
  LOCAL_AGENT_NAME,
} from '../common/constants/local-mode.constants';
import { seedAgentMessages } from './seed-messages';

@Injectable()
export class LocalBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(LocalBootstrapService.name);

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    @InjectRepository(AgentApiKey) private readonly agentKeyRepo: Repository<AgentApiKey>,
    @InjectRepository(AgentMessage) private readonly messageRepo: Repository<AgentMessage>,
    @InjectRepository(UserProvider) private readonly providerRepo: Repository<UserProvider>,
    @InjectRepository(TierAssignment) private readonly tierRepo: Repository<TierAssignment>,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    await this.ensureTenantAndAgent();
    await this.fixupRoutingAgentIds();
    await this.recalculateTiersIfNeeded();
    await seedAgentMessages(this.messageRepo, LOCAL_USER_ID, this.logger, {
      tenantId: LOCAL_TENANT_ID,
      agentId: LOCAL_AGENT_ID,
      agentName: LOCAL_AGENT_NAME,
    });
    this.logger.log('Local mode bootstrap complete');

    // Discover models for all active providers in the background
    this.discoverModelsInBackground().catch((err) => {
      this.logger.warn(`Background model discovery failed: ${err}`);
    });
  }

  private async discoverModelsInBackground(): Promise<void> {
    try {
      const { ModelDiscoveryService } = await import('../model-discovery/model-discovery.service');
      const discovery = this.moduleRef.get(ModelDiscoveryService, { strict: false });
      await discovery.discoverAllForAgent(LOCAL_AGENT_ID);
      await this.recalculateTiersIfNeeded();
    } catch (err) {
      this.logger.warn(`Model discovery failed: ${err}`);
    }
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
      this.logger.log(`Created tenant/agent for local mode`);
    }

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

  private async recalculateTiersIfNeeded() {
    const activeProviders = await this.providerRepo.count({
      where: { agent_id: LOCAL_AGENT_ID, is_active: true },
    });
    if (activeProviders === 0) return;

    try {
      const { TierAutoAssignService } =
        await import('../routing/routing-core/tier-auto-assign.service');
      const autoAssign = this.moduleRef.get(TierAutoAssignService, { strict: false });
      await autoAssign.recalculate(LOCAL_AGENT_ID);
      this.logger.log('Recalculated tier assignments on startup');
    } catch (err) {
      this.logger.warn(`Failed to recalculate tiers: ${err}`);
    }
  }
}
