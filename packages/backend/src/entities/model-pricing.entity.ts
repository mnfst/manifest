import { Entity, Column, PrimaryColumn } from 'typeorm';
import { timestampType } from '../common/utils/sql-dialect';

@Entity('model_pricing')
export class ModelPricing {
  @PrimaryColumn('varchar')
  model_name!: string;

  @Column('decimal', { precision: 12, scale: 10, nullable: true })
  input_price_per_token!: number | null;

  @Column('decimal', { precision: 12, scale: 10, nullable: true })
  output_price_per_token!: number | null;

  @Column('varchar', { default: '' })
  provider!: string;

  @Column(timestampType(), { nullable: true })
  updated_at!: Date | null;

  @Column('integer', { default: 128000 })
  context_window!: number;

  @Column('boolean', { default: false })
  capability_reasoning!: boolean;

  @Column('boolean', { default: false })
  capability_code!: boolean;

  @Column('integer', { default: 3 })
  quality_score!: number;

  @Column('varchar', { default: '' })
  display_name!: string;
}
