import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { FlowEntity } from '../flow/flow.entity';

/**
 * CallFlow entity representing an end action that triggers another flow
 * Multiple call flows can belong to a single flow, ordered by position
 */
@Entity('call_flows')
export class CallFlowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  flowId!: string;

  @Column({ type: 'uuid', nullable: true })
  targetFlowId!: string;

  @Column({ type: 'int', default: 0 })
  order!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relation to parent flow
  @ManyToOne(() => FlowEntity, (flow) => flow.callFlows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flowId' })
  flow?: FlowEntity;

  // Relation to target flow (nullable - target may be deleted)
  @ManyToOne(() => FlowEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'targetFlowId' })
  targetFlow?: FlowEntity;
}
