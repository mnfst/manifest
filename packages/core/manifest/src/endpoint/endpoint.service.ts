import { Injectable } from '@nestjs/common'
import { EndpointSchema, EndpointManifest, HttpMethod } from '@repo/types'
import { match } from 'path-to-regexp'
import { PolicyService } from '../policy/policy.service'
import { PUBLIC_ACCESS_POLICY } from '../constants'

@Injectable()
export class EndpointService {
  constructor(private readonly policyService: PolicyService) {}

  /**
   * Transforms an endpoint schema into a endpoint manifest.
   *
   * @param endpointSchema The endpoint schema.
   * @param event The endpoint event name which the endpoint is related to
   *
   * @returns The endpoint manifest.
   */
  transformEndpointsSchemaObject(endpointSchemaObject: {
    [k: string]: EndpointSchema
  }): EndpointManifest[] {
    return Object.keys(endpointSchemaObject).map((endpointName: string) => {
      const endpointSchema = endpointSchemaObject[endpointName]
      return {
        name: endpointName,
        path: endpointSchema.path,
        description:
          endpointSchema.description || `Endpoint for ${endpointName} handler`,
        method: endpointSchema.method,
        policies: this.policyService.transformPolicies(
          endpointSchema.policies,
          PUBLIC_ACCESS_POLICY
        ),
        handler: endpointSchema.handler
      }
    })
  }

  /**
   * Matches a route path to an endpoint. Returns the endpoint manifest and the params.
   *
   * @param path The path to match.
   * @param method The method to match.
   * @param endpoints The endpoints to match against.
   *
   * @returns The endpoint manifest and the params.
   *
   */
  matchRoutePath({
    path,
    method,
    endpoints
  }: {
    path: string
    method: HttpMethod
    endpoints: EndpointManifest[]
  }): { endpoint: EndpointManifest; params: object } {
    for (const endpoint of endpoints) {
      const matcher = match(endpoint.path)
      const result = matcher(path)

      if (result && endpoint.method === method) {
        return {
          endpoint,
          params: result?.params || {}
        }
      }
    }

    return { endpoint: null, params: {} }
  }
}
