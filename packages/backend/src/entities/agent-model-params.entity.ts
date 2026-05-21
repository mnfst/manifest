import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import type { AuthType, RequestParamDefaults } from 'manifest-shared';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';

/**
 * Per-(agent, route) outbound request body defaults. Replaces the old
 * `tier_assignments.param_defaults` / `specificity_assignments.param_defaults`
 * blobs: params now travel with the scoped route identity (`scope_key`,
 * `provider`, `model`, `auth_type`). The same model can be configured
 * differently in the default/complexity tiers, task-specific tiers, and
 * custom header tiers.
 *
 * `keyLabel` is intentionally NOT part of the unique key — provider API
 * knobs like `thinking` don't differ by which API key is used. If a future
 * knob is genuinely key-scoped (e.g. a per-account safety setting), promote
 * it to its own column.
 */
@Entity('agent_model_params')
@Index(['agent_id', 'scope_key', 'provider', 'model_name', 'auth_type'], { unique: true })
export class AgentModelParams {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  user_id!: string;

  @Column('varchar')
  agent_id!: string;

  @Column('varchar')
  scope_key!: string;

  @Column('varchar')
  provider!: string;

  @Column('varchar')
  auth_type!: AuthType;

  @Column('varchar')
  model_name!: string;

  @Column('jsonb')
  params!: RequestParamDefaults;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
