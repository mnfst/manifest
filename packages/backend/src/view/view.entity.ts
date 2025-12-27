import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { LayoutTemplate, MockData } from '@chatgpt-app-builder/shared';
import { FlowEntity } from '../flow/flow.entity';

/**
 * View entity representing a display unit within a flow
 * Contains layout template and mock data
 */
@Entity('views')
export class ViewEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  flowId!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name?: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'table',
  })
  layoutTemplate!: LayoutTemplate;

  @Column({ type: 'simple-json' })
  mockData!: MockData;

  @Column({ type: 'int', default: 0 })
  order!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relation to parent flow
  @ManyToOne(() => FlowEntity, (flow) => flow.views, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flowId' })
  flow?: FlowEntity;
}
