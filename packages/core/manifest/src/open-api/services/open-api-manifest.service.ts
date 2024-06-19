import { AppManifest, EntityManifest } from '@mnfst/types'
import { Injectable } from '@nestjs/common'
import { PathItemObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

@Injectable()
export class OpenApiManifestService {
  /**
   * Generates the paths for the manifest endpoints.
   *
   * @param appManifest The manifest of the application.
   * @returns The paths for the manifest endpoints.
   *
   */
  generateManifestPaths(
    appManifest: AppManifest
  ): Record<string, PathItemObject> {
    const paths: Record<string, PathItemObject> = {
      '/api/manifest': {
        get: {
          summary: 'Get the manifest',
          description: 'Retrieves the manifest of the application.',
          tags: ['Manifest'],
          responses: {
            '200': {
              description: 'The manifest of the application.',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/AppManifest'
                  }
                }
              }
            }
          }
        }
      }
    }

    Object.values(appManifest.entities).forEach(
      (entityManifest: EntityManifest) => {
        paths[`/api/manifest/entities/${entityManifest.slug}`] =
          this.generateEntityManifestPath(entityManifest)
      }
    )

    return paths
  }

  /**
   * Generates the path for the entity manifest endpoint.
   *
   * @param entityManifest The manifest of the entity.
   * @returns The path for the entity manifest endpoint.
   *
   */
  generateEntityManifestPath(entityManifest: EntityManifest): PathItemObject {
    return {
      get: {
        summary: `Get the ${entityManifest.nameSingular} manifest`,
        description: `Retrieves the manifest of the ${entityManifest.nameSingular} entity with all its properties.`,
        tags: ['Manifest'],
        responses: {
          '200': {
            description: `The manifest of the ${entityManifest.nameSingular} entity.`,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/EntityManifest'
                }
              }
            }
          }
        }
      }
    }
  }
}
