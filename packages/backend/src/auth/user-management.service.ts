import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Database from 'better-sqlite3';
import type { AppRole, AppUser } from '@chatgpt-app-builder/shared';
import { UserAppRoleEntity } from './user-app-role.entity';
import { AppAccessService } from './app-access.service';

/**
 * Service for managing user access to apps
 */
@Injectable()
export class UserManagementService {
  constructor(
    @InjectRepository(UserAppRoleEntity)
    private readonly userAppRoleRepository: Repository<UserAppRoleEntity>,
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
   * Add a user to an app by email
   */
  async addUserToApp(appId: string, email: string, role: AppRole): Promise<AppUser> {
    // Find user by email
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found. They must sign up first.');
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
