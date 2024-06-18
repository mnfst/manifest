import { EntityManifest } from '@mnfst/types'
import { Injectable } from '@nestjs/common'
import { PathItemObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

@Injectable()
export class OpenApiCrudService {
  generateEntityPaths(
    entityManifests: EntityManifest[]
  ): Record<string, PathItemObject> {
    const paths: Record<string, PathItemObject> = {}

    entityManifests.forEach((entityManifest: EntityManifest) => {
      paths[`/api/dynamic/${entityManifest.slug}`] = {
        ...this.generateListPath(entityManifest),
        ...this.generateCreatePath(entityManifest)
      }
      paths[`/api/dynamic/${entityManifest.slug}/select-options`] =
        this.generateListSelectOptionsPath(entityManifest)
      paths[`/api/dynamic/${entityManifest.slug}/{id}`] = {
        ...this.generateDetailPath(entityManifest),
        ...this.generateUpdatePath(entityManifest),
        ...this.generateDeletePath(entityManifest)
      }
    })

    return paths
  }

  generateListPath(entityManifest: EntityManifest): PathItemObject {
    return {
      get: {
        summary: `List ${entityManifest.namePlural}`,
        description: `Retrieves a paginated list of ${entityManifest.namePlural}. In addition to the general parameters below, each property of the ${entityManifest.nameSingular} can be used as a filter: https://manifest.build/docs/rest-api#filters`,
        tags: [entityManifest.namePlural],
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'The page number',
            required: false,
            schema: {
              type: 'integer',
              default: 1
            }
          },
          {
            name: 'perPage',
            in: 'query',
            description: 'The number of items per page',
            required: false,
            schema: {
              type: 'integer',
              default: 10
            }
          },
          {
            name: 'orderBy',
            in: 'query',
            description: 'The field to order by',
            required: false,
            schema: {
              type: 'string'
            }
          },
          {
            name: 'order',
            in: 'query',
            description: 'The order direction',
            required: false,
            schema: {
              type: 'string',
              enum: ['ASC', 'DESC']
            }
          },
          {
            name: 'relations',
            in: 'query',
            description:
              'The relations to include. For several relations, use a comma-separated list',
            required: false,
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Paginator'
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  generateListSelectOptionsPath(
    entityManifest: EntityManifest
  ): PathItemObject {
    return {
      get: {
        summary: `List ${entityManifest.namePlural} for select options`,
        tags: [entityManifest.namePlural],
        responses: {
          '200': {
            description: `List of ${entityManifest.namePlural} for select options`,
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: `#/components/schemas/${entityManifest.slug}`
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  generateCreatePath(entityManifest: EntityManifest): PathItemObject {
    return {
      post: {
        summary: `Create ${entityManifest.nameSingular}`,
        tags: [entityManifest.namePlural],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: `#/components/schemas/${entityManifest.slug}`
              }
            }
          }
        },
        responses: {
          '201': {
            description: `The ${entityManifest.nameSingular} has been successfully created`
          }
        }
      }
    }
  }

  generateDetailPath(entityManifest: EntityManifest): PathItemObject {
    return {
      get: {
        summary: `Get ${entityManifest.nameSingular}`,
        tags: [entityManifest.namePlural],
        responses: {
          '200': {
            description: `The ${entityManifest.nameSingular}`,
            content: {
              'application/json': {
                schema: {
                  $ref: `#/components/schemas/${entityManifest.slug}`
                }
              }
            }
          }
        }
      }
    }
  }

  generateUpdatePath(entityManifest: EntityManifest): PathItemObject {
    return {
      put: {
        summary: `Update ${entityManifest.nameSingular}`,
        tags: [entityManifest.namePlural],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: `#/components/schemas/${entityManifest.slug}`
              }
            }
          }
        },
        responses: {
          '200': {
            description: `The ${entityManifest.nameSingular} has been successfully updated`
          }
        }
      }
    }
  }

  generateDeletePath(entityManifest: EntityManifest): PathItemObject {
    return {
      delete: {
        summary: `Delete ${entityManifest.nameSingular}`,
        tags: [entityManifest.namePlural],
        responses: {
          '200': {
            description: `The ${entityManifest.nameSingular} has been successfully deleted`
          }
        }
      }
    }
  }
}
