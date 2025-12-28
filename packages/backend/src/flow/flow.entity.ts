import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { AppEntity } from '../entities/app.entity';
import type { FlowParameter } from '@chatgpt-app-builder/shared';

/**
 * Flow entity representing an MCP tool belonging to an app
 * Contains views for display
 */
@Entity('flows')
export class FlowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  appId!: string;

  @Column({ type: 'varchar', length: 300 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 100 })
  toolName!: string;

  @Column({ type: 'varchar', length: 500 })
  toolDescription!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  whenToUse?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  whenNotToUse?: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'simple-json', nullable: true })
  parameters?: FlowParameter[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relation to parent app
  @ManyToOne(() => AppEntity, (app) => app.flows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appId' })
  app?: AppEntity;

  // Relation to views
  @OneToMany('ViewEntity', 'flow', { cascade: true })
  views?: import('../view/view.entity').ViewEntity[];
}
