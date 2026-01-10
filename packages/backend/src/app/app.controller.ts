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
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import sharp from 'sharp';
import { AppService } from './app.service';
import { AppAccessGuard, AppAccessService, CurrentUser, type SessionUser } from '../auth';
import type {
  App,
  AppWithFlowCount,
  CreateAppRequest,
  UpdateAppRequest,
  PublishResult,
  DeleteAppResponse,
  IconUploadResponse,
} from '@chatgpt-app-builder/shared';

/**
 * App controller with endpoints for app management
 * - GET /apps - List all apps (with flow counts)
 * - POST /apps - Create app
 * - GET /apps/:appId - Get app by ID
 * - PATCH /apps/:appId - Update app
 * - DELETE /apps/:appId - Delete app
 * - POST /apps/:appId/publish - Publish app
 * - POST /apps/:appId/icon - Upload app icon
 */
@Controller('api')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly appAccessService: AppAccessService
  ) {}

  /**
   * GET /api/apps
   * List apps accessible by current user with flow counts
   */
  @Get('apps')
  async listApps(@CurrentUser() user: SessionUser): Promise<AppWithFlowCount[]> {
    return this.appService.getAppsForUser(user.id);
  }

  /**
   * POST /api/apps
   * Create a new app (creator becomes owner)
   */
  @Post('apps')
  @HttpCode(HttpStatus.CREATED)
  async createApp(
    @Body() request: CreateAppRequest,
    @CurrentUser() user: SessionUser
  ): Promise<App> {
    // Validate name
    if (!request.name || request.name.trim().length === 0) {
      throw new BadRequestException('Name is required');
    }

    if (request.name.length > 100) {
      throw new BadRequestException('Name must be 100 characters or less');
    }

    return this.appService.create(request, user.id);
  }

  /**
   * GET /api/apps/:appId
   * Get app by ID (requires access to the app)
   */
  @Get('apps/:appId')
  @UseGuards(AppAccessGuard)
  async getApp(@Param('appId') appId: string): Promise<App> {
    const app = await this.appService.findById(appId);
    if (!app) {
      throw new NotFoundException('App not found');
    }
    return app;
  }

  /**
   * PATCH /api/apps/:appId
   * Update app (requires access to the app)
   */
  @Patch('apps/:appId')
  @UseGuards(AppAccessGuard)
  async updateApp(
    @Param('appId') appId: string,
    @Body() request: UpdateAppRequest
  ): Promise<App> {
    return this.appService.update(appId, request);
  }

  /**
   * DELETE /api/apps/:appId
   * Delete app and all its flows (owner only)
   */
  @Delete('apps/:appId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AppAccessGuard)
  async deleteApp(
    @Param('appId') appId: string,
    @CurrentUser() user: SessionUser
  ): Promise<DeleteAppResponse> {
    // Only the owner can delete an app
    const isOwner = await this.appAccessService.isOwner(user.id, appId);
    if (!isOwner) {
      throw new ForbiddenException('Only the app owner can delete the app');
    }
    return this.appService.delete(appId);
  }

  /**
   * POST /api/apps/:appId/publish
   * Publish app to MCP server (requires access to the app)
   */
  @Post('apps/:appId/publish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AppAccessGuard)
  async publishAppById(@Param('appId') appId: string): Promise<PublishResult> {
    return this.appService.publish(appId);
  }

  /**
   * POST /api/apps/:appId/icon
   * Upload a custom app icon (requires access to the app)
   * - Accepts PNG, JPG, GIF, WebP
   * - Maximum 5MB
   * - Must be at least 128x128 pixels
   * - Non-square images are automatically cropped to square (center crop)
   */
  @Post('apps/:appId/icon')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AppAccessGuard)
  @UseInterceptors(
    FileInterceptor('icon', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\/(png|jpeg|gif|webp)$/)) {
          cb(new BadRequestException('Invalid file type. Supported formats: PNG, JPG, GIF, WebP'), false);
          return;
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
      },
    })
  )
  async uploadAppIcon(
    @Param('appId') appId: string,
    @UploadedFile() file: Express.Multer.File
  ): Promise<IconUploadResponse> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Get image metadata
    const metadata = await sharp(file.buffer).metadata();
    const { width, height } = metadata;

    if (!width || !height) {
      throw new BadRequestException('Invalid image file');
    }

    if (width < 128 || height < 128) {
      throw new BadRequestException('Image must be at least 128x128 pixels');
    }

    // Calculate square crop dimensions (center crop)
    const size = Math.min(width, height);
    const left = Math.floor((width - size) / 2);
    const top = Math.floor((height - size) / 2);

    // Process image: crop to square and convert to PNG
    const processedBuffer = await sharp(file.buffer)
      .extract({ left, top, width: size, height: size })
      .png()
      .toBuffer();

    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), 'uploads', 'icons');
    await mkdir(uploadDir, { recursive: true });

    // Generate filename and save
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const filename = `${appId}-${uniqueSuffix}.png`;
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, processedBuffer);

    // Update app with new icon URL
    const iconUrl = `/uploads/icons/${filename}`;
    await this.appService.updateIcon(appId, iconUrl);

    return { iconUrl };
  }
}
