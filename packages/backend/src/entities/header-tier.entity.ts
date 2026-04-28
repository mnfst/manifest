import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';
import type { AuthType, TierColor } from 'manifest-shared';

@Entity('header_tiers')
@Index(['agent_id', 'sort_order'])
// The unique (agent_id, LOWER(name)) index is declared in the migration so it
// can be case-insensitive. Don't re-declare it here with a case-sensitive
// collation — schema sync would drop the migration's index in dev.
export class HeaderTier {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar', { nullable: true })
  tenant_id!: string | null;

  @Column('varchar')
  agent_id!: string;

  @Column('varchar', { nullable: true })
  user_id!: string | null;

  @Column('varchar')
  name!: string;

  @Column('varchar')
  header_key!: string;

  @Column('varchar')
  header_value!: string;

  @Column('varchar')
  badge_color!: TierColor;

  @Column('integer', { default: 0 })
  sort_order!: number;

  @Column('boolean', { default: true })
  enabled!: boolean;

  @Column('varchar', { nullable: true })
  override_model!: string | null;

  @Column('varchar', { nullable: true })
  override_provider!: string | null;

  @Column('varchar', { nullable: true })
  override_auth_type!: AuthType | null;

  @Column('simple-json', { nullable: true })
  fallback_models!: string[] | null;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
