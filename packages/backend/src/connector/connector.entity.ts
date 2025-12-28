import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ConnectorType, ConnectorCategory } from '@chatgpt-app-builder/shared';

@Entity('connectors')
export class ConnectorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  connectorType!: ConnectorType;

  @Column({ type: 'varchar', length: 50 })
  category!: ConnectorCategory;

  @Column({ type: 'text' })
  config!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
