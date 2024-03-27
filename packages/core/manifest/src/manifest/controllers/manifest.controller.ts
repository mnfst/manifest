import { AppManifest, EntityManifest } from '@casejs/types'
import { Controller, Get, Param } from '@nestjs/common'
import { ManifestService } from '../services/manifest/manifest.service'

@Controller('manifest')
export class ManifestController {
  constructor(private manifestService: ManifestService) {}

  @Get()
  getPublicManifest(): AppManifest {
    return this.manifestService.getAppManifest({ publicVersion: true })
  }

  @Get('entities/:slug')
  getEntityPublicManifest(@Param('slug') slug: string): EntityManifest {
    return this.manifestService.getEntityManifest({
      slug,
      publicVersion: true
    })
  }
}
