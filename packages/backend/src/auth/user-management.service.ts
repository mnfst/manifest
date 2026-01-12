import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Database from 'better-sqlite3';
import type { AppRole, AppUser, AppUserListItem } from '@chatgpt-app-builder/shared';
import { UserAppRoleEntity } from './user-app-role.entity';
import { PendingInvitationEntity } from './pending-invitation.entity';
import { AppAccessService } from './app-access.service';

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
    private readonly appAccessService: AppAccessService,
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
