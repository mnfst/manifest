import { AppManifest } from '@casejs/types'
import { Controller, Get } from '@nestjs/common'
import { ManifestService } from './services/manifest/manifest.service'

@Controller('manifest')
export class ManifestController {
  constructor(private manifestService: ManifestService) {}

  @Get()
  getPublicManifest(): AppManifest {
    return this.manifestService.getAppManifest({ publicVersion: true })
  }
}
