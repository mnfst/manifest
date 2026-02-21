import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
import { timestampType } from '../common/utils/sql-dialect';

@Entity('llm_calls')
export class LlmCall {
  @PrimaryColumn('varchar')
  id!: string;

  @Index()
  @Column('varchar', { nullable: true })
  tenant_id!: string | null;

  @Index()
  @Column('varchar', { nullable: true })
  agent_id!: string | null;

  @Column('varchar', { nullable: true })
  turn_id!: string | null;

  @Column('integer', { nullable: true })
  call_index!: number | null;

  @Column('varchar', { nullable: true })
  gen_ai_system!: string | null;

  @Column('varchar', { nullable: true })
  request_model!: string | null;

  @Column('varchar', { nullable: true })
  response_model!: string | null;

  @Column('integer', { default: 0 })
  input_tokens!: number;

  @Column('integer', { default: 0 })
  output_tokens!: number;

  @Column('integer', { default: 0 })
  cache_read_tokens!: number;

  @Column('integer', { default: 0 })
  cache_creation_tokens!: number;

  @Column('integer', { nullable: true })
  duration_ms!: number | null;

  @Column('integer', { nullable: true })
  ttft_ms!: number | null;

  @Column('decimal', { precision: 3, scale: 2, nullable: true })
  temperature!: number | null;

  @Column('integer', { nullable: true })
  max_output_tokens!: number | null;

  @Column(timestampType())
  timestamp!: string;
}
