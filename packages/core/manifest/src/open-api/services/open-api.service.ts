import { Injectable } from '@nestjs/common'
import { OpenApiCrudService } from './open-api-crud.service'
import { OpenAPIObject } from '@nestjs/swagger'
import { ManifestService } from '../../manifest/services/manifest.service'
import { AppManifest } from '@repo/types'
import { OpenApiManifestService } from './open-api-manifest.service'
import { OpenApiAuthService } from './open-api-auth.service'
import { OpenApiEndpointService } from './open-api.endpoint.service'
import { ConfigService } from '@nestjs/config'
import { API_PATH } from '../../constants'
import { EntityTsTypeInfo } from '../../entity/types/entity-ts-type-info'
import { OpenApiSchemaService } from './open-api-schema.service'

@Injectable()
export class OpenApiService {
  constructor(
    private readonly manifestService: ManifestService,
    private readonly openApiCrudService: OpenApiCrudService,
    private readonly openApiManifestService: OpenApiManifestService,
    private readonly openApiAuthService: OpenApiAuthService,
    private readonly openApiEndpointService: OpenApiEndpointService,
    private readonly openApiSchemaService: OpenApiSchemaService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Generates the OpenAPI object for the application.
   *
   * @param entityTypeInfos - An array of EntityTypeInfo objects that describe the entities in the application.
   *
   * @returns The OpenAPI object.
   *
   */
  generateOpenApiObject(entityTypeInfos: EntityTsTypeInfo[]): OpenAPIObject {
    const appManifest: AppManifest = this.manifestService.getAppManifest()

    return {
      openapi: '3.1.0',
      info: {
        title: appManifest.name,
        version: appManifest.version
      },
      servers: [
        {
          url: `${this.configService.get('baseUrl')}/${API_PATH}`,
          description: `${this.configService.get('nodeEnv') === 'production' ? 'Production' : 'Development'} server`
        }
      ],
      paths: {
        ...this.openApiCrudService.generateEntityPaths(
          Object.values(appManifest.entities)
        ),
        ...this.openApiManifestService.generateManifestPaths(appManifest),
        ...this.openApiAuthService.generateAuthPaths(appManifest),
        ...this.openApiEndpointService.generateEndpointPaths(
          appManifest.endpoints
        )
      },
      components: {
        schemas: Object.assign(
          {},
          this.openApiSchemaService.generateEntitySchemas(entityTypeInfos),
          this.openApiSchemaService.getGeneralSchemas()
        ),
        securitySchemes: this.openApiAuthService.getSecuritySchemes(appManifest)
      }
    }
  }
}
