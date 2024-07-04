import { AppManifest, EntityManifest } from '@mnfst/types'
import { Controller, Get, Param, Req } from '@nestjs/common'
import { Request } from 'express'
import { AuthService } from '../../auth/auth.service'
import { ManifestService } from '../services/manifest.service'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('Manifest')
@Controller('manifest')
export class ManifestController {
  constructor(
    private manifestService: ManifestService,
    private authService: AuthService
  ) {}

  @Get()
  async getManifest(@Req() req: Request): Promise<AppManifest> {
    const isAdmin: boolean = await this.authService.isReqUserAdmin(req)

    return this.manifestService.getAppManifest({ fullVersion: isAdmin })
  }

  @Get('entities/:slug')
  async getEntityManifest(
    @Param('slug') slug: string,
    @Req() req: Request
  ): Promise<EntityManifest> {
    const isAdmin: boolean = await this.authService.isReqUserAdmin(req)

    return this.manifestService.getEntityManifest({
      slug,
      fullVersion: isAdmin
    })
  }
}
