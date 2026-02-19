import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('security_event')
export class SecurityEvent {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar', { nullable: true })
  session_key!: string | null;

  @Column('timestamp')
  timestamp!: string;

  @Column('varchar')
  severity!: string;

  @Column('varchar')
  category!: string;

  @Column('varchar')
  description!: string;

  @Column('varchar', { nullable: true })
  user_id!: string | null;
}
