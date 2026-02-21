import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/sql-dialect';

@Entity('api_keys')
export class ApiKey {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar', { nullable: true })
  key!: string | null;

  @Index({ unique: true })
  @Column('varchar', { length: 64 })
  key_hash!: string;

  @Column('varchar', { length: 12 })
  key_prefix!: string;

  @Column('varchar')
  user_id!: string;

  @Column('varchar')
  name!: string;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { nullable: true, default: null })
  last_used_at!: string | null;
}
