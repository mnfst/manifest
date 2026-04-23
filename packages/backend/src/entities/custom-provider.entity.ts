import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { timestampType, timestampDefault } from '../common/utils/postgres-sql';
import { Agent } from './agent.entity';

export interface CustomProviderModel {
  model_name: string;
  input_price_per_million_tokens?: number;
  output_price_per_million_tokens?: number;
  context_window?: number;
}

@Entity('custom_providers')
@Index(['agent_id', 'name'], { unique: true })
export class CustomProvider {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  agent_id!: string;

  @Column('varchar')
  user_id!: string;

  @Column('varchar')
  name!: string;

  @Column('varchar')
  base_url!: string;

  @Column('simple-json')
  models!: CustomProviderModel[];

  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;
}
