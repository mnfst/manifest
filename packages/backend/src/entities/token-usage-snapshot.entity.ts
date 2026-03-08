import { Entity, Column, PrimaryColumn } from 'typeorm';
import { timestampType } from '../common/utils/sql-dialect';

@Entity('token_usage_snapshots')
export class TokenUsageSnapshot {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar', { nullable: true })
  tenant_id!: string | null;

  @Column('varchar', { nullable: true })
  agent_id!: string | null;

  @Column('varchar', { nullable: true })
  agent_name!: string | null;

  @Column(timestampType())
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
