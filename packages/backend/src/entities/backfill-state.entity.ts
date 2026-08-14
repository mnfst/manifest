import { Entity, PrimaryColumn, Column } from 'typeorm';

import { timestampType, timestampDefault } from '../common/utils/postgres-sql';

/**
 * One row per completed one-time data backfill, keyed by a stable name. The
 * post-deploy backfill boot task inserts its row when finished, so the backfill
 * runs exactly once per install instead of on every boot.
 */
@Entity('backfill_state')
export class BackfillState {
  @PrimaryColumn('varchar')
  name!: string;

  @Column(timestampType(), { default: timestampDefault() })
  completed_at!: string;
}
