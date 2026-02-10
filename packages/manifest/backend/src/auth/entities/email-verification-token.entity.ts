import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Email verification token for email change requests.
 * Stores verification tokens that are sent to users when they request to change their email.
 */
@Entity('email_verification_token')
export class EmailVerificationTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  @Index()
  token!: string;

  @Column({ type: 'varchar' })
  @Index()
  userId!: string;

  @Column({ type: 'varchar' })
  currentEmail!: string;

  @Column({ type: 'varchar' })
  newEmail!: string;

  @Column({ type: 'datetime' })
  @Index()
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  usedAt!: Date | null;
}
