import { AppManifest, AuthenticableEntity, EntityManifest } from '@mnfst/types'
import { Controller, Get, Param, Req } from '@nestjs/common'
import { Request } from 'express'
import { AuthService } from '../../auth/auth.service'
import { ManifestService } from '../services/manifest.service'
import { ApiTags } from '@nestjs/swagger'
import { ADMIN_ENTITY_MANIFEST } from '../../constants'

@ApiTags('Manifest')
@Controller('manifest')
export class ManifestController {
  constructor(
    private manifestService: ManifestService,
    private authService: AuthService
  ) {}

  @Get()
  async getManifest(@Req() req: Request): Promise<AppManifest> {
    // TODO: Make this cleaner (and below)
    const currentUser: AuthenticableEntity =
      await this.authService.getUserFromRequest(req, ADMIN_ENTITY_MANIFEST.slug)

    return this.manifestService.getAppManifest({ publicVersion: !currentUser })
  }

  @Get('entities/:slug')
  async getEntityManifest(
    @Param('slug') slug: string,
    @Req() req: Request
  ): Promise<EntityManifest> {
    const currentUser: AuthenticableEntity =
      await this.authService.getUserFromRequest(req, ADMIN_ENTITY_MANIFEST.slug)

    return this.manifestService.getEntityManifest({
      slug,
      publicVersion: !currentUser
    })
  }
}
