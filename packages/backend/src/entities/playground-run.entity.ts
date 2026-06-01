import { Entity, Column, PrimaryColumn, Index, OneToMany } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';
import { PlaygroundColumn } from './playground-column.entity';

@Entity('playground_runs')
@Index(['user_id', 'agent_id', 'created_at'])
export class PlaygroundRun {
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

  /**
   * The playground_columns.id the user marked as the best answer for this run.
   * Null = no pick yet. Captured as a reinforcement-learning preference signal.
   */
  @Column('varchar', { nullable: true })
  best_column_id!: string | null;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @OneToMany(() => PlaygroundColumn, (c) => c.run, { cascade: true })
  columns!: PlaygroundColumn[];
}
