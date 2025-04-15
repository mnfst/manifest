import { Injectable } from '@nestjs/common'
import { PolicyManifest } from '../../../../types/src'
import { SecurityRequirementObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

@Injectable()
export class OpenApiUtilsService {
  /**
   * Retrieves the security requirements from the policies (auth).
   *
   * @param policies
   * @returns
   */
  getSecurityRequirements(
    policies: PolicyManifest[]
  ): SecurityRequirementObject[] {
    const security = policies
      .filter((policy) => policy.access !== 'public')
      .map((policy) => {
        if (policy.access === 'restricted') {
          return policy.allow?.reduce(
            (acc, entity) => {
              acc[entity] = []
              return acc
            },
            {
              Admin: []
            }
          )
        }

        return {
          [policy.access.charAt(0).toUpperCase() + policy.access.slice(1)]: []
        }
      })

    return security
  }
}
