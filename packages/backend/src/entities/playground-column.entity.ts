import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';
import { PlaygroundRun } from './playground-run.entity';

@Entity('playground_columns')
@Index(['playground_run_id', 'position'])
export class PlaygroundColumn {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  playground_run_id!: string;

  @ManyToOne(() => PlaygroundRun, (r) => r.columns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playground_run_id' })
  run!: PlaygroundRun;

  @Column('varchar')
  model!: string;

  @Column('varchar')
  provider!: string;

  @Column('varchar', { nullable: true })
  auth_type!: string | null;

  @Column('varchar', { nullable: true })
  display_name!: string | null;

  @Column('varchar')
  status!: string;

  @Column('text', { nullable: true })
  content!: string | null;

  @Column('simple-json', { nullable: true })
  headers!: Record<string, string> | null;

  @Column('text', { nullable: true })
  error_message!: string | null;

  @Column('integer', { nullable: true })
  input_tokens!: number | null;

  @Column('integer', { nullable: true })
  output_tokens!: number | null;

  @Column('decimal', { precision: 10, scale: 6, nullable: true })
  cost_usd!: number | null;

  @Column('integer', { nullable: true })
  duration_ms!: number | null;

  @Column('integer', { default: 0 })
  position!: number;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;
}
