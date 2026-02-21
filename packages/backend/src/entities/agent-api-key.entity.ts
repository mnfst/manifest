import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Agent } from './agent.entity';
import { timestampType, timestampDefault } from '../common/utils/sql-dialect';

@Entity('agent_api_keys')
export class AgentApiKey {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar', { length: 64, nullable: true })
  key!: string | null;

  @Index({ unique: true })
  @Column('varchar', { length: 64 })
  key_hash!: string;

  @Column('varchar', { length: 12 })
  key_prefix!: string;

  @Column('varchar', { nullable: true })
  label!: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column('varchar')
  tenant_id!: string;

  @OneToOne(() => Agent, (a) => a.apiKey, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;

  @Column('varchar')
  agent_id!: string;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @Column(timestampType(), { nullable: true })
  expires_at!: string | null;

  @Column(timestampType(), { nullable: true })
  last_used_at!: string | null;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;
}
