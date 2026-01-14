import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import type {
  AddUserRequest,
  AppUser,
  AppUserListItem,
  UserProfile,
  UpdateProfileResponse,
  ChangeEmailResponse,
  VerifyEmailChangeResponse,
  ChangePasswordResponse,
  DefaultUserCheckResponse,
} from '@chatgpt-app-builder/shared';
import { UserManagementService } from './user-management.service';
import { AppAccessGuard } from './app-access.guard';
import { AppAccessService } from './app-access.service';
import { CurrentUser, type SessionUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { VerifyEmailChangeDto } from './dto/verify-email-change.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

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
   * Update current user profile (firstName, lastName)
   */
  @Patch('users/me')
  async updateProfile(
    @CurrentUser() user: SessionUser,
    @Body() body: UpdateProfileDto,
  ): Promise<UpdateProfileResponse> {
    return this.userManagementService.updateProfile(user.id, body);
  }

  /**
   * Request email change - sends verification email to new address
   */
  @Post('users/me/email')
  async requestEmailChange(
    @CurrentUser() user: SessionUser,
    @Body() body: ChangeEmailDto,
  ): Promise<ChangeEmailResponse> {
    return this.userManagementService.requestEmailChange(user.id, user.email, body);
  }

  /**
   * Verify email change - validates token and updates email
   */
  @Post('users/me/email/verify')
  async verifyEmailChange(
    @Body() body: VerifyEmailChangeDto,
  ): Promise<VerifyEmailChangeResponse> {
    return this.userManagementService.verifyEmailChange(body.token);
  }

  /**
   * Change password - requires current password
   */
  @Post('users/me/password')
  async changePassword(
    @CurrentUser() user: SessionUser,
    @Body() body: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<ChangePasswordResponse> {
    // Extract session token from cookies
    const sessionToken = req.cookies?.['better-auth.session_token'];
    if (!sessionToken) {
      throw new BadRequestException('Session not found. Please log in again.');
    }

    return this.userManagementService.changePassword(user.id, body, sessionToken);
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

  /**
   * Check if default admin user exists (public - no auth required)
   * Returns credentials if the default user exists with default password.
   * Used to pre-fill login form for development convenience.
   */
  @Get('users/default-user')
  @Public()
  async checkDefaultUser(): Promise<DefaultUserCheckResponse> {
    return this.userManagementService.checkDefaultUserExists();
  }
}
