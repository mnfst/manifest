import { AppManifest, EntityManifest } from '@repo/types'
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common'
import { Request } from 'express'
import { ManifestService } from '../services/manifest.service'
import { IsAdminGuard } from '../../auth/guards/is-admin.guard'
import { EntityManifestService } from '../services/entity-manifest.service'
import { YamlService } from '../services/yaml.service'
import { ConfigService } from '@nestjs/config'

@Controller('manifest')
export class ManifestController {
  constructor(
    private manifestService: ManifestService,
    private yamlService: YamlService,
    private entityManifestService: EntityManifestService,
    private configService: ConfigService
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

  @Get('file')
  @UseGuards(IsAdminGuard)
  async getManifestFileContent(): Promise<{ content: string }> {
    return {
      content: await this.yamlService.loadFileContent(
        this.configService.get('paths').manifestFile
      )
    }
  }

  @Post('file')
  @UseGuards(IsAdminGuard)
  async saveManifestFileContent(
    @Body() body: { content: string }
  ): Promise<void> {
    await this.yamlService.saveFileContent(
      this.configService.get('paths').manifestFile,
      body.content
    )
  }
}
