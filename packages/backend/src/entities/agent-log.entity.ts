import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType } from '../common/utils/sql-dialect';

@Entity('agent_logs')
@Index(['tenant_id', 'agent_id', 'timestamp'])
export class AgentLog {
  @PrimaryColumn('varchar')
  id!: string;

  @Index()
  @Column('varchar', { nullable: true })
  tenant_id!: string | null;

  @Index()
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
