import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

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

  @Column('timestamp', { default: () => 'NOW()' })
  updated_at!: string;
}
