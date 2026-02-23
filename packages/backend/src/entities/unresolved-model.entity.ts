import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType } from '../common/utils/sql-dialect';

@Entity('unresolved_models')
export class UnresolvedModel {
  @PrimaryColumn('varchar')
  model_name!: string;

  @Column(timestampType())
  first_seen!: Date;

  @Column(timestampType())
  last_seen!: Date;

  @Column('integer', { default: 1 })
  occurrence_count!: number;

  @Index('IDX_unresolved_resolved')
  @Column('boolean', { default: false })
  resolved!: boolean;

  @Column('varchar', { nullable: true })
  resolved_to!: string | null;

  @Column(timestampType(), { nullable: true })
  resolved_at!: Date | null;
}
