import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';

@Entity('api_keys')
export class ApiKey {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar', { nullable: true })
  key!: string | null;

  @Index({ unique: true })
  @Column('varchar', { length: 128 })
  key_hash!: string;

  @Column('varchar', { length: 12 })
  key_prefix!: string;

  @Index()
  @Column('varchar')
  tenant_id!: string;

  /** Audit-only: which user created the key. Never used for scoping. */
  @Column('varchar', { nullable: true })
  created_by_user_id!: string | null;

  @Column('varchar')
  name!: string;

  /**
   * Authorization scope for the key. `owner` (default) authorizes the full
   * `/api/v1/*` surface via ApiKeyGuard; `ai_admin` authorizes only the
   * scoped `/api/v1/admin` surface via AdminAiGuard. Additive: existing
   * owner keys retain `owner` and resolve exactly as before.
   */
  @Column('varchar', { default: 'owner' })
  scope!: string;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { nullable: true, default: null })
  last_used_at!: string | null;
}
