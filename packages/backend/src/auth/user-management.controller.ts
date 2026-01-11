import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import type { AddUserRequest, AppUser, AppUserListItem, UserProfile } from '@chatgpt-app-builder/shared';
import { UserManagementService } from './user-management.service';
import { AppAccessGuard } from './app-access.guard';
import { AppAccessService } from './app-access.service';
import { CurrentUser, type SessionUser } from './decorators/current-user.decorator';

/**
 * Controller for user management endpoints
 * All endpoints require authentication via global AuthGuard
 */
@Controller('api')
export class UserManagementController {
  constructor(
    private readonly userManagementService: UserManagementService,
    private readonly appAccessService: AppAccessService,
  ) {}

  /**
   * Get current user profile
   */
  @Get('users/me')
  async getCurrentUser(@CurrentUser() user: SessionUser): Promise<UserProfile> {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Search users by email
   */
  @Get('users/search')
  async searchUsers(@Query('email') email: string): Promise<UserProfile> {
    const user = await this.userManagementService.searchUserByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: '', // Not exposed in search
    };
  }

  /**
   * List users with access to an app, including pending invitations
   * Returns 404 if user doesn't have access to the app
   */
  @Get('apps/:appId/users')
  @UseGuards(AppAccessGuard)
  async listAppUsers(@Param('appId') appId: string): Promise<AppUserListItem[]> {
    return this.userManagementService.getAppUsersWithPending(appId);
  }

  /**
   * Add a user to an app
   * Only owners and admins can add users
   * Returns 404 if caller doesn't have access
   */
  @Post('apps/:appId/users')
  @UseGuards(AppAccessGuard)
  async addUserToApp(
    @Param('appId') appId: string,
    @Body() body: AddUserRequest,
    @CurrentUser() currentUser: SessionUser,
  ): Promise<AppUser> {
    // Check if caller can manage users
    const canManage = await this.appAccessService.canManageUsers(currentUser.id, appId);
    if (!canManage) {
      throw new NotFoundException('App not found');
    }

    return this.userManagementService.addUserToApp(appId, body.email, body.role);
  }

  /**
   * Remove a user from an app
   * Only owners and admins can remove users (except owner)
   * Returns 404 if caller doesn't have access
   */
  @Delete('apps/:appId/users/:userId')
  @UseGuards(AppAccessGuard)
  async removeUserFromApp(
    @Param('appId') appId: string,
    @Param('userId') userId: string,
    @CurrentUser() currentUser: SessionUser,
  ): Promise<void> {
    // Check if caller can manage users
    const canManage = await this.appAccessService.canManageUsers(currentUser.id, appId);
    if (!canManage) {
      throw new NotFoundException('App not found');
    }

    await this.userManagementService.removeUserFromApp(appId, userId);
  }
}
