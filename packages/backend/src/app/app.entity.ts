import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import type { AppStatus, ThemeVariables } from '@chatgpt-app-builder/shared';
import type { UserAppRoleEntity } from '../auth/user-app-role.entity';

/**
 * App entity representing an MCP server
 * Contains flows (MCP tools) which contain views
 * Stored in SQLite, designed for PostgreSQL migration
 */
@Entity('apps')
export class AppEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string;

  @Column({ type: 'varchar', unique: true })
  slug!: string;

  @Column({ type: 'simple-json' })
  themeVariables!: ThemeVariables;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft',
  })
  status!: AppStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relation to flows - will be added after FlowEntity is created
  @OneToMany('FlowEntity', 'app', { cascade: true })
  flows?: import('../flow/flow.entity').FlowEntity[];

  // Relation to user roles for app access
  @OneToMany('UserAppRoleEntity', 'app')
  userRoles?: UserAppRoleEntity[];
}
