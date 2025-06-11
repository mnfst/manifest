import {
  AccessPolicy,
  AuthenticableEntity,
  BaseEntity,
  EntityManifest,
  RelationshipManifest,
  WhereKeySuffix
} from '@repo/types'
import { ADMIN_ENTITY_MANIFEST } from '../constants'
import { Rule } from './types/rule.type'
import { getDtoPropertyNameFromRelationship } from '../../../common/src'
import { Request } from 'express'
import { Repository } from 'typeorm'

interface PolicyParams {
  user: AuthenticableEntity
  entityManifest: EntityManifest
  entityRepository?: Repository<BaseEntity>
  userEntityManifest: EntityManifest
  rule?: Rule
  request?: Request
  options?: {
    allow?: string[]
    condition?: 'self'
  }
}

export const policies: Record<
  AccessPolicy,
  (params: PolicyParams) => Promise<boolean>
> = {
  /**
   * Returns whether the user is an admin.
   */
  admin: ({ user, userEntityManifest }: PolicyParams) =>
    Promise.resolve(
      user && userEntityManifest.slug === ADMIN_ENTITY_MANIFEST.slug
    ),

  /**
   * Allows access to all users.
   */
  public: () => Promise.resolve(true),

  /**
   * Forbids access to all users.
   */
  forbidden: () => Promise.resolve(false),

  /**
   * Returns whether the user is authenticated. If "allow" is provided, it will check if the entity is allowed.
   *  If "condition" is set to "self", it will check if the user is accessing their own entity.
   */
  restricted: async (params: PolicyParams) => {
    if (!params.user) {
      return Promise.resolve(false)
    }

    // Admins have access to restricted content.
    if (await policies.admin(params)) {
      return Promise.resolve(true)
    }

    // If "allow" is provided, check if the entity className is in the allowed list.
    if (
      params.options?.allow &&
      !params.options.allow.includes(params.userEntityManifest.className)
    ) {
      return Promise.resolve(false)
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
        return Promise.resolve(false)
      }

      const dtoOwnershipPropertyName: string =
        getDtoPropertyNameFromRelationship(relationshipWithUser)

      // Creation: we only allow record creation for items where logged in user is the owner.
      if (params.rule === 'create') {
        if (params.request.body[dtoOwnershipPropertyName] !== params.user.id) {
          return Promise.resolve(false)
        }
      }

      if (params.rule === 'update' || params.rule === 'delete') {
        // Get requested record.
        const requestedRecord: BaseEntity =
          await params.entityRepository.findOneOrFail({
            where: {
              id: params.request.params.id
            },
            relations: [relationshipWithUser.name]
          })

        // If the user is not the owner of the record, deny access.
        if (
          (requestedRecord[relationshipWithUser.name] as BaseEntity)?.id !==
          params.user.id
        ) {
          return Promise.resolve(false)
        }

        if (params.rule === 'update') {
          // If the user is updating the record, we need to ensure that the ownership property is not changed.
          if (
            params.request.body[dtoOwnershipPropertyName] &&
            params.request.body[dtoOwnershipPropertyName] !==
              (requestedRecord[relationshipWithUser.name] as BaseEntity)?.id
          ) {
            return Promise.resolve(false)
          }
        }
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

    return Promise.resolve(true)
  }
}
