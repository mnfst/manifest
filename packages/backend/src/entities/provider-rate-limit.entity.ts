import { Entity, Column, PrimaryColumn } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';

@Entity('provider_rate_limits')
export class ProviderRateLimit {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  user_id!: string;

  @Column('varchar')
  provider!: string;

  @Column('varchar')
  auth_type!: string;

  @Column('varchar', { nullable: true, default: null })
  key_label!: string | null;

  /** 'requests' | 'tokens' | 'input_tokens' | 'output_tokens' */
  @Column('varchar')
  limit_type!: string;

  /** 'minute' | 'hour' | 'day' | 'week' | 'month' */
  @Column('varchar')
  period!: string;

  /** Max allowed for this period (null = unknown). */
  @Column('bigint', { nullable: true, default: null })
  limit_value!: string | null;

  /** Current consumption in this period. */
  @Column('bigint')
  used_value!: string;

  /** Remaining (from headers, null if computed). */
  @Column('bigint', { nullable: true, default: null })
  remaining_value!: string | null;

  /** When this period resets. */
  @Column(timestampType(), { nullable: true, default: null })
  resets_at!: string | null;

  /** 'header' | 'hardcoded' | 'computed' */
  @Column('varchar', { default: 'header' })
  source!: string;

  @Column(timestampType(), { default: timestampDefault() })
  captured_at!: string;
}
