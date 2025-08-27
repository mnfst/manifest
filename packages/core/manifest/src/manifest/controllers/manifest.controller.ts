import { AppManifest, EntityManifest } from '@repo/types'
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common'
import { Request } from 'express'
import { ManifestService } from '../services/manifest.service'
import { IsAdminGuard } from '../../auth/guards/is-admin.guard'
import { EntityManifestService } from '../services/entity-manifest.service'

@Controller('manifest')
export class ManifestController {
  constructor(
    private manifestService: ManifestService,
    private entityManifestService: EntityManifestService
  ) {}

  /**
   * Get the app name. This endpoint is public.
   *
   * @returns The app name.
   */
  @Get('app-name')
  async getAppName(): Promise<{ name: string }> {
    const manifest = this.manifestService.getAppManifest({
      fullVersion: false
    })
    return { name: manifest.name }
  }

  /**
   * Get the app manifest. This is the main descriptive file of the data structure of the app.
   *
   * @returns The app manifest.
   */
  @Get()
  @UseGuards(IsAdminGuard)
  async getAppManifest(): Promise<AppManifest> {
    return this.manifestService.getAppManifest({ fullVersion: true })
  }

  /**
   * Get the entity manifest for a specific entity. This is the main descriptive file of the data structure of the entity.
   *
   * @param slug The slug of the entity.
   *
   * @returns The entity manifest.
   */
  @Get('entities/:slug')
  @UseGuards(IsAdminGuard)
  async getEntityManifest(
    @Param('slug') slug: string,
    @Req() req: Request
  ): Promise<EntityManifest> {
    return this.entityManifestService.getEntityManifest({
      slug,
      fullVersion: true
    })
  }
}
