import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { AdminAccess } from '../../auth/decorators/admin-access.decorator'
import { AdminAccessGuard } from '../../auth/guards/admin-access.guard'
import { EntityTypeService } from '../../entity/services/entity-type.service'
import { EntityTsTypeInfo } from '../../entity/types/entity-ts-type-info'
import { OpenApiService } from '../services/open-api.service'
import { ManifestService } from '../../manifest/services/manifest.service'
import { JsonSchemaGuard } from '../../manifest/guards/json-schema.guard'

@Controller('open-api')
export class OpenApiController {
  constructor(
    private readonly entityTypeService: EntityTypeService,
    private readonly openApiService: OpenApiService,
    private readonly manifestService: ManifestService
  ) {}

  @AdminAccess('hasApiDocsAccess')
  @UseGuards(AdminAccessGuard)
  @Get()
  getOpenApiDocs() {
    const appManifest = this.manifestService.getAppManifest()

    const entityTypes: EntityTsTypeInfo[] =
      this.entityTypeService.generateEntityTypeInfos(appManifest)

    return this.openApiService.generateOpenApiObject(entityTypes)
  }

  @AdminAccess('hasBackendBuilderAccess')
  @UseGuards(AdminAccessGuard, JsonSchemaGuard)
  @Post('from-manifest')
  generateOpenApiDocsFromManifestFileContent(
    @Body('content') manifestFileContent: string
  ) {
    return this.openApiService.generateOpenApiDocsFromManifestFileContent(
      manifestFileContent
    )
  }
}
