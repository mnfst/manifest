import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType } from '../common/utils/sql-dialect';

@Entity('model_pricing_history')
@Index('IDX_mph_model_effective', ['model_name', 'effective_from'])
export class ModelPricingHistory {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  model_name!: string;

  @Column('decimal', { precision: 12, scale: 10 })
  input_price_per_token!: number;

  @Column('decimal', { precision: 12, scale: 10 })
  output_price_per_token!: number;

  @Column('varchar', { default: '' })
  provider!: string;

  @Column(timestampType())
  effective_from!: Date;

  @Column(timestampType(), { nullable: true })
  effective_until!: Date | null;

  @Column('varchar', { default: 'sync' })
  change_source!: string;
}
