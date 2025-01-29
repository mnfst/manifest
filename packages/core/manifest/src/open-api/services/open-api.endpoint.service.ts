import { Injectable } from '@nestjs/common'
import { EndpointManifest } from '../../../../types/src'
import { PathItemObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { API_PATH, ENDPOINTS_PATH } from '../../constants'

@Injectable()
export class OpenApiEndpointService {
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
          description: `Endpoint for ${endpoint.name}`,
          tags: ['Dynamic endpoints'],
          parameters: Object.keys(endpoint.params).map((paramName) => ({
            in: 'path',
            name: paramName,
            required: true,
            schema: {
              type: 'string'
            }
          })) // TODO: Remove the params from handler as ambiguous. Use the path params instead.
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
}
