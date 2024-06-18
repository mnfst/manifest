import { Injectable } from '@nestjs/common'
import { OpenApiCrudService } from './open-api-crud.service'
import { OpenAPIObject } from '@nestjs/swagger'
import { ManifestService } from '../../manifest/services/manifest/manifest.service'
import { AppManifest } from '@mnfst/types'

@Injectable()
export class OpenApiService {
  constructor(
    private readonly manifestService: ManifestService,
    private readonly openApiCrudService: OpenApiCrudService
  ) {}

  generateOpenApiObject(): OpenAPIObject {
    const appManifest: AppManifest = this.manifestService.getAppManifest()

    return {
      openapi: '3.0.0',
      info: {
        title: appManifest.name,
        version: '1.0.0'
      },
      paths: this.openApiCrudService.generateEntityPaths(
        Object.values(appManifest.entities)
      ),
      components: {
        schemas: {
          Paginator: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object'
                }
              },
              currentPage: {
                type: 'integer'
              },
              lastPage: {
                type: 'integer'
              },
              from: {
                type: 'integer'
              },
              to: {
                type: 'integer'
              },
              total: {
                type: 'integer'
              },
              perPage: {
                type: 'integer'
              }
            }
          }
        }
      }
    }
  }
}
