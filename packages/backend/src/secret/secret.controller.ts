import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SecretService } from './secret.service';
import { AppAccessGuard, AppAccessService, CurrentUser, type SessionUser } from '../auth';
import type { AppSecret, CreateSecretRequest, UpdateSecretRequest, SecretListResponse } from '@chatgpt-app-builder/shared';

/**
 * Secret controller with endpoints for secret management
 * - GET /api/apps/:appId/secrets - List secrets for app
 * - POST /api/apps/:appId/secrets - Create secret
 * - PATCH /api/secrets/:secretId - Update secret
 * - DELETE /api/secrets/:secretId - Delete secret
 */
@Controller('api')
export class SecretController {
  constructor(
    private readonly secretService: SecretService,
    private readonly appAccessService: AppAccessService,
  ) {}

  /**
   * GET /api/apps/:appId/secrets
   * List all secrets for an app (requires access to the app)
   */
  @Get('apps/:appId/secrets')
  @UseGuards(AppAccessGuard)
  async listSecrets(@Param('appId') appId: string): Promise<SecretListResponse> {
    const secrets = await this.secretService.listByAppId(appId);
    return { secrets };
  }

  /**
   * POST /api/apps/:appId/secrets
   * Create a new secret (requires access to the app)
   */
  @Post('apps/:appId/secrets')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AppAccessGuard)
  async createSecret(
    @Param('appId') appId: string,
    @Body() request: CreateSecretRequest,
  ): Promise<AppSecret> {
    return this.secretService.create(appId, request);
  }

  /**
   * PATCH /api/secrets/:secretId
   * Update a secret (requires access to the secret's app)
   */
  @Patch('secrets/:secretId')
  async updateSecret(
    @Param('secretId') secretId: string,
    @Body() request: UpdateSecretRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AppSecret> {
    // Get the app ID for this secret to check access
    const appId = await this.secretService.getAppIdForSecret(secretId);
    if (!appId) {
      throw new NotFoundException('Secret not found');
    }

    // Check user has access to the app
    const hasAccess = await this.appAccessService.hasAccess(user.id, appId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this app');
    }

    return this.secretService.update(secretId, request);
  }

  /**
   * DELETE /api/secrets/:secretId
   * Delete a secret (requires access to the secret's app)
   */
  @Delete('secrets/:secretId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSecret(
    @Param('secretId') secretId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    // Get the app ID for this secret to check access
    const appId = await this.secretService.getAppIdForSecret(secretId);
    if (!appId) {
      throw new NotFoundException('Secret not found');
    }

    // Check user has access to the app
    const hasAccess = await this.appAccessService.hasAccess(user.id, appId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this app');
    }

    await this.secretService.delete(secretId);
  }
}
