import {
  AccessPolicy,
  AuthenticableEntity,
  EntityManifest,
  RelationshipManifest,
  WhereKeySuffix
} from '@repo/types'
import { ADMIN_ENTITY_MANIFEST } from '../constants'
import { Rule } from './types/rule.type'
import { getDtoPropertyNameFromRelationship } from '../../../common/src'
import { Request } from 'express'

interface PolicyParams {
  user: AuthenticableEntity
  entityManifest: EntityManifest
  userEntityManifest: EntityManifest
  rule?: Rule
  body?: unknown
  request?: Request
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
        // Get the relationship with the user entity.
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

        // Creation: we only allow record creation if logged in user is owner, same for updates, we cannot change ownership.
        if (params.rule === 'create' || params.rule === 'update') {
          if (params.body[dtoOwnershipPropertyName] !== params.user.id) {
            return false
          }
        }

        if (params.rule === 'update' || params.rule === 'delete') {
          // TODO: Get requested record and ensure that it belongs to the user.
        }

        if (params.rule === 'read') {
          // Restrict read access to only the user's own records.

          // Make sure the relationship is requested in the query in order to filter by it.
          const relationQueryParam: string =
            (params.request.query['relations'] as string) || ''
          if (!relationQueryParam.includes(relationshipWithUser.name)) {
            // If the relationship is not requested, we add it to the query.
            params.request.query['relations'] = relationQueryParam
              ? relationQueryParam + ',' + relationshipWithUser.name
              : relationshipWithUser.name
          }

          params.request.query = {
            ...params.request.query,
            [relationshipWithUser.name + '.id' + WhereKeySuffix.Equal]:
              params.user.id
          }
        }
      }

      return true
    }
  }
