import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { FlowEntity } from '../flow/flow.entity';

/**
 * ReturnValue entity representing a text content item to return from an MCP tool
 * Multiple return values can belong to a single flow, ordered by position
 */
@Entity('return_values')
export class ReturnValueEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  flowId!: string;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'int', default: 0 })
  order!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relation to parent flow
  @ManyToOne(() => FlowEntity, (flow) => flow.returnValues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flowId' })
  flow?: FlowEntity;
}
