import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type {
  AuthType,
  JsonValue,
  ModelParamGroup,
  ModelParamRange,
  ModelParamType,
  ParamApplicability,
} from 'manifest-shared';
import { timestampDefault, timestampType } from '../common/utils/postgres-sql';

@Entity('provider_param_specs')
@Index(['provider', 'auth_type', 'model_name', 'param_path'], { unique: true })
@Index(['provider', 'auth_type', 'model_name', 'param_group'])
export class ProviderParamSpecEntity {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  provider!: string;

  @Column('varchar')
  auth_type!: AuthType;

  @Column('varchar')
  model_name!: string;

  @Column('varchar')
  param_path!: string;

  @Column('varchar')
  param_type!: ModelParamType;

  @Column('varchar')
  label!: string;

  @Column('jsonb')
  default_value!: JsonValue;

  @Column('jsonb', { nullable: true, default: null })
  values!: JsonValue[] | null;

  @Column('jsonb', { nullable: true, default: null })
  range!: ModelParamRange | null;

  @Column('varchar')
  param_group!: ModelParamGroup;

  @Column('jsonb', { nullable: true, default: null })
  applicability!: ParamApplicability | null;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
