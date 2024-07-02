import { Module } from '@nestjs/common'
import { OpenApiService } from './services/open-api.service'
import { OpenApiCrudService } from './services/open-api-crud.service'
import { ManifestModule } from '../manifest/manifest.module'
import { OpenApiManifestService } from './services/open-api-manifest.service'

@Module({
  imports: [ManifestModule],
  providers: [OpenApiService, OpenApiCrudService, OpenApiManifestService]
})
export class OpenApiModule {}
