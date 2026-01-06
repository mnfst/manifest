import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AppEntity } from '../app/app.entity';
import type { FlowParameter, NodeInstance, Connection } from '@chatgpt-app-builder/shared';

/**
 * Flow entity representing an MCP tool belonging to an app.
 * Contains nodes and connections stored as JSON arrays.
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

  /**
   * Node instances within this flow.
   * Each node has: id, type, name, position, parameters.
   */
  @Column({ type: 'simple-json', default: '[]' })
  nodes!: NodeInstance[];

  /**
   * Connections between nodes.
   * Each connection has: id, sourceNodeId, sourceHandle, targetNodeId, targetHandle.
   */
  @Column({ type: 'simple-json', default: '[]' })
  connections!: Connection[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relation to parent app
  @ManyToOne(() => AppEntity, (app) => app.flows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appId' })
  app?: AppEntity;
}
