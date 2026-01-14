import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import type {
  AppRole,
  AppUser,
  AppUserListItem,
  UpdateProfileRequest,
  UpdateProfileResponse,
  ChangeEmailRequest,
  ChangeEmailResponse,
  VerifyEmailChangeResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
} from '@chatgpt-app-builder/shared';
import { auth } from './auth';
import { UserAppRoleEntity } from './user-app-role.entity';
import { PendingInvitationEntity } from './pending-invitation.entity';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity';
import { AppAccessService } from './app-access.service';
import { EmailService } from '../email/email.service';

/**
 * Service for managing user access to apps
 */
@Injectable()
export class UserManagementService {
  constructor(
    @InjectRepository(UserAppRoleEntity)
    private readonly userAppRoleRepository: Repository<UserAppRoleEntity>,
    @InjectRepository(PendingInvitationEntity)
    private readonly invitationRepository: Repository<PendingInvitationEntity>,
    @InjectRepository(EmailVerificationTokenEntity)
    private readonly emailVerificationTokenRepository: Repository<EmailVerificationTokenEntity>,
    private readonly appAccessService: AppAccessService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get all users with access to an app
   */
  async getAppUsers(appId: string): Promise<AppUser[]> {
    const roles = await this.userAppRoleRepository.find({
      where: { appId },
      order: { createdAt: 'ASC' },
    });

    const users: AppUser[] = [];

    for (const role of roles) {
      // Get user details from better-auth
      const user = await this.getUserById(role.userId);
      if (user) {
        users.push({
          id: user.id,
          email: user.email,
          name: user.name,
          role: role.role,
          isOwner: role.role === 'owner',
          createdAt: role.createdAt.toISOString(),
        });
      }
    }

    // Sort: owners first, then by email
    return users.sort((a, b) => {
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      return a.email.localeCompare(b.email);
    });
  }

  /**
   * Get all users with access to an app, including pending invitations
   */
  async getAppUsersWithPending(appId: string): Promise<AppUserListItem[]> {
    // Get active users
    const roles = await this.userAppRoleRepository.find({
      where: { appId },
      order: { createdAt: 'ASC' },
    });

    const activeUsers: AppUserListItem[] = [];

    for (const role of roles) {
      const user = await this.getUserById(role.userId);
      if (user) {
        activeUsers.push({
          id: user.id,
          email: user.email,
          name: user.name,
          role: role.role,
          isOwner: role.role === 'owner',
          createdAt: role.createdAt.toISOString(),
          status: 'active',
        });
      }
    }

    // Get pending invitations
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

    const pendingUsers: AppUserListItem[] = invitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      createdAt: inv.createdAt.toISOString(),
      status: 'pending' as const,
      invitedBy: inv.inviterId,
      inviterName: inviters.get(inv.inviterId),
    }));

    // Combine and sort: owners first, then active users, then pending by email
    const combined = [...activeUsers, ...pendingUsers];
    return combined.sort((a, b) => {
      // Owners first
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      // Active users before pending
      if (a.status === 'active' && b.status === 'pending') return -1;
      if (a.status === 'pending' && b.status === 'active') return 1;
      // Then by email
      return a.email.localeCompare(b.email);
    });
  }

  /**
   * Add a user to an app by email
   */
  async addUserToApp(appId: string, email: string, role: AppRole): Promise<AppUser> {
    // Find user by email
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found. They must sign up first or be invited.');
    }

    // Check if user already has access
    const existingRole = await this.appAccessService.getUserAppRole(user.id, appId);
    if (existingRole) {
      throw new BadRequestException('User already has access to this app');
    }

    // Cannot add someone as owner (owner is assigned at creation)
    if (role === 'owner') {
      throw new BadRequestException('Cannot assign owner role. Each app has exactly one owner.');
    }

    // Add the role
    const userRole = await this.appAccessService.assignRole(user.id, appId, role);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: userRole.role,
      isOwner: false,
      createdAt: userRole.createdAt.toISOString(),
    };
  }

  /**
   * Remove a user from an app
   */
  async removeUserFromApp(appId: string, userId: string): Promise<void> {
    const role = await this.appAccessService.getUserAppRole(userId, appId);

    if (!role) {
      throw new NotFoundException('User not found in this app');
    }

    if (role === 'owner') {
      throw new BadRequestException('Cannot remove the owner from an app');
    }

    await this.appAccessService.removeAccess(userId, appId);
  }

  /**
   * Search for a user by email
   */
  async searchUserByEmail(email: string): Promise<{ id: string; email: string; name?: string | null } | null> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  /**
   * Update user profile (firstName, lastName)
   */
  async updateProfile(userId: string, data: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    // Validate that at least one name field is provided
    if (!data.firstName && !data.lastName) {
      throw new BadRequestException('At least one of firstName or lastName is required');
    }

    try {
      const db = new Database('./data/app.db');

      // Get current user data
      const currentUser = db.prepare('SELECT id, email, name, firstName, lastName, image, createdAt FROM user WHERE id = ?').get(userId) as {
        id: string;
        email: string;
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        image?: string | null;
        createdAt: string;
      } | undefined;

      if (!currentUser) {
        db.close();
        throw new NotFoundException('User not found');
      }

      // Merge with existing data
      const firstName = data.firstName !== undefined ? data.firstName : currentUser.firstName;
      const lastName = data.lastName !== undefined ? data.lastName : currentUser.lastName;

      // Validate after merge
      if (!firstName && !lastName) {
        db.close();
        throw new BadRequestException('At least one of firstName or lastName must be non-empty');
      }

      // Compute display name
      const name = [firstName, lastName].filter(Boolean).join(' ') || null;

      // Update user record
      db.prepare("UPDATE user SET firstName = ?, lastName = ?, name = ?, updatedAt = datetime('now') WHERE id = ?")
        .run(firstName || null, lastName || null, name, userId);

      // Get updated user
      const updatedUser = db.prepare('SELECT id, email, name, firstName, lastName, image, createdAt FROM user WHERE id = ?').get(userId) as {
        id: string;
        email: string;
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        image?: string | null;
        createdAt: string;
      };

      db.close();

      return {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          image: updatedUser.image,
          createdAt: updatedUser.createdAt,
        },
        message: 'Profile updated successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update profile');
    }
  }

  /**
   * Request email change - creates verification token and sends email
   */
  async requestEmailChange(
    userId: string,
    currentEmail: string,
    data: ChangeEmailRequest,
  ): Promise<ChangeEmailResponse> {
    const { newEmail } = data;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new BadRequestException('Invalid email format');
    }

    // Check if new email is same as current
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      throw new BadRequestException('New email must be different from current email');
    }

    // Check if email is already in use by another user
    const existingUser = await this.getUserByEmail(newEmail);
    if (existingUser) {
      throw new BadRequestException('This email address is already in use');
    }

    // Invalidate any previous tokens for this user
    await this.emailVerificationTokenRepository.update(
      { userId, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    // Generate secure token
    const token = randomBytes(32).toString('hex');

    // Token expires in 24 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create verification token
    const verificationToken = this.emailVerificationTokenRepository.create({
      token,
      userId,
      currentEmail,
      newEmail,
      expiresAt,
    });
    await this.emailVerificationTokenRepository.save(verificationToken);

    // Get user name for email
    const user = await this.getUserById(userId);
    const userName = user?.name || currentEmail;

    // Build verification link
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const verificationLink = `${frontendUrl}/verify-email-change?token=${token}`;

    // Send verification email to the new email address
    await this.emailService.sendEmailChangeVerification(newEmail, {
      userName,
      newEmail,
      verificationLink,
      expiresIn: '24 hours',
    });

    return {
      message: 'Verification email sent. Please check your new email address.',
      pendingEmail: newEmail,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Verify email change - validates token and updates email
   */
  async verifyEmailChange(token: string): Promise<VerifyEmailChangeResponse> {
    // Find the token
    const verificationToken = await this.emailVerificationTokenRepository.findOne({
      where: { token },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Check if already used
    if (verificationToken.usedAt) {
      throw new BadRequestException('This verification link has already been used');
    }

    // Check if expired
    if (new Date() > verificationToken.expiresAt) {
      throw new BadRequestException('This verification link has expired');
    }

    // Check if new email is still available (might have been taken since request)
    const existingUser = await this.getUserByEmail(verificationToken.newEmail);
    if (existingUser && existingUser.id !== verificationToken.userId) {
      throw new BadRequestException('This email address is no longer available');
    }

    try {
      const db = new Database('./data/app.db');

      // Update user email
      db.prepare('UPDATE user SET email = ?, emailVerified = 1, updatedAt = datetime("now") WHERE id = ?')
        .run(verificationToken.newEmail, verificationToken.userId);

      // Get updated user
      const updatedUser = db.prepare('SELECT id, email, name, firstName, lastName, image, createdAt FROM user WHERE id = ?').get(verificationToken.userId) as {
        id: string;
        email: string;
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        image?: string | null;
        createdAt: string;
      };

      db.close();

      // Mark token as used
      await this.emailVerificationTokenRepository.update(
        { id: verificationToken.id },
        { usedAt: new Date() },
      );

      return {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          image: updatedUser.image,
          createdAt: updatedUser.createdAt,
        },
        message: 'Email address updated successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update email address');
    }
  }

  /**
   * Change user password using better-auth API
   */
  async changePassword(
    userId: string,
    data: ChangePasswordRequest,
    sessionToken: string,
  ): Promise<ChangePasswordResponse> {
    const { currentPassword, newPassword, revokeOtherSessions } = data;

    // Validate password length
    if (newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }

    try {
      // Use better-auth's change password API
      const result = await auth.api.changePassword({
        body: {
          currentPassword,
          newPassword,
          revokeOtherSessions: revokeOtherSessions ?? false,
        },
        headers: {
          cookie: `better-auth.session_token=${sessionToken}`,
        },
      });

      if (!result) {
        throw new BadRequestException('Failed to change password');
      }

      return {
        message: 'Password changed successfully',
      };
    } catch (error) {
      // better-auth throws specific errors for invalid password
      if (error instanceof Error) {
        if (error.message.includes('Invalid password') || error.message.includes('incorrect')) {
          throw new BadRequestException('Current password is incorrect');
        }
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Failed to change password');
    }
  }

  /**
   * Clean up expired email verification tokens
   * Can be called on-demand or by a scheduled job
   */
  async cleanupExpiredTokens(): Promise<{ deleted: number }> {
    const result = await this.emailVerificationTokenRepository.delete({
      expiresAt: LessThanOrEqual(new Date()),
    });

    return { deleted: result.affected ?? 0 };
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
      const user = db.prepare('SELECT id, email, name FROM user WHERE email = ?').get(email) as { id: string; email: string; name?: string | null } | undefined;
      db.close();

      return user || null;
    } catch {
      return null;
    }
  }
}
