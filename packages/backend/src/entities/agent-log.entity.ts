import { Entity, Column, PrimaryColumn } from 'typeorm';
import { timestampType } from '../common/utils/postgres-sql';

@Entity('agent_logs')
export class AgentLog {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar', { nullable: true })
  tenant_id!: string | null;

  @Column('varchar', { nullable: true })
  agent_id!: string | null;

  @Column(timestampType())
  timestamp!: string;

  @Column('varchar', { nullable: true })
  agent_name!: string | null;

  @Column('varchar', { default: 'info' })
  severity!: string;

  @Column('text', { nullable: true })
  body!: string | null;

  @Column('varchar', { nullable: true })
  trace_id!: string | null;

  @Column('varchar', { nullable: true })
  span_id!: string | null;

  @Column('text', { nullable: true })
  attributes!: string | null;
}
