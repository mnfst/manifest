import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import type { KeyRotationRuleScope } from 'manifest-shared';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';

/**
 * Per-agent (harness) key rotation rules: an ordered list of provider
 * API-key labels. A `model`-scope rule applies to one runtime model identity;
 * a `provider`-scope rule applies to every model of that provider. When the
 * proxy attempts a model, the model rule wins; else the provider rule for the
 * model's provider; else no rotation. The rule fully controls which key is
 * used — the first unused label wins, each fallback-triggering failure rotates
 * to the next label for the SAME model, and exhaustion advances the chain.
 *
 * Scoped to (tenant, agent) like every routing config table. `model` is the
 * runtime model identity (null for provider rules), normalized at write time
 * to match the runtime's normalized route model.
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

  /** Runtime model identity; NULL for provider-scope rules. */
  @Column('varchar', { nullable: true })
  model!: string | null;

  /** Canonical provider id (lowercased) the rule's labels belong to. */
  @Column('varchar')
  provider!: string;

  /** Rule scope: 'model' (default) or 'provider' (applies to every model). */
  @Column('varchar', { default: 'model' })
  scope!: KeyRotationRuleScope;

  /** Ordered API-key labels; first unused label is attempted first. */
  @Column('jsonb')
  key_order!: string[];

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
