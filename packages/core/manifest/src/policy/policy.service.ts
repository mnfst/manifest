import { Injectable } from '@nestjs/common'
import { AccessPolicy, PolicyManifest, PolicySchema } from '../../../types/src'

@Injectable()
export class PolicyService {
  /**
   * Transform an array of short form policies of into an array of long form policies.
   *
   * @param policySchemas the policies that can be in short form.
   * @param defaultPolicy the default policy to use if the policy is not provided.
   *
   * @returns the policy with the short form properties transformed into long form.
   */
  transformPolicies(
    policySchemas: PolicySchema[],
    defaultPolicy: PolicyManifest
  ): PolicyManifest[] {
    if (!policySchemas?.length) {
      return [defaultPolicy]
    }

    return policySchemas.map((policySchema: PolicySchema) => {
      let access: AccessPolicy

      // Transform emojis into long form.
      switch (policySchema.access) {
        case '🌐':
          access = 'public'
          break
        case '🔒':
          access = 'restricted'
          break
        case '️👨🏻‍💻':
          access = 'admin'
          break
        case '🚫':
          access = 'forbidden'
          break
        default:
          access = policySchema.access as AccessPolicy
      }

      const policyManifest: PolicyManifest = {
        access
      }

      if (policySchema.allow) {
        policyManifest.allow =
          typeof policySchema.allow === 'string'
            ? [policySchema.allow]
            : policySchema.allow
      }

      if (policySchema.condition) {
        policyManifest.condition = policySchema.condition
      }

      return policyManifest
    })
  }
}
