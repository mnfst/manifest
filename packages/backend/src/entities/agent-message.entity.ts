import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType } from '../common/utils/postgres-sql';
import type { CallerAttribution } from '../routing/proxy/caller-classifier';

@Entity('agent_messages')
@Index(['tenant_id', 'agent_id', 'timestamp'])
@Index(['user_id', 'timestamp'])
@Index(['tenant_id', 'agent_name', 'timestamp'])
@Index(['tenant_id', 'timestamp'])
@Index(['tenant_id', 'trace_id'])
@Index(['tenant_id', 'model'])
@Index(['tenant_id', 'agent_id', 'status'])
// Per-completion success dedup (ProxyMessageDedup.findExistingSuccessMessage)
// filters tenant_id + agent_id + model + status='ok' and orders by timestamp.
@Index(['tenant_id', 'agent_id', 'model', 'status', 'timestamp'])
// Per-connection analytics scope by the exact key that served each message
// (tenant_provider_id) ordered by recency, and the FK below resolves its
// ON DELETE SET NULL against the same column. tenant_provider_id leads so one
// index serves both the connection-detail reads and the parent-delete cleanup.
@Index(['tenant_provider_id', 'tenant_id', 'timestamp'])
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

  /**
   * DEPRECATED — informational attribution only, written by the proxy
   * recorder. Never filter, scope, key, or authorize by this column; all
   * scoping goes through `tenant_id`. Kept because agent_messages is the
   * big hot table and a column drop isn't worth the rewrite.
   */
  @Column('varchar', { nullable: true })
  user_id!: string | null;

  @Column('varchar', { nullable: true })
  specificity_category!: string | null;

  @Column('boolean', { default: false })
  specificity_miscategorized!: boolean;

  @Column('simple-json', { nullable: true })
  caller_attribution!: CallerAttribution | null;

  @Column('simple-json', { nullable: true })
  request_headers!: Record<string, string> | null;

  @Column('jsonb', { nullable: true })
  request_params!: object | null;

  @Column('varchar', { nullable: true })
  header_tier_id!: string | null;

  @Column('varchar', { nullable: true })
  header_tier_name!: string | null;

  @Column('varchar', { nullable: true })
  header_tier_color!: string | null;

  @Column('varchar', { nullable: true })
  feedback_rating!: string | null;

  @Column('varchar', { nullable: true })
  feedback_tags!: string | null;

  @Column('text', { nullable: true })
  feedback_details!: string | null;

  @Column('varchar', { nullable: true })
  provider_key_label!: string | null;

  // The exact tenant_providers row (connection/key) that served this message.
  // Stamped at proxy time from the selected CachedProviderKey.id so per-connection
  // analytics filter on identity rather than the (provider, auth_type, label)
  // tuple — which is not unique per key (default label 'Default'; NULL coerces to
  // it). NULL for pre-upgrade history, local/Ollama, and blind-proxy paths.
  @Column('varchar', { nullable: true })
  tenant_provider_id!: string | null;
}
