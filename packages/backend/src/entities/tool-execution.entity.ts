import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('tool_executions')
@Index(['tenant_id', 'agent_id'])
export class ToolExecution {
  @PrimaryColumn('varchar')
  id!: string;

  @Index()
  @Column('varchar', { nullable: true })
  tenant_id!: string | null;

  @Index()
  @Column('varchar', { nullable: true })
  agent_id!: string | null;

  @Column('varchar', { nullable: true })
  llm_call_id!: string | null;

  @Column('varchar')
  tool_name!: string;

  @Column('integer', { nullable: true })
  duration_ms!: number | null;

  @Column('varchar', { default: 'ok' })
  status!: string;

  @Column('varchar', { nullable: true })
  error_message!: string | null;
}
