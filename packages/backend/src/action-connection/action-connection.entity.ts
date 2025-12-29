import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import type { ActionTargetType } from '@chatgpt-app-builder/shared';
import { ViewEntity } from '../view/view.entity';
import { ReturnValueEntity } from '../return-value/return-value.entity';
import { CallFlowEntity } from '../call-flow/call-flow.entity';

/**
 * ActionConnection entity representing a link between a View's action and its target
 * Each view can have multiple action connections (one per action name)
 * Targets can be either return values or call flows
 */
@Entity('action_connections')
@Unique(['viewId', 'actionName'])
export class ActionConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  viewId!: string;

  @Column({ type: 'varchar', length: 100 })
  actionName!: string;

  @Column({ type: 'varchar', length: 20 })
  targetType!: ActionTargetType;

  @Column({ type: 'uuid', nullable: true })
  targetReturnValueId?: string;

  @Column({ type: 'uuid', nullable: true })
  targetCallFlowId?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relation to parent view
  @ManyToOne(() => ViewEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'viewId' })
  view?: ViewEntity;

  // Relation to target return value (nullable - target may be deleted)
  @ManyToOne(() => ReturnValueEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'targetReturnValueId' })
  targetReturnValue?: ReturnValueEntity;

  // Relation to target call flow (nullable - target may be deleted)
  @ManyToOne(() => CallFlowEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'targetCallFlowId' })
  targetCallFlow?: CallFlowEntity;
}
