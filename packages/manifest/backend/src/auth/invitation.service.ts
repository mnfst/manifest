import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import Database from 'better-sqlite3';
import type { AppRole, PendingInvitation, InvitationValidation, AcceptInvitationResponse } from '@manifest/shared';
import { PendingInvitationEntity } from './pending-invitation.entity';
import { UserAppRoleEntity } from './user-app-role.entity';
import { AppEntity } from '../app/app.entity';
import { EmailService } from '../email/email.service';

/**
 * Service for managing app invitations
 */
@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);
  private readonly BCRYPT_ROUNDS = 10;
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(PendingInvitationEntity)
    private readonly invitationRepository: Repository<PendingInvitationEntity>,
    @InjectRepository(UserAppRoleEntity)
    private readonly userAppRoleRepository: Repository<UserAppRoleEntity>,
    @InjectRepository(AppEntity)
    private readonly appRepository: Repository<AppEntity>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
  }

  /**
   * Generate a cryptographically secure invitation token
   * @returns Plain text token (to send in email)
   */
  generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Hash a token for secure storage
   */
  async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, this.BCRYPT_ROUNDS);
  }

  /**
   * Verify a token against its hash
   */
  async verifyToken(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
  }

  /**
   * Normalize email to lowercase
   */
  normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Convert entity to DTO
   */
  toDto(entity: PendingInvitationEntity, inviterName?: string): PendingInvitation {
    return {
      id: entity.id,
      email: entity.email,
      role: entity.role,
      appId: entity.appId,
      invitedBy: entity.inviterId,
      inviterName,
      createdAt: entity.createdAt.toISOString(),
    };
  }

  /**
   * Create an invitation and send email
   */
  async createInvitation(
    appId: string,
    email: string,
    role: AppRole,
    inviterId: string,
    inviterName: string,
  ): Promise<PendingInvitation> {
    const normalizedEmail = this.normalizeEmail(email);

    // Check if user already exists
    const existingUser = await this.getUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new BadRequestException('User already exists. Use direct add instead.');
    }

    // Check if invitation already exists
    const existingInvitation = await this.invitationRepository.findOne({
      where: { email: normalizedEmail, appId },
    });
    if (existingInvitation) {
      throw new ConflictException({
        message: 'Invitation already exists for this email',
        existingInvitation: this.toDto(existingInvitation, inviterName),
      });
    }

    // Get app details
    const app = await this.appRepository.findOne({ where: { id: appId } });
    if (!app) {
      throw new NotFoundException('App not found');
    }

    // Generate token
    const plainToken = this.generateToken();
    const hashedToken = await this.hashToken(plainToken);

    // Create invitation
    const invitation = this.invitationRepository.create({
      email: normalizedEmail,
      token: hashedToken,
      appId,
      inviterId,
      role,
    });
    await this.invitationRepository.save(invitation);

    // Send email
    const appLink = `${this.frontendUrl}/accept-invite?token=${encodeURIComponent(plainToken)}`;
    await this.emailService.sendInvitation(normalizedEmail, {
      inviterName,
      appName: app.name,
      appLink,
    });

    this.logger.log(`Invitation created for ${normalizedEmail} to app ${appId}`);
    return this.toDto(invitation, inviterName);
  }

  /**
   * List pending invitations for an app
   */
  async listPendingInvitations(appId: string): Promise<PendingInvitation[]> {
    const invitations = await this.invitationRepository.find({
      where: { appId },
      order: { createdAt: 'DESC' },
    });

    // Get inviter names
    const inviterIds = [...new Set(invitations.map(i => i.inviterId))];
    const inviters = new Map<string, string>();
    for (const id of inviterIds) {
      const user = await this.getUserById(id);
      if (user) {
        inviters.set(id, user.name || user.email);
      }
    }

    return invitations.map(inv => this.toDto(inv, inviters.get(inv.inviterId)));
  }

  /**
   * Revoke (delete) a pending invitation
   */
  async revokeInvitation(invitationId: string, appId: string): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId, appId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    await this.invitationRepository.delete(invitationId);
    this.logger.log(`Invitation ${invitationId} revoked`);
  }

  /**
   * Resend invitation email with a new token
   */
  async resendInvitation(
    invitationId: string,
    appId: string,
    inviterName: string,
  ): Promise<PendingInvitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId, appId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const app = await this.appRepository.findOne({ where: { id: appId } });
    if (!app) {
      throw new NotFoundException('App not found');
    }

    // Generate new token
    const plainToken = this.generateToken();
    const hashedToken = await this.hashToken(plainToken);

    // Update invitation with new token
    invitation.token = hashedToken;
    await this.invitationRepository.save(invitation);

    // Send email
    const appLink = `${this.frontendUrl}/accept-invite?token=${encodeURIComponent(plainToken)}`;
    await this.emailService.sendInvitation(invitation.email, {
      inviterName,
      appName: app.name,
      appLink,
    });

    this.logger.log(`Invitation ${invitationId} resent`);
    return this.toDto(invitation, inviterName);
  }

  /**
   * Validate an invitation token (public endpoint)
   */
  async validateToken(token: string): Promise<InvitationValidation> {
    // Find all invitations and check token against each
    const invitations = await this.invitationRepository.find();

    for (const invitation of invitations) {
      const isValid = await this.verifyToken(token, invitation.token);
      if (isValid) {
        const app = await this.appRepository.findOne({ where: { id: invitation.appId } });
        const inviter = await this.getUserById(invitation.inviterId);

        return {
          valid: true,
          email: invitation.email,
          appId: invitation.appId,
          appName: app?.name || 'Unknown App',
          inviterName: inviter?.name || inviter?.email || 'Unknown',
          role: invitation.role,
        };
      }
    }

    throw new NotFoundException('Invitation not found or has been revoked');
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(
    token: string,
    userId: string,
    userEmail: string,
  ): Promise<AcceptInvitationResponse> {
    // Find the invitation
    const invitations = await this.invitationRepository.find();
    let matchedInvitation: PendingInvitationEntity | null = null;

    for (const invitation of invitations) {
      const isValid = await this.verifyToken(token, invitation.token);
      if (isValid) {
        matchedInvitation = invitation;
        break;
      }
    }

    if (!matchedInvitation) {
      throw new NotFoundException('Invitation not found or has been revoked');
    }

    // Verify email matches
    if (this.normalizeEmail(userEmail) !== matchedInvitation.email) {
      throw new BadRequestException('This invitation was sent to a different email address');
    }

    // Check if user already has access
    const existingRole = await this.userAppRoleRepository.findOne({
      where: { userId, appId: matchedInvitation.appId },
    });
    if (existingRole) {
      // User already has access, just delete the invitation
      await this.invitationRepository.delete(matchedInvitation.id);
      const app = await this.appRepository.findOne({ where: { id: matchedInvitation.appId } });
      return {
        success: true,
        appId: matchedInvitation.appId,
        appName: app?.name || 'Unknown App',
        role: existingRole.role,
        message: 'You already have access to this app.',
      };
    }

    // Create user app role
    const userAppRole = this.userAppRoleRepository.create({
      userId,
      appId: matchedInvitation.appId,
      role: matchedInvitation.role,
    });
    await this.userAppRoleRepository.save(userAppRole);

    // Delete the invitation
    await this.invitationRepository.delete(matchedInvitation.id);

    const app = await this.appRepository.findOne({ where: { id: matchedInvitation.appId } });

    this.logger.log(`Invitation accepted by ${userId} for app ${matchedInvitation.appId}`);

    return {
      success: true,
      appId: matchedInvitation.appId,
      appName: app?.name || 'Unknown App',
      role: matchedInvitation.role,
      message: `Welcome! You now have ${matchedInvitation.role} access to ${app?.name || 'the app'}.`,
    };
  }

  /**
   * Get user by ID from better-auth database
   */
  private async getUserById(userId: string): Promise<{ id: string; email: string; name?: string | null } | null> {
    try {
      const db = new Database('./data/app.db');
      const user = db.prepare('SELECT id, email, name FROM user WHERE id = ?').get(userId) as { id: string; email: string; name?: string | null } | undefined;
      db.close();
      return user || null;
    } catch {
      return null;
    }
  }

  /**
   * Get user by email from better-auth database
   */
  private async getUserByEmail(email: string): Promise<{ id: string; email: string; name?: string | null } | null> {
    try {
      const db = new Database('./data/app.db');
      const user = db.prepare('SELECT id, email, name FROM user WHERE LOWER(email) = ?').get(email.toLowerCase()) as { id: string; email: string; name?: string | null } | undefined;
      db.close();
      return user || null;
    } catch {
      return null;
    }
  }
}
