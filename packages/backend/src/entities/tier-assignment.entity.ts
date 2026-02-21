import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/sql-dialect';

@Entity('tier_assignments')
@Index(['user_id', 'tier'], { unique: true })
export class TierAssignment {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  user_id!: string;

  @Column('varchar')
  tier!: string;

  @Column('varchar', { nullable: true })
  override_model!: string | null;

  @Column('varchar', { nullable: true })
  auto_assigned_model!: string | null;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
