import { Injectable } from '@nestjs/common'
import { OpenApiCrudService } from './open-api-crud.service'
import { OpenAPIObject } from '@nestjs/swagger'
import { ManifestService } from '../../manifest/services/manifest/manifest.service'

@Injectable()
export class OpenApiService {
  constructor(
    private readonly manifestService: ManifestService,
    private readonly openApiCrudService: OpenApiCrudService
  ) {}

  generateOpenApiObject(): OpenAPIObject {}
}
