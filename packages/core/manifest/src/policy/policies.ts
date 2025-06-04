import { AccessPolicy, AuthenticableEntity, EntityManifest } from '@repo/types'
import { ADMIN_ENTITY_MANIFEST } from '../constants'

export const policies: Record<
  AccessPolicy,
  (
    user: AuthenticableEntity,
    entity: EntityManifest,
    options?: {
      allow?: string[]
      condition?: 'self'
    }
  ) => boolean
> = {
  /**
   * Returns whether the user is an admin.
   */
  admin: (user: AuthenticableEntity, entity: EntityManifest) =>
    user && entity.slug === ADMIN_ENTITY_MANIFEST.slug,

  /**
   * Allows access to all users.
   */
  public: (_user: AuthenticableEntity, _entity: EntityManifest) => true,

  /**
   * Forbids access to all users.
   */
  forbidden: (_user: AuthenticableEntity, _entity: EntityManifest) => false,

  /**
   * Returns whether the user is authenticated. If "allow" is provided, it will check if the entity is allowed.
   *  If "condition" is set to "self", it will check if the user is accessing their own entity.
   */
  restricted: (
    user: AuthenticableEntity,
    entity: EntityManifest,
    options: { allow: string[]; condition?: 'self' }
  ) => {
    if (!user) {
      return false
    }

    // Admins have access to restricted content.
    if (policies.admin(user, entity)) {
      return true
    }

    // If "allow" is provided, check if the entity className is in the allowed list.
    if (options.allow && !options.allow.includes(entity.className)) {
      return false
    }

    // If "condition" is set to "self", check if the user is accessing their own entity.
    if (options.condition === 'self') {
      // TODO: Logic goes here.
    }

    return true
  }
}
