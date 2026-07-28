import { Column, Entity, PrimaryColumn } from 'typeorm';
import { timestampType } from '../common/utils/postgres-sql';

@Entity('tenant_request_usage')
export class TenantRequestUsage {
  @PrimaryColumn('varchar')
  tenant_id!: string;

  @PrimaryColumn(timestampType())
  window_start!: string;

  /** PostgreSQL bigint values are returned as strings by the pg driver. */
  @Column('bigint', { default: 0 })
  request_count!: string;
}
