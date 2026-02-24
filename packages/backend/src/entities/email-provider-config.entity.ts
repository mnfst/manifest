import {
  Entity,
  Column,
  PrimaryColumn,
  Index,
} from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/sql-dialect';

@Entity('email_provider_configs')
@Index(['user_id'], { unique: true })
export class EmailProviderConfig {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  user_id!: string;

  @Column('varchar')
  provider!: string; // 'resend' | 'mailgun' | 'sendgrid'

  @Column('varchar')
  api_key_encrypted!: string;

  @Column('varchar', { nullable: true })
  domain!: string | null;

  @Column('varchar', { nullable: true })
  notification_email!: string | null;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
