import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AppRole } from '@manifest/shared';
import { UserAppRoleEntity } from './user-app-role.entity';

/**
 * Service to check user-app permissions
 * Used by AppAccessGuard and other services needing authorization checks
 */
@Injectable()
export class AppAccessService {
  constructor(
    @InjectRepository(UserAppRoleEntity)
    private readonly userAppRoleRepository: Repository<UserAppRoleEntity>,
  ) {}

  /**
   * Check if a user has access to an app
   * @returns The user's role if they have access, null otherwise
   */
  async getUserAppRole(userId: string, appId: string): Promise<AppRole | null> {
    const role = await this.userAppRoleRepository.findOne({
      where: { userId, appId },
    });

    return role?.role ?? null;
  }

  /**
   * Check if a user has any access to an app
   */
  async hasAccess(userId: string, appId: string): Promise<boolean> {
    const role = await this.getUserAppRole(userId, appId);
    return role !== null;
  }

  /**
   * Check if a user is an owner of an app
   */
  async isOwner(userId: string, appId: string): Promise<boolean> {
    const role = await this.getUserAppRole(userId, appId);
    return role === 'owner';
  }

  /**
   * Check if a user can manage users on an app (owner or admin)
   */
  async canManageUsers(userId: string, appId: string): Promise<boolean> {
    const role = await this.getUserAppRole(userId, appId);
    return role === 'owner' || role === 'admin';
  }

  /**
   * Get all apps a user has access to
   */
  async getAppIdsForUser(userId: string): Promise<string[]> {
    const roles = await this.userAppRoleRepository.find({
      where: { userId },
      select: ['appId'],
    });

    return roles.map((r) => r.appId);
  }

  /**
   * Assign a user to an app with a role
   */
  async assignRole(userId: string, appId: string, role: AppRole): Promise<UserAppRoleEntity> {
    const existing = await this.userAppRoleRepository.findOne({
      where: { userId, appId },
    });

    if (existing) {
      existing.role = role;
      return this.userAppRoleRepository.save(existing);
    }

    const newRole = this.userAppRoleRepository.create({
      userId,
      appId,
      role,
    });

    return this.userAppRoleRepository.save(newRole);
  }

  /**
   * Remove a user's access to an app
   */
  async removeAccess(userId: string, appId: string): Promise<void> {
    await this.userAppRoleRepository.delete({ userId, appId });
  }
}
