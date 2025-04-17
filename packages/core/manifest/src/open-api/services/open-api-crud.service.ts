import { EntityManifest, PolicyManifest } from '@repo/types'
import { Injectable } from '@nestjs/common'
import { PathItemObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { upperCaseFirstLetter } from '@repo/common'
import { API_PATH, COLLECTIONS_PATH, SINGLES_PATH } from '../../constants'
import { OpenApiUtilsService } from './open-api-utils.service'

@Injectable()
export class OpenApiCrudService {
  constructor(private readonly openApiUtilsService: OpenApiUtilsService) {}

  /**
   * Generates the paths for the entities. For each entity, it generates the paths for listing, creating, updating and deleting.
   *
   * @param entityManifests The entity manifests.
   * @returns The paths object.
   *
   */
  generateEntityPaths(
    entityManifests: EntityManifest[]
  ): Record<string, PathItemObject> {
    const paths: Record<string, PathItemObject> = {}

    // Collection paths.
    entityManifests
      .filter((entityManifest: EntityManifest) => !entityManifest.single)
      .forEach((entityManifest: EntityManifest) => {
        paths[`/${API_PATH}/${COLLECTIONS_PATH}/${entityManifest.slug}`] = {}
        paths[`/${API_PATH}/${COLLECTIONS_PATH}/${entityManifest.slug}/{id}`] =
          {}
        paths[
          `/${API_PATH}/${COLLECTIONS_PATH}/${entityManifest.slug}/select-options`
        ] = {}

        // Create.
        if (this.isNotForbidden(entityManifest.policies.create)) {
          Object.assign(
            paths[`/${API_PATH}/${COLLECTIONS_PATH}/${entityManifest.slug}`],
            this.generateCreatePath(entityManifest)
          )
        }

        // Read.
        if (this.isNotForbidden(entityManifest.policies.read)) {
          Object.assign(
            paths[`/${API_PATH}/${COLLECTIONS_PATH}/${entityManifest.slug}`],
            this.generateListPath(entityManifest)
          )
          Object.assign(
            paths[
              `/${API_PATH}/${COLLECTIONS_PATH}/${entityManifest.slug}/{id}`
            ],
            this.generateDetailPath(entityManifest)
          )
          Object.assign(
            paths[
              `/${API_PATH}/${COLLECTIONS_PATH}/${entityManifest.slug}/select-options`
            ],
            this.generateListSelectOptionsPath(entityManifest)
          )
        }

        // Update.
        if (this.isNotForbidden(entityManifest.policies.update)) {
          Object.assign(
            paths[
              `/${API_PATH}/${COLLECTIONS_PATH}/${entityManifest.slug}/{id}`
            ],
            this.generateUpdatePath(entityManifest),
            this.generatePatchPath(entityManifest)
          )
        }

        // Delete.
        if (this.isNotForbidden(entityManifest.policies.delete)) {
          Object.assign(
            paths[
              `/${API_PATH}/${COLLECTIONS_PATH}/${entityManifest.slug}/{id}`
            ],
            this.generateDeletePath(entityManifest)
          )
        }
      })

    // Single paths.
    entityManifests
      .filter((entityManifest: EntityManifest) => entityManifest.single)
      .forEach((entityManifest: EntityManifest) => {
        // Read.
        if (this.isNotForbidden(entityManifest.policies.read)) {
          paths[`/${API_PATH}/${SINGLES_PATH}/${entityManifest.slug}`] = {
            ...this.generateDetailPath(entityManifest, true)
          }
        }

        if (this.isNotForbidden(entityManifest.policies.update)) {
          paths[`/${API_PATH}/${SINGLES_PATH}/${entityManifest.slug}`] = {
            ...this.generateDetailPath(entityManifest, true),
            ...this.generatePatchPath(entityManifest, true)
          }
        }
      })

    return paths
  }

  /**
   * Generates the path for listing entities.
   *
   * @param entityManifest The entity manifest.
   * @returns The path item object.
   *
   */
  generateListPath(entityManifest: EntityManifest): PathItemObject {
    return {
      get: {
        summary: `List ${entityManifest.namePlural}`,
        description: `Retrieves a paginated list of ${entityManifest.namePlural}. In addition to the general parameters below, each property of the ${entityManifest.nameSingular} can be used as a filter: https://manifest.build/docs/rest-api#filters`,
        tags: [upperCaseFirstLetter(entityManifest.namePlural)],
        security: this.openApiUtilsService.getSecurityRequirements(
          entityManifest.policies.read
        ),
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
                  $ref: '#/components/schemas/Paginator'
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Generates the path for listing entities for select options.
   * This is used to fill select dropdown options.
   *
   * @param entityManifest The entity manifest.
   * @returns The path item object.
   *
   */
  generateListSelectOptionsPath(
    entityManifest: EntityManifest
  ): PathItemObject {
    return {
      get: {
        summary: `List ${entityManifest.namePlural} for select options`,
        description: `Retrieves a list of ${entityManifest.namePlural} for select options. The response is an array of objects with the properties 'id' and 'label'. Used in the admin panel to fill select dropdowns.`,
        tags: [upperCaseFirstLetter(entityManifest.namePlural)],
        security: [
          {
            Admin: []
          }
        ],
        responses: {
          '200': {
            description: `List of ${entityManifest.namePlural} for select options`,
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: `#/components/schemas/SelectOption`
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Generates the path for creating an entity.
   * This is used to create a new entity.
   *
   * @param entityManifest The entity manifest.
   * @returns The path item object.
   *
   */
  generateCreatePath(entityManifest: EntityManifest): PathItemObject {
    return {
      post: {
        summary: `Create a new ${entityManifest.nameSingular}`,
        description: `Creates a new ${entityManifest.nameSingular} passing the properties in the request body as JSON.`,
        tags: [upperCaseFirstLetter(entityManifest.namePlural)],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object'
              }
            }
          }
        },
        security: this.openApiUtilsService.getSecurityRequirements(
          entityManifest.policies.create
        ),
        responses: {
          '201': {
            description: `OK`
          },
          '400': {
            description: `Bad request`
          }
        }
      }
    }
  }

  /**
   * Generates the path for retrieving the details of an entity.
   *
   * @param entityManifest The entity manifest.
   * @param single Whether the entity is a single entity (defaults to false -> collection).
   *
   * @returns The path item object.
   *
   */
  generateDetailPath(
    entityManifest: EntityManifest,
    single?: boolean
  ): PathItemObject {
    return {
      get: {
        summary: `Get a single ${entityManifest.nameSingular}`,
        description: `Retrieves the details of a single ${entityManifest.nameSingular} by its ID.`,
        tags: [
          upperCaseFirstLetter(
            entityManifest.namePlural || entityManifest.nameSingular
          )
        ],
        parameters: single
          ? []
          : [
              {
                name: 'id',
                in: 'path',
                description: `The ID of the ${entityManifest.nameSingular}`,
                required: true,
                schema: {
                  type: 'integer'
                }
              }
            ],
        security: this.openApiUtilsService.getSecurityRequirements(
          entityManifest.policies.read
        ),
        responses: {
          '200': {
            description: `OK`,
            content: {
              'application/json': {
                schema: {
                  type: 'object'
                }
              }
            }
          },
          '404': {
            description: `The ${entityManifest.nameSingular} was not found`
          }
        }
      }
    }
  }

  /**
   * Generates the path for updating an entity.
   *
   * @param entityManifest The entity manifest.
   * @param single Whether the entity is a single entity (defaults to false -> collection).
   *
   * @returns The path item object.
   *
   */
  generateUpdatePath(
    entityManifest: EntityManifest,
    single?: boolean
  ): PathItemObject {
    return {
      put: {
        summary: `Update an existing ${entityManifest.nameSingular} (full replace)`,
        description: `Updates a single ${entityManifest.nameSingular} by its ID. The properties to update are passed in the request body as JSON. This operation fully replaces the entity and its relations. Leaving a property out will remove it.`,
        tags: [
          upperCaseFirstLetter(
            entityManifest.namePlural || entityManifest.nameSingular
          )
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object'
              }
            }
          }
        },
        parameters: single
          ? []
          : [
              {
                name: 'id',
                in: 'path',
                description: `The ID of the ${entityManifest.nameSingular}`,
                required: true,
                schema: {
                  type: 'integer'
                }
              }
            ],
        security: this.openApiUtilsService.getSecurityRequirements(
          entityManifest.policies.update
        ),
        responses: {
          '200': {
            description: `OK`,
            content: {
              'application/json': {
                schema: {
                  type: 'object'
                }
              }
            }
          },
          '404': {
            description: `Not found`
          }
        }
      }
    }
  }

  /**
   * Generates the path for partially updating an entity.
   *
   * @param entityManifest The entity manifest.
   * @param single Whether the entity is a single entity (defaults to false -> collection).
   *
   * @returns The path item object.
   */
  generatePatchPath(
    entityManifest: EntityManifest,
    single?: boolean
  ): PathItemObject {
    return {
      patch: {
        summary: `Update an existing ${entityManifest.nameSingular} (partial update)`,
        description: `Updates a single ${entityManifest.nameSingular} by its ID. The properties to update are passed in the request body as JSON. This operation partially updates the entity and its relations. Leaving a property out will not remove it.`,
        tags: [
          upperCaseFirstLetter(
            entityManifest.namePlural || entityManifest.nameSingular
          )
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object'
              }
            }
          }
        },
        parameters: single
          ? []
          : [
              {
                name: 'id',
                in: 'path',
                description: `The ID of the ${entityManifest.nameSingular}`,
                required: true,
                schema: {
                  type: 'integer'
                }
              }
            ],
        security: this.openApiUtilsService.getSecurityRequirements(
          entityManifest.policies.update
        ),
        responses: {
          '200': {
            description: `OK`,
            content: {
              'application/json': {
                schema: {
                  type: 'object'
                }
              }
            }
          },
          '404': {
            description: `Not found`
          }
        }
      }
    }
  }

  /**
   * Generates the path for deleting an entity.
   *
   * @param entityManifest The entity manifest.
   * @returns The path item object.
   *
   */
  generateDeletePath(entityManifest: EntityManifest): PathItemObject {
    return {
      delete: {
        summary: `Delete an existing ${entityManifest.nameSingular}`,
        description: `Deletes a single ${entityManifest.nameSingular} by its ID.`,
        tags: [upperCaseFirstLetter(entityManifest.namePlural)],
        parameters: [
          {
            name: 'id',
            in: 'path',
            description: `The ID of the ${entityManifest.nameSingular}`,
            required: true,
            schema: {
              type: 'integer'
            }
          }
        ],
        security: this.openApiUtilsService.getSecurityRequirements(
          entityManifest.policies.delete
        ),
        responses: {
          '200': {
            description: `OK`
          },
          '404': {
            description: `The ${entityManifest.nameSingular} was not found`
          }
        }
      }
    }
  }

  /**
   * Checks if the policies are not forbidden.
   *
   * @param policies - The policies to check.
   *
   * @returns True if none of the policies are forbidden, false otherwise.
   */
  isNotForbidden(policies: PolicyManifest[]): boolean {
    return policies.every((policy) => {
      return policy.access !== 'forbidden'
    })
  }
}
