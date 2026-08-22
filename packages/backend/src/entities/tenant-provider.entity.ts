import { Entity, Column, PrimaryColumn } from 'typeorm';
import type { AuthType } from 'manifest-shared';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';
import type { DiscoveredModel } from '../model-discovery/model-fetcher';

@Entity('tenant_providers')
export class TenantProvider {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  tenant_id!: string;

  /** Audit-only: which user connected the provider. Never used for scoping. */
  @Column('varchar', { nullable: true, default: null })
  created_by_user_id!: string | null;

  @Column('varchar', { nullable: true, default: null })
  agent_id!: string | null;

  @Column('varchar')
  provider!: string;

  @Column('varchar', { nullable: true, default: null })
  api_key_encrypted!: string | null;

  /**
   * One-way hash (scrypt-based, see hashKey) of the raw provider key. Enables
   * match-verify ("did the admin post the right key?") without ever returning
   * the stored secret. Analogous to api_keys.key_hash. Null when no key is set.
   */
  @Column('varchar', { nullable: true, default: null })
  key_hash!: string | null;

  @Column('varchar', { nullable: true, default: null })
  key_prefix!: string | null;

  @Column('varchar', { default: 'api_key' })
  auth_type!: AuthType;

  @Column('varchar', { default: 'Default' })
  label!: string;

  @Column('integer', { default: 0 })
  priority!: number;

  @Column('varchar', { nullable: true, default: null })
  region!: string | null;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @Column(timestampType(), { default: timestampDefault() })
  connected_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;

  @Column('simple-json', { nullable: true, default: null })
  cached_models!: DiscoveredModel[] | null;

  @Column(timestampType(), { nullable: true, default: null })
  models_fetched_at!: string | null;
}
