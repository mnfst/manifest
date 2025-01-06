import { AppManifest, EntityManifest } from '@repo/types'
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common'
import { Request } from 'express'
import { AuthService } from '../../auth/auth.service'
import { ManifestService } from '../services/manifest.service'
import { IsAdminGuard } from '../../auth/guards/is-admin.guard'
import { EntityManifestService } from '../services/entity-manifest.service'

@Controller('manifest')
@UseGuards(IsAdminGuard)
export class ManifestController {
  constructor(
    private manifestService: ManifestService,
    private entityManifestService: EntityManifestService,
    private authService: AuthService
  ) {}

  @Get()
  async getAppManifest(@Req() req: Request): Promise<AppManifest> {
    const isAdmin: boolean = await this.authService.isReqUserAdmin(req)

    return this.manifestService.getAppManifest({ fullVersion: isAdmin })
  }

  @Get('entities/:slug')
  async getEntityManifest(
    @Param('slug') slug: string,
    @Req() req: Request
  ): Promise<EntityManifest> {
    const isAdmin: boolean = await this.authService.isReqUserAdmin(req)

    return this.entityManifestService.getEntityManifest({
      slug,
      fullVersion: isAdmin
    })
  }
}
