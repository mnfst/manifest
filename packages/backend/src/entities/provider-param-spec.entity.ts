import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import type { AuthType, JsonValue, ParamControl } from 'manifest-shared';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';

@Entity('provider_param_specs')
@Index(['provider', 'auth_type', 'model_name', 'sort_order'])
export class ProviderParamSpecEntity {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  provider!: string;

  @Column('varchar')
  auth_type!: AuthType;

  @Column('varchar', { nullable: true, default: null })
  model_name!: string | null;

  @Column('varchar')
  param_key!: string;

  @Column('varchar')
  control_kind!: ParamControl['kind'];

  @Column('varchar')
  label!: string;

  @Column('jsonb')
  default_value!: JsonValue;

  @Column('jsonb', { nullable: true, default: null })
  values!: string[] | null;

  @Column('double precision', { nullable: true, default: null })
  min_value!: number | null;

  @Column('double precision', { nullable: true, default: null })
  max_value!: number | null;

  @Column('double precision', { nullable: true, default: null })
  step_value!: number | null;

  @Column('varchar', { nullable: true, default: null })
  serializer!: string | null;

  @Column('integer', { default: 0 })
  sort_order!: number;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
