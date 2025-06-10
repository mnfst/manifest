import {
  AccessPolicy,
  AuthenticableEntity,
  EntityManifest,
  RelationshipManifest
} from '@repo/types'
import { ADMIN_ENTITY_MANIFEST } from '../constants'
import { Rule } from './types/rule.type'
import { getDtoPropertyNameFromRelationship } from '../../../common/src'

interface PolicyParams {
  user: AuthenticableEntity
  entityManifest: EntityManifest
  userEntityManifest: EntityManifest
  rule?: Rule
  body?: unknown
  options?: {
    allow?: string[]
    condition?: 'self'
  }
}

export const policies: Record<AccessPolicy, (params: PolicyParams) => boolean> =
  {
    /**
     * Returns whether the user is an admin.
     */
    admin: ({ user, userEntityManifest }: PolicyParams) =>
      user && userEntityManifest.slug === ADMIN_ENTITY_MANIFEST.slug,

    /**
     * Allows access to all users.
     */
    public: () => true,

    /**
     * Forbids access to all users.
     */
    forbidden: () => false,

    /**
     * Returns whether the user is authenticated. If "allow" is provided, it will check if the entity is allowed.
     *  If "condition" is set to "self", it will check if the user is accessing their own entity.
     */
    restricted: (params: PolicyParams) => {
      if (!params.user) {
        return false
      }

      // Admins have access to restricted content.
      if (policies.admin(params)) {
        return true
      }

      // If "allow" is provided, check if the entity className is in the allowed list.
      if (
        params.options?.allow &&
        !params.options.allow.includes(params.userEntityManifest.className)
      ) {
        return false
      }

      // If "condition" is set to "self", check if the user is accessing their own entity.
      if (params.options?.condition === 'self') {
        // Creation: we only allow record creation if logged in user is owner, same for updates, we cannot change ownership.
        if (params.rule === 'create' || params.rule === 'update') {
          const relationshipWithUser: RelationshipManifest | undefined =
            params.entityManifest.relationships.find(
              (r: RelationshipManifest) =>
                r.entity === params.userEntityManifest.className
            )
          if (!relationshipWithUser) {
            return false
          }

          const dtoOwnershipPropertyName: string =
            getDtoPropertyNameFromRelationship(relationshipWithUser)

          if (params.body[dtoOwnershipPropertyName] !== params.user.id) {
            return false
          }
        }

        if (params.rule === 'update' || params.rule === 'delete') {
          // TODO: Get requested record and ensure that it belongs to the user.
        }

        if (params.rule === 'read') {
          // TODO: restrict read access to only the user's own records.
        }
      }

      return true
    }
  }
