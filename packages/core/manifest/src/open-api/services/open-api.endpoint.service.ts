import { Injectable } from '@nestjs/common'
import { EndpointManifest } from '../../../../types/src'
import { PathItemObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { API_PATH, ENDPOINTS_PATH } from '../../constants'
import { OpenApiUtilsService } from './open-api-utils.service'

@Injectable()
export class OpenApiEndpointService {
  constructor(private readonly openApiUtilsService: OpenApiUtilsService) {}

  /**
   * Generates the dynamic endpoint paths for the OpenAPI document from an Endpoint Manifest.
   *
   * @param endpoints Endpoint Manifest
   *
   * @returns Dynamic endpoint paths
   */
  generateEndpointPaths(
    endpoints: EndpointManifest[]
  ): Record<string, PathItemObject> {
    const paths: Record<string, PathItemObject> = {}

    endpoints.forEach((endpoint: EndpointManifest) => {
      const path: string = this.convertRouteParams(
        `/${API_PATH}/${ENDPOINTS_PATH}${endpoint.path}`
      )

      paths[path] = {
        [endpoint.method.toLowerCase()]: {
          summary: endpoint.name,
          description: endpoint.description,
          tags: ['Dynamic endpoints'],
          security: this.openApiUtilsService.getSecurityRequirements(
            endpoint.policies
          ),
          parameters: Object.keys(
            this.extractRouteParams(endpoint.path) || {}
          ).map((paramName) => ({
            name: paramName,
            in: 'path',
            required: true,
            schema: {
              type: 'string'
            }
          }))
        }
      }
    })

    return paths
  }

  /**
   * Converts route params to OpenAPI format.
   * Ex: /cats/:id/upvote => /cats/{id}/upvote
   *
   * @param route Route path
   *
   * @returns Route path with OpenAPI format
   */
  private convertRouteParams(route: string): string {
    return route.replace(/:(\w+)/g, '{$1}')
  }

  private extractRouteParams(route: string): Record<string, string> {
    const params: Record<string, string> = {}
    const regex = /:(\w+)/g
    let match: RegExpExecArray | null

    while ((match = regex.exec(route)) !== null) {
      params[match[1]] = 'string'
    }

    return params
  }
}
