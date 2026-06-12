import { Entity, Column, PrimaryColumn } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';

export interface CustomProviderModel {
  model_name: string;
  input_price_per_million_tokens?: number;
  output_price_per_million_tokens?: number;
  context_window?: number;
  price_estimated?: boolean;
}

export type CustomProviderApiKind = 'openai' | 'anthropic';

// Uniqueness is owned by the migration as a case-insensitive index on
// (user_id, LOWER(name)) — which a column-list @Index can't express. Declaring a
// case-sensitive @Index here would drift from the real schema (synchronize ≠
// migrations), so it's intentionally omitted (same pattern as user_providers).
@Entity('custom_providers')
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
