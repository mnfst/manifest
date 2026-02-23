import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('model_pricing')
export class ModelPricing {
  @PrimaryColumn('varchar')
  model_name!: string;

  @Column('decimal', { precision: 12, scale: 10 })
  input_price_per_token!: number;

  @Column('decimal', { precision: 12, scale: 10 })
  output_price_per_token!: number;

  @Column('varchar', { default: '' })
  provider!: string;

  @Column('varchar', { nullable: true })
  updated_at!: string | null;

  @Column('integer', { default: 128000 })
  context_window!: number;

  @Column('boolean', { default: false })
  capability_reasoning!: boolean;

  @Column('boolean', { default: false })
  capability_code!: boolean;

  @Column('boolean', { default: false })
  capability_vision!: boolean;

  @Column('boolean', { default: true })
  capability_tool_calling!: boolean;

  @Column('boolean', { default: false })
  capability_structured_output!: boolean;

  @Column('integer', { default: 3 })
  quality_score!: number;
}
