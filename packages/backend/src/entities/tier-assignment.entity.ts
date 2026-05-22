import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import type { ModelRoute } from 'manifest-shared';
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

  @Column('jsonb', { nullable: true })
  override_route!: ModelRoute | null;

  @Column('jsonb', { nullable: true })
  auto_assigned_route!: ModelRoute | null;

  @Column('jsonb', { nullable: true })
  fallback_routes!: ModelRoute[] | null;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
