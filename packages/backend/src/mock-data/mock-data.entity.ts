import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import type { MockData } from '@chatgpt-app-builder/shared';
import { ViewEntity } from '../view/view.entity';

/**
 * MockData entity for storing sample data separately from views
 * OneToOne relationship with ViewEntity, cascade delete enabled
 */
@Entity('mock_data')
export class MockDataEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  viewId!: string;

  @Column({ type: 'simple-json' })
  data!: MockData;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => ViewEntity, (view) => view.mockDataEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'viewId' })
  view?: ViewEntity;
}
