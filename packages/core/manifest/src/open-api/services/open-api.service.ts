import { Injectable } from '@nestjs/common'
import { OpenApiCrudService } from './open-api-crud.service'
import { OpenAPIObject } from '@nestjs/swagger'
import { ManifestService } from '../../manifest/services/manifest/manifest.service'
import { AppManifest } from '@mnfst/types'
import { OpenApiManifestService } from './open-api-manifest.service'

@Injectable()
export class OpenApiService {
  constructor(
    private readonly manifestService: ManifestService,
    private readonly openApiCrudService: OpenApiCrudService,
    private readonly openApiManifestService: OpenApiManifestService
  ) {}

  /**
   * Generates the OpenAPI object for the application.
   *
   * @returns The OpenAPI object.
   *
   */
  generateOpenApiObject(): OpenAPIObject {
    const appManifest: AppManifest = this.manifestService.getAppManifest()

    return {
      openapi: '3.1.0',
      info: {
        title: appManifest.name,
        version: '' // Version is not supported yet.
      },
      paths: {
        ...this.openApiCrudService.generateEntityPaths(
          Object.values(appManifest.entities)
        ),
        ...this.openApiManifestService.generateManifestPaths(appManifest)
      },
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
          },
          SelectOption: {
            type: 'object',
            properties: {
              id: {
                type: 'number'
              },
              label: {
                type: 'string'
              }
            }
          },
          AppManifest: {
            type: 'object',
            properties: {
              name: {
                type: 'string'
              },
              entities: {
                type: 'object',
                additionalProperties: {
                  $ref: '#/components/schemas/EntityManifest'
                }
              }
            }
          },
          EntityManifest: {
            type: 'object',
            properties: {
              className: {
                type: 'string'
              },
              nameSingular: {
                type: 'string'
              },
              namePlural: {
                type: 'string'
              },
              slug: {
                type: 'string'
              },
              mainProp: {
                type: 'string'
              },
              seedCount: {
                type: 'number'
              },
              belongsTo: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/RelationshipManifest'
                }
              },
              properties: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/PropertyManifest'
                }
              }
            }
          },
          RelationshipManifest: {
            type: 'object',
            properties: {
              name: {
                type: 'string'
              },
              entity: {
                type: 'string'
              },
              eager: {
                type: 'boolean'
              }
            }
          },
          PropertyManifest: {
            type: 'object',
            properties: {
              name: {
                type: 'string'
              },
              type: {
                type: 'string'
              }
            }
          }
        }
      }
    }
  }
}
