import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import type { ModelRoute, RequestParamDefaults, ResponseMode } from 'manifest-shared';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';

export const EXPOSED_MODEL_SOURCE_KINDS = ['direct', 'tier', 'specificity', 'header_tier'] as const;

export type ExposedModelSourceKind = (typeof EXPOSED_MODEL_SOURCE_KINDS)[number];

@Entity('exposed_model_routes')
@Index(['agent_id', 'enabled'])
export class ExposedModelRoute {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  tenant_id!: string;

  @Column('varchar')
  agent_id!: string;

  @Column('varchar')
  model_id!: string;

  @Column('varchar', { nullable: true })
  display_name!: string | null;

  @Column('boolean', { default: true })
  enabled!: boolean;

  @Column('varchar')
  source_kind!: ExposedModelSourceKind;

  @Column('varchar', { nullable: true })
  source_key!: string | null;

  @Column('jsonb', { nullable: true })
  route!: ModelRoute | null;

  @Column('jsonb', { nullable: true })
  fallback_routes!: ModelRoute[] | null;

  @Column('jsonb', { nullable: true })
  request_params!: RequestParamDefaults | null;

  @Column('varchar', { default: 'buffered' })
  response_mode!: ResponseMode;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
