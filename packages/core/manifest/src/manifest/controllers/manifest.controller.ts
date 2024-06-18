import { AppManifest, AuthenticableEntity, EntityManifest } from '@mnfst/types'
import { Controller, Get, Param, Req } from '@nestjs/common'
import { Request } from 'express'
import { AuthService } from '../../auth/auth.service'
import { ManifestService } from '../services/manifest/manifest.service'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('Manifest')
@Controller('manifest')
export class ManifestController {
  constructor(
    private manifestService: ManifestService,
    private authService: AuthService
  ) {}

  @Get()
  async getPublicManifest(@Req() req: Request): Promise<AppManifest> {
    const currentUser: AuthenticableEntity =
      await this.authService.getUserFromRequest(req, 'admins')

    return this.manifestService.getAppManifest({ publicVersion: !currentUser })
  }

  @Get('entities/:slug')
  async getEntityPublicManifest(
    @Param('slug') slug: string,
    @Req() req: Request
  ): Promise<EntityManifest> {
    const currentUser: AuthenticableEntity =
      await this.authService.getUserFromRequest(req, 'admins')

    return this.manifestService.getEntityManifest({
      slug,
      publicVersion: !currentUser
    })
  }
}
