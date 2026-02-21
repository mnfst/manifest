import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType } from '../common/utils/sql-dialect';

@Entity('cost_snapshots')
export class CostSnapshot {
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

  @Column(timestampType())
  snapshot_time!: string;

  @Column('decimal', { precision: 10, scale: 6, default: 0 })
  cost_usd!: number;

  @Column('varchar', { nullable: true })
  model!: string | null;
}
