import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { AgentApiKey } from './agent-api-key.entity';
import { timestampType, timestampDefault } from '../common/utils/sql-dialect';

@Entity('agents')
@Index(['tenant_id', 'name'], { unique: true })
export class Agent {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  name!: string;

  @Column('varchar', { nullable: true })
  display_name!: string | null;

  @Column('varchar', { nullable: true })
  description!: string | null;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @ManyToOne(() => Tenant, (t) => t.agents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column('varchar')
  tenant_id!: string;

  @OneToOne(() => AgentApiKey, (k) => k.agent, { cascade: true })
  apiKey!: AgentApiKey;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
