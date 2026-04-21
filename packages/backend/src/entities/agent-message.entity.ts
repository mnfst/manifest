import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType } from '../common/utils/sql-dialect';
import type { CallerAttribution } from '../routing/proxy/caller-classifier';

@Entity('agent_messages')
@Index(['tenant_id', 'agent_id', 'timestamp'])
@Index(['user_id', 'timestamp'])
@Index(['tenant_id', 'agent_name', 'timestamp'])
@Index(['tenant_id', 'timestamp'])
@Index(['tenant_id', 'trace_id'])
@Index(['tenant_id', 'model'])
@Index(['tenant_id', 'agent_id', 'status'])
export class AgentMessage {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar', { nullable: true })
  tenant_id!: string | null;

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

  @Column('integer', { nullable: true })
  error_http_status!: number | null;

  @Column('varchar', { nullable: true })
  description!: string | null;

  @Column('varchar', { nullable: true })
  service_type!: string | null;

  @Column('varchar', { nullable: true })
  agent_name!: string | null;

  @Column('varchar', { nullable: true })
  model!: string | null;

  @Column('varchar', { nullable: true })
  provider!: string | null;

  @Column('varchar', { nullable: true })
  routing_tier!: string | null;

  @Column('varchar', { nullable: true })
  routing_reason!: string | null;

  @Column('varchar', { nullable: true })
  skill_name!: string | null;

  @Column('varchar', { nullable: true })
  auth_type!: string | null;

  @Column('varchar', { nullable: true })
  fallback_from_model!: string | null;

  @Column('integer', { nullable: true })
  fallback_index!: number | null;

  @Column('varchar', { nullable: true })
  user_id!: string | null;

  @Column('varchar', { nullable: true })
  specificity_category!: string | null;

  @Column('boolean', { default: false })
  specificity_miscategorized!: boolean;

  @Column('simple-json', { nullable: true })
  caller_attribution!: CallerAttribution | null;

  @Column('varchar', { nullable: true })
  feedback_rating!: string | null;

  @Column('varchar', { nullable: true })
  feedback_tags!: string | null;

  @Column('text', { nullable: true })
  feedback_details!: string | null;
}
