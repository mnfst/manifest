import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';

/**
 * Per-agent (harness) key rotation rules: an ordered list of provider
 * API-key labels for a model. When the proxy attempts that model (primary
 * or any fallback-chain slot) the rule fully controls which key is used —
 * the first unused label wins, each fallback-triggering failure rotates to
 * the next label for the SAME model, and exhaustion advances the chain.
 *
 * Scoped to (tenant, agent) like every routing config table. `model` is the
 * runtime model identity (provider-qualified ids keep their prefix; bare ids
 * are matched case-insensitively against the normalized route model).
 */
@Entity('agent_key_rotation_rules')
@Index(['agent_id', 'model'], { unique: true })
export class AgentKeyRotationRule {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  tenant_id!: string;

  @Column('varchar')
  agent_id!: string;

  @Column('varchar')
  model!: string;

  /** Canonical provider id (lowercased) the rule's labels belong to. */
  @Column('varchar')
  provider!: string;

  /** Ordered API-key labels; first unused label is attempted first. */
  @Column('jsonb')
  key_order!: string[];

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
