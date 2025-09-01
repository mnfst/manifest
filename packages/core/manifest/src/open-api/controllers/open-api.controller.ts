import { Controller, Get, UseGuards } from '@nestjs/common'
import { AdminAccess } from '../../auth/decorators/admin-access.decorator'
import { AdminAccessGuard } from '../../auth/guards/admin-access.guard'
import { EntityTypeService } from '../../entity/services/entity-type.service'
import { EntityTsTypeInfo } from '../../entity/types/entity-ts-type-info'
import { OpenApiService } from '../services/open-api.service'

@Controller('open-api')
export class OpenApiController {
  constructor(
    private readonly entityTypeService: EntityTypeService,
    private openApiService: OpenApiService
  ) {}

  @AdminAccess('hasApiDocsAccess')
  @UseGuards(AdminAccessGuard)
  @Get()
  getOpenApiDocumentation() {
    // Logic to generate and return OpenAPI documentation

    const entityTypes: EntityTsTypeInfo[] =
      this.entityTypeService.generateEntityTypeInfos()

    return this.openApiService.generateOpenApiObject(entityTypes)
  }
}
