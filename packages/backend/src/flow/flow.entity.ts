import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AppEntity } from '../app/app.entity';
import type { NodeInstance, Connection } from '@chatgpt-app-builder/shared';

/**
 * Flow entity representing a workflow belonging to an app.
 * MCP tools are now derived from UserIntent trigger nodes within the flow.
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

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // Note: toolName, toolDescription, and parameters have been moved to UserIntent node parameters

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
