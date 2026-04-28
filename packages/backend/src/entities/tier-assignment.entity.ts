import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import type { AuthType } from 'manifest-shared';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';

@Entity('tier_assignments')
@Index(['agent_id', 'tier'], { unique: true })
export class TierAssignment {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  user_id!: string;

  @Column('varchar')
  agent_id!: string;

  @Column('varchar')
  tier!: string;

  @Column('varchar', { nullable: true })
  override_model!: string | null;

  @Column('varchar', { nullable: true })
  override_provider!: string | null;

  @Column('varchar', { nullable: true })
  override_auth_type!: AuthType | null;

  @Column('varchar', { nullable: true })
  auto_assigned_model!: string | null;

  @Column('simple-json', { nullable: true })
  fallback_models!: string[] | null;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
