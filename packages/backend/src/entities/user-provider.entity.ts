import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('user_providers')
@Index(['user_id', 'provider'], { unique: true })
export class UserProvider {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  user_id!: string;

  @Column('varchar')
  provider!: string;

  @Column('varchar')
  api_key_encrypted!: string;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @Column('timestamp', { default: () => 'NOW()' })
  connected_at!: string;

  @Column('timestamp', { default: () => 'NOW()' })
  updated_at!: string;
}
