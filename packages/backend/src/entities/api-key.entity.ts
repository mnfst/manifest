import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

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

  @Column('timestamp', { default: () => 'NOW()' })
  created_at!: string;

  @Column('timestamp', { nullable: true, default: null })
  last_used_at!: string | null;
}
