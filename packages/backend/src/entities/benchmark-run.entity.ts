import { Entity, Column, PrimaryColumn, Index, OneToMany } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';
import { BenchmarkColumn } from './benchmark-column.entity';

@Entity('benchmark_runs')
@Index(['user_id', 'agent_id', 'created_at'])
export class BenchmarkRun {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  tenant_id!: string;

  @Column('varchar')
  user_id!: string;

  @Column('varchar')
  agent_id!: string;

  @Column('varchar')
  agent_name!: string;

  @Column('text')
  prompt!: string;

  @Column('boolean', { default: false })
  starred!: boolean;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @OneToMany(() => BenchmarkColumn, (c) => c.run, { cascade: true })
  columns!: BenchmarkColumn[];
}
