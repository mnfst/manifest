import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import type { AppRole } from '@manifest/shared';
import { AppEntity } from '../app/app.entity';

/**
 * Join table for many-to-many relationship between users and apps with role assignment.
 * Users are managed by better-auth, so we only store the userId reference.
 */
@Entity('user_app_roles')
@Unique(['userId', 'appId'])
export class UserAppRoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  appId!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: AppRole;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => AppEntity, (app) => app.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appId' })
  app!: AppEntity;
}
