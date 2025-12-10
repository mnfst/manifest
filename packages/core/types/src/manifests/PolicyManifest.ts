import { AccessPolicy } from '../crud/AccessPolicy'

/**
 * A policy for a specific rule of an entity.
 */
export type PolicyManifest = {
  /**
   * The access level of the policy.
   */
  access: AccessPolicy

  /**
   * The optional entities that the policy should be applied to.
   */
  allow?: string[]

  /**
   * When set to 'self', restricts access to records owned by the authenticated user (requires belongsTo relationship)
   */
  condition?: 'self'
}
