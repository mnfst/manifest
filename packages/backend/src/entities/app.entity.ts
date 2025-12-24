import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import type { LayoutTemplate, AppStatus, ThemeVariables, MockData } from '@chatgpt-app-builder/shared';

/**
 * App entity representing a user-created ChatGPT application
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

  @Column({
    type: 'varchar',
    length: 20,
    default: 'table',
  })
  layoutTemplate!: LayoutTemplate;

  @Column({ type: 'text' })
  systemPrompt!: string;

  @Column({ type: 'simple-json' })
  themeVariables!: ThemeVariables;

  @Column({ type: 'simple-json' })
  mockData!: MockData;

  // MCP Tool Configuration
  @Column({ type: 'varchar', length: 50, nullable: true })
  toolName?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  toolDescription?: string;

  // MCP Server Configuration
  @Column({ type: 'varchar', unique: true, nullable: true })
  mcpSlug?: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft',
  })
  status!: AppStatus;
}
