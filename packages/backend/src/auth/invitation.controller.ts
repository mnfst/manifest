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
import type {
  CreateInvitationRequest,
  PendingInvitation,
  InvitationValidation,
  AcceptInvitationRequest,
  AcceptInvitationResponse,
} from '@chatgpt-app-builder/shared';
import { InvitationService } from './invitation.service';
import { AppAccessGuard } from './app-access.guard';
import { AppAccessService } from './app-access.service';
import { CurrentUser, type SessionUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

/**
 * Controller for invitation management endpoints
 */
@Controller('api')
export class InvitationController {
  constructor(
    private readonly invitationService: InvitationService,
    private readonly appAccessService: AppAccessService,
  ) {}

  /**
   * Create an invitation to an app
   */
  @Post('apps/:appId/invitations')
  @UseGuards(AppAccessGuard)
  async createInvitation(
    @Param('appId') appId: string,
    @Body() body: CreateInvitationRequest,
    @CurrentUser() currentUser: SessionUser,
  ): Promise<PendingInvitation> {
    // Check if caller can manage users
    const canManage = await this.appAccessService.canManageUsers(currentUser.id, appId);
    if (!canManage) {
      throw new NotFoundException('App not found');
    }

    return this.invitationService.createInvitation(
      appId,
      body.email,
      body.role,
      currentUser.id,
      currentUser.name || currentUser.email,
    );
  }

  /**
   * List pending invitations for an app
   */
  @Get('apps/:appId/invitations')
  @UseGuards(AppAccessGuard)
  async listInvitations(
    @Param('appId') appId: string,
    @CurrentUser() currentUser: SessionUser,
  ): Promise<PendingInvitation[]> {
    // Check if caller can manage users
    const canManage = await this.appAccessService.canManageUsers(currentUser.id, appId);
    if (!canManage) {
      throw new NotFoundException('App not found');
    }

    return this.invitationService.listPendingInvitations(appId);
  }

  /**
   * Revoke a pending invitation
   */
  @Delete('apps/:appId/invitations/:invitationId')
  @UseGuards(AppAccessGuard)
  async revokeInvitation(
    @Param('appId') appId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() currentUser: SessionUser,
  ): Promise<void> {
    // Check if caller can manage users
    const canManage = await this.appAccessService.canManageUsers(currentUser.id, appId);
    if (!canManage) {
      throw new NotFoundException('App not found');
    }

    await this.invitationService.revokeInvitation(invitationId, appId);
  }

  /**
   * Resend an invitation email
   */
  @Post('apps/:appId/invitations/:invitationId/resend')
  @UseGuards(AppAccessGuard)
  async resendInvitation(
    @Param('appId') appId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() currentUser: SessionUser,
  ): Promise<PendingInvitation> {
    // Check if caller can manage users
    const canManage = await this.appAccessService.canManageUsers(currentUser.id, appId);
    if (!canManage) {
      throw new NotFoundException('App not found');
    }

    return this.invitationService.resendInvitation(
      invitationId,
      appId,
      currentUser.name || currentUser.email,
    );
  }

  /**
   * Validate an invitation token (public - no auth required)
   */
  @Get('invitations/validate')
  @Public()
  async validateToken(
    @Query('token') token: string,
  ): Promise<InvitationValidation> {
    if (!token) {
      throw new NotFoundException('Token is required');
    }
    return this.invitationService.validateToken(token);
  }

  /**
   * Accept an invitation (requires authentication)
   */
  @Post('invitations/accept')
  async acceptInvitation(
    @Body() body: AcceptInvitationRequest,
    @CurrentUser() currentUser: SessionUser,
  ): Promise<AcceptInvitationResponse> {
    return this.invitationService.acceptInvitation(
      body.token,
      currentUser.id,
      currentUser.email,
    );
  }
}
