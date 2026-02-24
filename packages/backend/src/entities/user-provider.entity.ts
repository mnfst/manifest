import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/sql-dialect';

@Entity('user_providers')
@Index(['user_id', 'provider'], { unique: true })
export class UserProvider {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  user_id!: string;

  @Column('varchar')
  provider!: string;

  @Column('varchar', { nullable: true, default: null })
  api_key_encrypted!: string | null;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @Column(timestampType(), { default: timestampDefault() })
  connected_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
