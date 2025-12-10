import { Module } from '@nestjs/common'
import { OpenApiService } from './services/open-api.service'
import { OpenApiCrudService } from './services/open-api-crud.service'
import { ManifestModule } from '../manifest/manifest.module'
import { OpenApiManifestService } from './services/open-api-manifest.service'
import { OpenApiAuthService } from './services/open-api-auth.service'
import { OpenApiEndpointService } from './services/open-api.endpoint.service'
import { OpenApiUtilsService } from './services/open-api-utils.service'
import { OpenApiSchemaService } from './services/open-api-schema.service'
import { OpenApiController } from './controllers/open-api.controller'
import { AuthModule } from '../auth/auth.module'
import { EntityModule } from '../entity/entity.module'

@Module({
  imports: [ManifestModule, AuthModule, EntityModule],
  providers: [
    OpenApiService,
    OpenApiCrudService,
    OpenApiManifestService,
    OpenApiAuthService,
    OpenApiEndpointService,
    OpenApiSchemaService,
    OpenApiUtilsService
  ],
  controllers: [OpenApiController]
})
export class OpenApiModule {}
