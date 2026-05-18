import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import type { AuthType } from 'manifest-shared';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';

/**
 * Per-(agent, route) outbound request body defaults. Replaces the old
 * `tier_assignments.param_defaults` / `specificity_assignments.param_defaults`
 * blobs: params now travel with the route identity (`provider`, `auth_type`,
 * `model`) regardless of which slot the route happens to occupy. This makes
 * configuring DeepSeek's `thinking` toggle a one-time act that applies in
 * every tier, every specificity category, every header tier, and every
 * fallback position where `deepseek-v3.1` is selected.
 *
 * `keyLabel` is intentionally NOT part of the unique key — provider API
 * knobs like `thinking` don't differ by which API key is used. If a future
 * knob is genuinely key-scoped (e.g. a per-account safety setting), promote
 * it to its own column.
 */
@Entity('agent_model_params')
@Index(['agent_id', 'provider', 'auth_type', 'model_name'], { unique: true })
export class AgentModelParams {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  user_id!: string;

  @Column('varchar')
  agent_id!: string;

  @Column('varchar')
  provider!: string;

  @Column('varchar')
  auth_type!: AuthType;

  @Column('varchar')
  model_name!: string;

  @Column('jsonb')
  params!: object;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
