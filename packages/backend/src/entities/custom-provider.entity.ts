import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';

export interface CustomProviderModel {
  model_name: string;
  input_price_per_million_tokens?: number;
  output_price_per_million_tokens?: number;
  context_window?: number;
  price_estimated?: boolean;
}

export type CustomProviderApiKind = 'openai' | 'anthropic';

@Entity('custom_providers')
@Index(['user_id', 'name'], { unique: true })
export class CustomProvider {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  user_id!: string;

  @Column('varchar')
  name!: string;

  @Column('varchar')
  base_url!: string;

  @Column('varchar', { default: 'openai' })
  api_kind!: CustomProviderApiKind;

  @Column('simple-json')
  models!: CustomProviderModel[];

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;
}
