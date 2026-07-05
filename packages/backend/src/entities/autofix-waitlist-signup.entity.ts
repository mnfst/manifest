import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('autofix_waitlist_signups')
export class AutofixWaitlistSignup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { unique: true })
  email!: string;

  @Column('varchar', { default: 'self-hosted' })
  source!: string;

  @Column('timestamp with time zone', { default: () => 'now()' })
  signed_up_at!: string;
}
