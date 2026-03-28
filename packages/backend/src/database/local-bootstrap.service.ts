import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { AgentMessage } from '../entities/agent-message.entity';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';

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
    await this.fixupRoutingAgentIds();
    await this.recalculateTiersIfNeeded();
    this.logger.log('Local mode bootstrap complete');

    this.discoverModelsInBackground().catch((err) => {
      this.logger.warn(`Background model discovery failed: ${err}`);
    });
  }

  private async discoverModelsInBackground(): Promise<void> {
    const agents = await this.agentRepo.find({ where: { is_active: true } });
    if (agents.length === 0) return;

    try {
      const { ModelDiscoveryService } = await import('../model-discovery/model-discovery.service');
      const discovery = this.moduleRef.get(ModelDiscoveryService, { strict: false });
      for (const agent of agents) {
        await discovery.discoverAllForAgent(agent.id);
      }
      await this.recalculateTiersIfNeeded();
    } catch (err) {
      this.logger.warn(`Model discovery failed: ${err}`);
    }
  }

  private async fixupRoutingAgentIds() {
    const orphanedProviders = await this.providerRepo.find({
      where: { agent_id: IsNull() as unknown as string },
    });
    const firstAgent = await this.agentRepo.findOne({ where: { is_active: true } });
    if (!firstAgent) return;

    for (const row of orphanedProviders) {
      row.agent_id = firstAgent.id;
      await this.providerRepo.save(row);
    }

    const orphanedTiers = await this.tierRepo.find({
      where: { agent_id: IsNull() as unknown as string },
    });
    for (const row of orphanedTiers) {
      row.agent_id = firstAgent.id;
      await this.tierRepo.save(row);
    }

    if (orphanedProviders.length > 0 || orphanedTiers.length > 0) {
      this.logger.log(
        `Fixed ${orphanedProviders.length} provider(s) and ${orphanedTiers.length} tier(s) with missing agent_id`,
      );
    }
  }

  private async recalculateTiersIfNeeded() {
    const firstAgent = await this.agentRepo.findOne({ where: { is_active: true } });
    if (!firstAgent) return;

    const activeProviders = await this.providerRepo.count({
      where: { agent_id: firstAgent.id, is_active: true },
    });
    if (activeProviders === 0) return;

    try {
      const { TierAutoAssignService } =
        await import('../routing/routing-core/tier-auto-assign.service');
      const autoAssign = this.moduleRef.get(TierAutoAssignService, { strict: false });
      await autoAssign.recalculate(firstAgent.id);
      this.logger.log('Recalculated tier assignments on startup');
    } catch (err) {
      this.logger.warn(`Failed to recalculate tiers: ${err}`);
    }
  }
}
