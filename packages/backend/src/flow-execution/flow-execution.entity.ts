import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FlowEntity } from '../flow/flow.entity';
import type {
  ExecutionStatus,
  NodeExecutionData,
  ExecutionErrorInfo,
} from '@chatgpt-app-builder/shared';

/**
 * FlowExecution entity representing a single invocation of a flow via MCP.
 * Captures the complete execution lifecycle including initial parameters,
 * node-by-node data progression, and final status.
 */
@Entity('flow_executions')
@Index(['flowId', 'startedAt'])
export class FlowExecutionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  flowId?: string;

  @Column({ type: 'varchar', length: 300 })
  flowName!: string;

  @Column({ type: 'varchar', length: 100 })
  flowToolName!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: ExecutionStatus;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  startedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  endedAt?: Date;

  @Column({ type: 'simple-json' })
  initialParams!: Record<string, unknown>;

  @Column({ type: 'simple-json', default: '[]' })
  nodeExecutions!: NodeExecutionData[];

  @Column({ type: 'simple-json', nullable: true })
  errorInfo?: ExecutionErrorInfo;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => FlowEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'flowId' })
  flow?: FlowEntity;
}
