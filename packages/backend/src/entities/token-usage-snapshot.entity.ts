import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('token_usage_snapshots')
@Index(['tenant_id', 'agent_id', 'snapshot_time'])
export class TokenUsageSnapshot {
  @PrimaryColumn('varchar')
  id!: string;

  @Index()
  @Column('varchar', { nullable: true })
  tenant_id!: string | null;

  @Index()
  @Column('varchar', { nullable: true })
  agent_id!: string | null;

  @Column('varchar', { nullable: true })
  agent_name!: string | null;

  @Column('timestamp')
  snapshot_time!: string;

  @Column('integer', { default: 0 })
  input_tokens!: number;

  @Column('integer', { default: 0 })
  output_tokens!: number;

  @Column('integer', { default: 0 })
  cache_read_tokens!: number;

  @Column('integer', { default: 0 })
  cache_creation_tokens!: number;

  @Column('integer', { default: 0 })
  total_tokens!: number;
}
