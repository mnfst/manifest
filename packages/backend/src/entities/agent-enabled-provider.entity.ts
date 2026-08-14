import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Agent } from './agent.entity';
import { TenantProvider } from './tenant-provider.entity';

@Entity('agent_enabled_providers')
export class AgentEnabledProvider {
  @PrimaryColumn('varchar')
  agent_id!: string;

  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;

  @PrimaryColumn('varchar')
  tenant_provider_id!: string;

  @ManyToOne(() => TenantProvider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_provider_id' })
  tenantProvider!: TenantProvider;
}
