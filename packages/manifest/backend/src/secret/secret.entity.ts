import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { AppEntity } from '../app/app.entity';

/**
 * AppSecret entity representing a key-value secret for an app
 * Used for storing sensitive configuration like API keys
 */
@Entity('app_secrets')
@Unique(['appId', 'key'])
export class AppSecretEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  appId!: string;

  @ManyToOne(() => AppEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appId' })
  app!: AppEntity;

  @Column({ type: 'varchar', length: 256 })
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
