import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType } from '../common/utils/sql-dialect';

@Entity('agent_messages')
@Index(['tenant_id', 'agent_id', 'timestamp'])
export class AgentMessage {
  @PrimaryColumn('varchar')
  id!: string;

  @Index()
  @Column('varchar', { nullable: true })
  tenant_id!: string | null;

  @Index()
  @Column('varchar', { nullable: true })
  agent_id!: string | null;

  @Column('varchar', { nullable: true })
  trace_id!: string | null;

  @Column('varchar', { nullable: true })
  session_key!: string | null;

  @Column('varchar', { nullable: true })
  session_id!: string | null;

  @Column(timestampType())
  timestamp!: string;

  @Column('integer', { nullable: true })
  duration_ms!: number | null;

  @Column('integer', { default: 0 })
  input_tokens!: number;

  @Column('integer', { default: 0 })
  output_tokens!: number;

  @Column('integer', { default: 0 })
  cache_read_tokens!: number;

  @Column('integer', { default: 0 })
  cache_creation_tokens!: number;

  @Column('decimal', { precision: 10, scale: 6, nullable: true })
  cost_usd!: number | null;

  @Column('varchar', { default: 'ok' })
  status!: string;

  @Column('varchar', { nullable: true })
  error_message!: string | null;

  @Column('varchar', { nullable: true })
  description!: string | null;

  @Column('varchar', { nullable: true })
  service_type!: string | null;

  @Column('varchar', { nullable: true })
  agent_name!: string | null;

  @Column('varchar', { nullable: true })
  model!: string | null;

  @Column('varchar', { nullable: true })
  skill_name!: string | null;

  @Index()
  @Column('varchar', { nullable: true })
  user_id!: string | null;
}
