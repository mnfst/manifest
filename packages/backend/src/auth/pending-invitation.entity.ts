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
 * Entity for pending app invitations.
 * Created when inviting a user who hasn't signed up yet.
 * Deleted when the invitation is accepted or revoked.
 */
@Entity('pending_invitations')
@Unique(['email', 'appId'])
export class PendingInvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Email address of the invited user (stored lowercase)
   */
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  /**
   * Hashed invitation token (plain token sent via email)
   */
  @Column({ type: 'varchar', length: 255, unique: true })
  token!: string;

  /**
   * App this invitation is for
   */
  @Column({ type: 'varchar' })
  appId!: string;

  /**
   * User who sent the invitation
   */
  @Column({ type: 'varchar' })
  inviterId!: string;

  /**
   * Role to assign when invitation is accepted
   */
  @Column({ type: 'varchar', length: 20 })
  role!: AppRole;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => AppEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appId' })
  app!: AppEntity;
}
